from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from apps.accounts.models import UserAccount
from apps.departments.models import Department
from apps.reports.models import RegulatoryReport
from apps.workflows.models import Submission
from apps.permissions.authorization import AuthorizationEngine
from apps.permissions.models import SpecialAccessGrant

class PermissionsTests(TestCase):
    def setUp(self):
        self.dept_credit = Department.objects.create(
            id='dept_credit_ops',
            name='Credit Operations & Portfolio Management',
            short_code='COPM',
            division='Credit Business Division'
        )
        self.dept_trade = Department.objects.create(
            id='dept_trade_services',
            name='Trade Services & International Banking',
            short_code='TSIB',
            division='International Banking'
        )

        self.report_la = RegulatoryReport.objects.create(
            return_key='LOA_ADV_OUT_LA001',
            code='LA001',
            title='Loans Outturn',
            category='Credit Operations',
            frequency='MONTHLY',
            department=self.dept_credit
        )
        self.report_lc = RegulatoryReport.objects.create(
            return_key='POBEPE001',
            code='POBEPE001',
            title='Off Balance Sheet',
            category='Trade Services',
            frequency='QUARTERLY',
            department=self.dept_trade
        )

        self.credit_maker = UserAccount.objects.create_user(
            id='mkr_credit',
            name='Credit Maker',
            email='credit.maker@test.com',
            role='MAKER',
            status='ACTIVE',
            department='Credit Operations & Portfolio Management',
            employee_id='OB-MKR-001'
        )
        self.credit_checker = UserAccount.objects.create_user(
            id='chk_credit',
            name='Credit Checker',
            email='credit.checker@test.com',
            role='CHECKER',
            status='ACTIVE',
            department='Credit Operations & Portfolio Management',
            employee_id='OB-CHK-001'
        )
        self.admin_user = UserAccount.objects.create_user(
            id='adm_user',
            name='Admin User',
            email='admin@test.com',
            role='ADMIN',
            status='ACTIVE',
            department='Compliance & Legal Governance',
            employee_id='OB-ADM-001'
        )

    def test_admin_cannot_create_or_submit_reports(self):
        auth, reason = AuthorizationEngine.evaluate_access(self.admin_user, 'LOA_ADV_OUT_LA001', 'CREATE_DRAFT')
        self.assertFalse(auth)
        self.assertIn('read-only oversight', reason)

    def test_maker_department_isolation(self):
        # Maker can create report for own department
        auth, _ = AuthorizationEngine.evaluate_access(self.credit_maker, 'LOA_ADV_OUT_LA001', 'CREATE_DRAFT')
        self.assertTrue(auth)

        # Maker CANNOT create report for other department
        auth_foreign, reason = AuthorizationEngine.evaluate_access(self.credit_maker, 'POBEPE001', 'CREATE_DRAFT')
        self.assertFalse(auth_foreign)
        self.assertIn('not authorized', reason)

    def test_special_access_grant_allows_cross_department(self):
        # Grant special access to POBEPE001
        SpecialAccessGrant.objects.create(
            id='grant_1',
            user=self.credit_maker,
            report_key='POBEPE001',
            reason='Interim emergency coverage',
            granted_by='Dawit Bekele (ADMIN)'
        )
        # Now maker should be authorized
        auth, _ = AuthorizationEngine.evaluate_access(self.credit_maker, 'POBEPE001', 'CREATE_DRAFT')
        self.assertTrue(auth)

    def test_four_eyes_principle_maker_cannot_review_own_report(self):
        sub = Submission.objects.create(
            id='sub_test_1',
            report_key='LOA_ADV_OUT_LA001',
            status='PENDING_CHECKER',
            maker_id=self.credit_maker.id,
            maker_name=self.credit_maker.name,
            maker_dept=self.credit_maker.department
        )

        # Maker tries to review own report
        auth, reason = AuthorizationEngine.evaluate_access(self.credit_maker, 'LOA_ADV_OUT_LA001', 'REVIEW', sub)
        self.assertFalse(auth)
        # Checker from department CAN review
        auth_chk, _ = AuthorizationEngine.evaluate_access(self.credit_checker, 'LOA_ADV_OUT_LA001', 'REVIEW', sub)
        self.assertTrue(auth_chk)
