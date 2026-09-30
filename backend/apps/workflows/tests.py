from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import UserAccount
from apps.departments.models import Department
from apps.reports.models import RegulatoryReport
from apps.workflows.models import Submission
from apps.nbe_gateway.models import GatewayScenario

class WorkflowLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(
            id='dept_credit_ops',
            name='Credit Operations & Portfolio Management',
            short_code='COPM',
            division='Credit Business Division'
        )
        self.report = RegulatoryReport.objects.create(
            return_key='LOA_ADV_OUT_LA001',
            code='LA001',
            title='Loans Outturn',
            category='Credit Operations',
            frequency='MONTHLY',
            department=self.dept,
            return_items_list=[{'Code': '100_00001', 'Value': ''}]
        )
        self.maker = UserAccount.objects.create_user(
            id='usr_maker_1',
            name='Abebe Kebede',
            email='abebe.kebede@oromiabank.com',
            role='MAKER',
            status='ACTIVE',
            department='Credit Operations & Portfolio Management',
            employee_id='OB-MKR-104'
        )
        self.checker = UserAccount.objects.create_user(
            id='usr_checker_1',
            name='Chala Desta',
            email='chala.desta@oromiabank.com',
            role='CHECKER',
            status='ACTIVE',
            department='Credit Operations & Portfolio Management',
            employee_id='OB-CHK-055'
        )
        GatewayScenario.get_current()

    def test_complete_maker_checker_nbe_workflow(self):
        # 1. Maker creates draft
        create_resp = self.client.post('/api/regulatory/submissions', {
            'reportKey': 'LOA_ADV_OUT_LA001',
            'user': {'email': self.maker.email}
        }, format='json')
        self.assertEqual(create_resp.status_code, 201)
        sub_id = create_resp.data['id']
        self.assertEqual(create_resp.data['status'], 'DRAFT')

        # 2. Maker saves values
        save_resp = self.client.put(f'/api/regulatory/submissions/{sub_id}', {
            'values': {'100_00001': '1500000'},
            'user': {'email': self.maker.email}
        }, format='json')
        self.assertEqual(save_resp.status_code, 200)
        self.assertEqual(save_resp.data['values']['100_00001'], '1500000')

        # 3. Maker submits to Checker
        submit_resp = self.client.post(f'/api/regulatory/submissions/{sub_id}/submit', {
            'comment': 'Ready for review',
            'user': {'email': self.maker.email}
        }, format='json')
        self.assertEqual(submit_resp.status_code, 200)
        self.assertEqual(submit_resp.data['status'], 'PENDING_CHECKER')

        # 4. Maker CANNOT approve own submission (4-eyes violation check)
        bad_review = self.client.post(f'/api/regulatory/submissions/{sub_id}/review', {
            'action': 'APPROVE',
            'user': {'email': self.maker.email}
        }, format='json')
        self.assertEqual(bad_review.status_code, 403)

        # 5. Checker approves
        good_review = self.client.post(f'/api/regulatory/submissions/{sub_id}/review', {
            'action': 'APPROVE',
            'comment': 'All totals verified against CBS GL.',
            'user': {'email': self.checker.email}
        }, format='json')
        self.assertEqual(good_review.status_code, 200)
        self.assertEqual(good_review.data['status'], 'APPROVED')

        # 6. Maker delivers approved report to NBE
        deliver_resp = self.client.post(f'/api/regulatory/submissions/{sub_id}/deliver', {
            'user': {'email': self.maker.email}
        }, format='json')
        self.assertEqual(deliver_resp.status_code, 200)
        self.assertTrue(deliver_resp.data['success'])
        self.assertTrue(deliver_resp.data['submissionId'].startswith('NBE-'))

        # Verify final submission status is SENT
        final_sub = Submission.objects.get(id=sub_id)
        self.assertEqual(final_sub.status, 'SENT')
        self.assertTrue(final_sub.nbe_submission_id.startswith('NBE-'))
