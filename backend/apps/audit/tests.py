from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from apps.accounts.models import UserAccount
from apps.reports.models import RegulatoryReport
from apps.departments.models import Department
from apps.workflows.models import Submission
from apps.audit.models import AuditFinding, AuditEvidence, AuditWorkingNote, RemediationAction, AuditReportPackage
from apps.permissions.authorization import AuthorizationEngine

class AuditorRoleAndPermissionsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Department
        self.dept = Department.objects.create(
            id="dept_credit_test",
            short_code="CRD",
            name="Credit Operations & Portfolio Management",
            division="Credit Division",
            description="Credit department"
        )
        self.audit_dept = Department.objects.create(
            id="dept_audit_test",
            short_code="AUD",
            name="Internal Audit & Regulatory Control",
            division="Audit Division",
            description="Audit directorate"
        )

        # Users
        self.maker = UserAccount.objects.create(
            id="usr_maker_test",
            email="maker.test@oromiabank.com",
            name="Test Maker",
            role="MAKER",
            department=self.dept.name,
            institution_code="0000013",
            employee_id="OB-M-01",
            status="ACTIVE"
        )
        self.checker = UserAccount.objects.create(
            id="usr_checker_test",
            email="checker.test@oromiabank.com",
            name="Test Checker",
            role="CHECKER",
            department=self.dept.name,
            institution_code="0000013",
            employee_id="OB-C-01",
            status="ACTIVE"
        )
        self.auditor = UserAccount.objects.create(
            id="usr_auditor_test",
            email="auditor.test@oromiabank.com",
            name="Abinet Alemu",
            role="AUDITOR",
            department=self.audit_dept.name,
            institution_code="0000013",
            employee_id="OB-AUD-01",
            status="ACTIVE"
        )

        # Report definition
        self.report = RegulatoryReport.objects.create(
            return_key="ANARN001",
            code="ANARN001",
            title="Analysis of Agricultural Non-Performing Loans",
            frequency="Quarterly",
            department=self.dept
        )

        # Submission created by Maker
        self.submission = Submission.objects.create(
            id="sub_test_001",
            report_key=self.report.return_key,
            period_year=2026,
            period_quarter=1,
            maker_id=self.maker.id,
            maker_name=self.maker.name,
            maker_dept=self.dept.name,
            version=1,
            status="PENDING_CHECKER",
            values={"TOTAL_LOANS": 100000000}
        )

    def test_auditor_cannot_create_draft_submission(self):
        """
        Enforce Abinet Alemu directive:
        An Auditor must not automatically gain Maker privileges.
        """
        authorized, reason = AuthorizationEngine.evaluate_access(self.auditor, self.report.return_key, 'CREATE_DRAFT')
        self.assertFalse(authorized)
        self.assertIn("AUDITOR", reason)
        self.assertIn("read-only", reason.lower())

    def test_auditor_cannot_review_or_approve_submission(self):
        """
        Enforce Abinet Alemu directive:
        An Auditor must not gain Checker review or approval privileges.
        """
        authorized, reason = AuthorizationEngine.evaluate_access(self.auditor, self.report.return_key, 'REVIEW', self.submission)
        self.assertFalse(authorized)
        self.assertIn("AUDITOR", reason)

    def test_auditor_cannot_deliver_to_nbe(self):
        """
        An Auditor is strictly barred from central bank delivery.
        """
        authorized, reason = AuthorizationEngine.evaluate_access(self.auditor, self.report.return_key, 'DELIVER_NBE', self.submission)
        self.assertFalse(authorized)

    def test_auditor_can_inspect_submissions_across_departments(self):
        """
        Auditors possess full read-only oversight access across all bank departments.
        """
        authorized, reason = AuthorizationEngine.evaluate_access(self.auditor, self.report.return_key, 'VIEW')
        self.assertTrue(authorized)

    def test_auditor_work_queue_api(self):
        """
        Auditor work queue aggregates submissions, findings, and inspection metrics.
        """
        response = self.client.get('/api/v1/audit/work-queue')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('summary', data)
        self.assertIn('queue', data)
        self.assertEqual(data['summary']['totalReportsInQueue'], 1)
        self.assertEqual(data['queue'][0]['reportKey'], 'ANARN001')

    def test_audit_finding_lifecycle_and_permission(self):
        """
        Only AUDITOR or ADMIN can create findings.
        Makers cannot file audit findings.
        """
        # 1. Maker attempts to create finding -> 403 Forbidden
        maker_resp = self.client.post('/api/v1/audit/findings', {
            'submissionId': self.submission.id,
            'reportKey': self.submission.report_key,
            'title': 'Maker unauthorized finding',
            'severity': 'HIGH',
            'user': {'email': self.maker.email}
        }, format='json')
        self.assertEqual(maker_resp.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Auditor creates finding -> 201 Created
        auditor_resp = self.client.post('/api/v1/audit/findings', {
            'submissionId': self.submission.id,
            'reportKey': self.submission.report_key,
            'department': self.dept.name,
            'title': 'Undocumented NPL variance in Schedule 2',
            'description': 'Variance of 4.2M ETB between General Ledger and loan schedule.',
            'severity': 'HIGH',
            'regulatoryReference': 'NBE Directive BSD/03/2020 Art. 6',
            'affectedField': 'TOTAL_LOANS',
            'financialVariance': 4200000.00,
            'user': {'email': self.auditor.email}
        }, format='json')
        self.assertEqual(auditor_resp.status_code, status.HTTP_201_CREATED)
        finding_data = auditor_resp.json()
        self.assertTrue(finding_data['id'].startswith('FIND-'))
        self.assertEqual(finding_data['severity'], 'HIGH')
        self.assertEqual(finding_data['status'], 'OPEN')

        # 3. Patch finding status
        patch_resp = self.client.patch(f"/api/v1/audit/findings/{finding_data['id']}", {
            'status': 'REMEDIATION_PENDING'
        }, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.json()['status'], 'REMEDIATION_PENDING')

    def test_evidence_management_and_tamper_seal(self):
        """
        Evidence record receives cryptographic hash and tamper seal.
        """
        resp = self.client.post('/api/v1/audit/evidence', {
            'submissionId': self.submission.id,
            'reportKey': self.submission.report_key,
            'title': 'General Ledger Reconciliation Sheet',
            'fileName': 'gl_reconciliation_q1_2026.xlsx',
            'fileType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'fileSizeBytes': 45200,
            'sha256Checksum': 'a3c7b9e2f1d48c90123456789abcdef0123456789abcdef0123456789abcdef0',
            'notes': 'Verified against core banking ledger.'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertTrue(data['id'].startswith('EVID-'))
        self.assertTrue(data['tamperSeal'].startswith('OB-EVID-SEAL-'))

    def test_remediation_tracking_and_signoff(self):
        """
        Remediation action assignment, progress, and auditor verification.
        """
        resp = self.client.post('/api/v1/audit/remediations', {
            'findingId': 'FIND-20260101-ABC123',
            'actionPlan': 'Adjust general ledger provision account and re-run loan portfolio aging report.',
            'assignedDepartment': self.dept.name,
            'assignedTo': self.maker.name,
            'targetDate': '2026-04-15',
            'status': 'IN_PROGRESS'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        rem_id = resp.json()['id']

        # Auditor verifies completion
        patch_resp = self.client.patch(f"/api/v1/audit/remediations/{rem_id}", {
            'status': 'VERIFIED_BY_AUDITOR',
            'remediationProof': 'Provision adjustment entry #884920 posted and verified in T24 CBS.'
        }, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.json()['status'], 'VERIFIED_BY_AUDITOR')

    def test_audit_report_export(self):
        """
        Export formal audit report with official cryptographic seal.
        """
        resp = self.client.post('/api/v1/audit/reports/export', {
            'period': '2026-Q1',
            'scopeDepartments': [self.dept.name, self.audit_dept.name]
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertTrue(data['id'].startswith('AUD-REP-'))
        self.assertTrue(data['tamperSeal'].startswith('OB-AUD-SEAL-'))
