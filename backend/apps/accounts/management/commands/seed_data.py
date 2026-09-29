import os
import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.departments.models import Department
from apps.reports.models import RegulatoryReport
from apps.accounts.models import UserAccount
from apps.permissions.models import SpecialAccessGrant
from apps.workflows.models import Submission
from apps.nbe_gateway.models import GatewayScenario
from apps.audit.audit_logger import AuditLogger

OROMIA_BANK_DEPARTMENTS_DATA = [
    {
        'id': 'dept_credit_ops',
        'name': 'Credit Operations & Portfolio Management',
        'short_code': 'COPM',
        'division': 'Credit Business & Operations Division',
        'description': 'Responsible for credit disbursements, ongoing credit facility tracking, maturity profiling, size range and economic sector distributions.',
        'primary_responsibilities': [
            'Disbursement & collection tracking',
            'Facility maturity and term loan schedules',
            'Regional and size-range exposure tracking',
            'Economic sector credit distribution',
            'Building & construction loan monitoring',
        ],
        'report_keys': [
            'LOA_ADV_OUT_LA001',
            'LOA_PORT_EP001',
            'LOAN_RAN___REGRL002',
            'LOAN_RAN_REG_RA002',
            'LOAN_SEC___REGRS002',
            'LOAN_SEC_REG_SE002',
            'BD_L_A_BD001',
            'BUIL_CONSTXW002',
        ],
    },
    {
        'id': 'dept_asset_recovery',
        'name': 'Specialized Asset Recovery & Workout',
        'short_code': 'SARW',
        'division': 'Credit Business & Operations Division',
        'description': 'Responsible for distressed debt recovery, foreclosure processes, restructured loans, non-accrual reclassifications, and non-performing loan management.',
        'primary_responsibilities': [
            'Foreclosed property acquisition and auction monitoring (18 months rule)',
            'Restructured credit facilities and concession oversight',
            'Non-accrual to accrual status recategorizations',
            'Top 20 non-performing loans portfolio management',
            'Branch and sector-level NPL concentration analysis',
        ],
        'report_keys': [
            'COL_ACQ_18M_OL001',
            'COL_SOL_18M_LL001',
            'ARLAL001',
            'RLAFCRC001',
            'ANARN001',
            'TOP_20_NPLs_TN001',
            'NPL_ECPOMNE001',
        ],
    },
    {
        'id': 'dept_credit_risk',
        'name': 'Credit Risk & Prudential Reporting',
        'short_code': 'CRPR',
        'division': 'Enterprise Risk & Governance Division',
        'description': 'Responsible for NBE statutory loan classification, provision calculations (Pass, Special Mention, Substandard, Doubtful, Loss), single-borrower large exposures (>10% capital), insider credits, and related-party limits.',
        'primary_responsibilities': [
            'Monthly and quarterly loan classification and provisioning',
            'Single-borrower concentration limits (>10% capital)',
            'Top 20 borrower group exposure oversight',
            'Related-party and affiliate transactions audit',
            'Insider lending compliance (Board, Execs, Officers)',
        ],
        'report_keys': [
            'M_LCPLC001',
            'LOAN_CLA_PROV_LP001',
            'NPL_PRO_NL001',
            'BOR_TEN_PER_LB002',
            'TOP_20_BOR_TB001',
            'BSD_LOAN_PART13002',
            'INS_LOAN_QR002',
        ],
    },
    {
        'id': 'dept_trade_services',
        'name': 'Trade Services & International Banking',
        'short_code': 'TSIB',
        'division': 'International Banking & Treasury Division',
        'description': 'Responsible for off-balance sheet contingent liabilities, commercial letters of credit (LC), trade performance guarantees, bid bonds, and foreign counter-guarantees.',
        'primary_responsibilities': [
            'Off-balance sheet contingent provision calculations',
            'Letters of credit commitments and liability registers',
            'Performance and financial guarantees monitoring',
            'Foreign correspondent bank counter-guarantees',
        ],
        'report_keys': [
            'POBEPE001',
        ],
    },
    {
        'id': 'dept_digital_banking',
        'name': 'Digital Banking & Fintech Operations',
        'short_code': 'DBFO',
        'division': 'Digital Transformation & Retail Division',
        'description': 'Responsible for automated digital micro-lending, instant mobile credit lines, digital agent lending, and digital credit risk velocity analytics.',
        'primary_responsibilities': [
            'Quarterly digital micro-loan disbursement and portfolio analytics',
            'Digital credit default rates and scoring performance',
            'Fintech partner and payment channel lending reconciliation',
        ],
        'report_keys': [
            'DigitalLendingDL001',
        ],
    },
    {
        'id': 'dept_internal_audit',
        'name': 'Internal Audit & Regulatory Control',
        'short_code': 'IARC',
        'division': 'Independent Assurance & Supervisory Directorate',
        'description': 'Responsible for independent inspection, continuous supervisory 4-eyes audit, validation of regulatory reporting accuracy, and compliance verification across all returns.',
        'primary_responsibilities': [
            'Independent four-eyes verification of submitted returns',
            'Traceability and audit trail inspection',
            'Regulatory compliance certification under NBE directives',
        ],
        'report_keys': [],
    },
    {
        'id': 'dept_finance_treasury',
        'name': 'Finance, Treasury & ALM',
        'short_code': 'FTALM',
        'division': 'Finance & Accounts Division',
        'description': 'Responsible for financial statement reconciliation, statutory reserve requirements, asset-liability management, liquidity ratios, and capital adequacy.',
        'primary_responsibilities': [
            'Statutory reserve calculation and verification',
            'General ledger reconciliation with regulatory returns',
            'Treasury exposure and liquidity gap reporting',
        ],
        'report_keys': [],
    },
    {
        'id': 'dept_compliance_governance',
        'name': 'Compliance & Legal Governance',
        'short_code': 'CLG',
        'division': 'Legal & Regulatory Compliance Directorate',
        'description': 'Responsible for supervisory coordination with National Bank of Ethiopia BSD examiners, cross-department access delegations, AML/CFT compliance, and regulatory governance.',
        'primary_responsibilities': [
            'Direct liaison with National Bank of Ethiopia BSD examiners',
            'Special access delegation review and audit',
            'Regulatory return submission sign-off oversight',
        ],
        'report_keys': [],
    },
]

REPORT_METADATA_TITLES = {
    'POBEPE001': ("POBEPE001", "Provision on Off-Balance Sheet Exposure", "Classification & Provisioning", "QUARTERLY"),
    'M_LCPLC001': ("M_LCPLC001", "Monthly Loans & Advances Classification and Provisioning", "Classification & Provisioning", "MONTHLY"),
    'LOAN_CLA_PROV_LP001': ("LP001", "Quarterly Loans & Advances Classification and Provisioning", "Classification & Provisioning", "QUARTERLY"),
    'NPL_PRO_NL001': ("NL001", "Non-Performing Loans and Provisions Schedule", "Asset Quality", "QUARTERLY"),
    'BOR_TEN_PER_LB002': ("LB002", "Large Exposures Exceeding 10% Capital", "Credit Risk & Concentration", "MONTHLY"),
    'TOP_20_BOR_TB001': ("TB001", "Top 20 Borrowers Exposure Return", "Credit Risk & Concentration", "QUARTERLY"),
    'BSD_LOAN_PART13002': ("PART13002", "Related Party Exposures & Transactions", "Governance & Related Parties", "MONTHLY"),
    'INS_LOAN_QR002': ("QR002", "Insider Loans and Credit Facilities Return", "Governance & Related Parties", "QUARTERLY"),
    'LOA_ADV_OUT_LA001': ("LA001", "Loans & Advances Disbursement, Collection & Outstanding Outturn", "Credit Operations", "MONTHLY"),
    'LOA_PORT_EP001': ("EP001", "Loan Portfolio by Facility Type & Maturity", "Credit Operations", "MONTHLY"),
    'LOAN_RAN___REGRL002': ("RL002", "Loan Portfolio by Size Range & Region (Monthly)", "Regional & Sector Distribution", "MONTHLY"),
    'LOAN_RAN_REG_RA002': ("RA002", "Loan Portfolio by Size Range & Region (Quarterly)", "Regional & Sector Distribution", "QUARTERLY"),
    'LOAN_SEC___REGRS002': ("RS002", "Loans by Economic Sector & Region (Monthly)", "Regional & Sector Distribution", "MONTHLY"),
    'LOAN_SEC_REG_SE002': ("SE002", "Loans by Economic Sector & Region (Quarterly)", "Regional & Sector Distribution", "QUARTERLY"),
    'BD_L_A_BD001': ("BD001", "Breakdown of Loans & Advances by Economic Sector & Maturity", "Credit Operations", "MONTHLY"),
    'BUIL_CONSTXW002': ("XW002", "Building & Construction Sector Lending Return", "Sector Concentration", "QUARTERLY"),
    'COL_ACQ_18M_OL001': ("OL001", "Collateral Acquired through Foreclosure within 18 Months", "Asset Recovery & Foreclosure", "QUARTERLY"),
    'COL_SOL_18M_LL001': ("LL001", "Foreclosed Collateral Properties Sold within 18 Months", "Asset Recovery & Foreclosure", "QUARTERLY"),
    'ARLAL001': ("ARLAL001", "Restructured Loans and Advances", "Asset Quality", "QUARTERLY"),
    'RLAFCRC001': ("RLAFCRC001", "Restructured Loans After Concessions / Restructuring", "Asset Quality", "QUARTERLY"),
    'ANARN001': ("ANARN001", "Loans Re-Categorized from Non-Accrual to Accrual Status", "Asset Quality", "QUARTERLY"),
    'TOP_20_NPLs_TN001': ("TN001", "Top 20 Non-Performing Loans Return", "Asset Quality", "QUARTERLY"),
    'NPL_ECPOMNE001': ("OMNE001", "NPL by Economic Sector and Top 6 Branches", "Asset Quality", "QUARTERLY"),
    'DigitalLendingDL001': ("DL001", "Quarterly Digital Lending Activity Return", "Fintech & Digital Banking", "QUARTERLY"),
}

DEV_SEED_USERS_DATA = [
    {
        'id': 'usr_admin_1',
        'name': 'Dawit Bekele',
        'email': 'admin@oromiabank.com',
        'role': 'ADMIN',
        'status': 'ACTIVE',
        'department': 'Compliance & Legal Governance',
        'employee_id': 'OB-ADM-001',
        'phone_number': '+251 91 123 4567',
        'is_staff': True,
    },
    {
        'id': 'usr_maker_1',
        'name': 'Abebe Kebede',
        'email': 'abebe.kebede@oromiabank.com',
        'role': 'MAKER',
        'status': 'ACTIVE',
        'department': 'Credit Operations & Portfolio Management',
        'employee_id': 'OB-MKR-104',
        'phone_number': '+251 91 234 5678',
    },
    {
        'id': 'usr_checker_1',
        'name': 'Chala Desta',
        'email': 'chala.desta@oromiabank.com',
        'role': 'CHECKER',
        'status': 'ACTIVE',
        'department': 'Credit Operations & Portfolio Management',
        'employee_id': 'OB-CHK-055',
        'phone_number': '+251 91 456 7890',
    },
    {
        'id': 'usr_auditor_1',
        'name': 'Worku Alemu',
        'email': 'auditor@oromiabank.com',
        'role': 'AUDITOR',
        'status': 'ACTIVE',
        'department': 'Internal Audit & Regulatory Control',
        'employee_id': 'OB-AUD-009',
        'phone_number': '+251 91 999 1234',
    },
    {
        'id': 'usr_maker_2',
        'name': 'Tigist Alemu',
        'email': 'tigist.alemu@oromiabank.com',
        'role': 'MAKER',
        'status': 'ACTIVE',
        'department': 'Trade Services & International Banking',
        'employee_id': 'OB-MKR-219',
        'phone_number': '+251 91 345 6789',
    },
    {
        'id': 'usr_checker_2',
        'name': 'Meron Worku',
        'email': 'meron.worku@oromiabank.com',
        'role': 'CHECKER',
        'status': 'ACTIVE',
        'department': 'Trade Services & International Banking',
        'employee_id': 'OB-CHK-112',
        'phone_number': '+251 91 789 0123',
    },
    {
        'id': 'usr_maker_3',
        'name': 'Bekele Desta',
        'email': 'bekele.desta@oromiabank.com',
        'role': 'MAKER',
        'status': 'ACTIVE',
        'department': 'Specialized Asset Recovery & Workout',
        'employee_id': 'OB-MKR-305',
        'phone_number': '+251 91 890 1234',
    },
    {
        'id': 'usr_checker_3',
        'name': 'Getachew Feyisa',
        'email': 'getachew.feyisa@oromiabank.com',
        'role': 'CHECKER',
        'status': 'ACTIVE',
        'department': 'Specialized Asset Recovery & Workout',
        'employee_id': 'OB-CHK-144',
        'phone_number': '+251 91 901 2345',
    },
    {
        'id': 'usr_pending_1',
        'name': 'Lemlem Tadesse',
        'email': 'lemlem.tadesse@oromiabank.com',
        'role': 'MAKER',
        'status': 'PENDING_APPROVAL',
        'department': 'Digital Banking & Fintech Operations',
        'employee_id': 'OB-MKR-388',
        'phone_number': '+251 91 567 8901',
    },
    {
        'id': 'usr_pending_2',
        'name': 'Solomon Girma',
        'email': 'solomon.girma@oromiabank.com',
        'role': 'CHECKER',
        'status': 'PENDING_APPROVAL',
        'department': 'Credit Risk & Prudential Reporting',
        'employee_id': 'OB-CHK-390',
        'phone_number': '+251 91 678 9012',
    },
]

class Command(BaseCommand):
    help = 'Seeds Oromia Bank departments, 24 regulatory returns, users, and initial demo data'

    def handle(self, *args, **options):
        self.stdout.write("1. Seeding Oromia Bank Departments...")
        dept_lookup = {}
        report_to_dept = {}

        for d_data in OROMIA_BANK_DEPARTMENTS_DATA:
            dept, _ = Department.objects.update_or_create(
                id=d_data['id'],
                defaults={
                    'name': d_data['name'],
                    'short_code': d_data['short_code'],
                    'division': d_data['division'],
                    'description': d_data['description'],
                    'primary_responsibilities': d_data['primary_responsibilities'],
                }
            )
            dept_lookup[dept.id] = dept
            for r_key in d_data['report_keys']:
                report_to_dept[r_key] = dept

        self.stdout.write(f"   Created/updated {len(dept_lookup)} departments.")

        self.stdout.write("2. Loading 24 NBE Regulatory Report Templates from definitions...")
        from django.conf import settings
        defs_dir = Path(settings.BASE_DIR).parent / 'data' / 'report-definitions'
        if not defs_dir.exists():
            defs_dir = Path(settings.BASE_DIR) / 'data' / 'report-definitions'
        if not defs_dir.exists():
            defs_dir = Path('/app/applet/data/report-definitions')
        reports_loaded = 0

        if defs_dir.exists():
            for json_file in defs_dir.glob('*.json'):
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)

                    r_key = data.get('ReturnKey') or json_file.stem
                    title_info = REPORT_METADATA_TITLES.get(r_key, (r_key, r_key, 'Statutory', 'QUARTERLY'))
                    code, title, category, frequency = title_info
                    dept = report_to_dept.get(r_key)

                    RegulatoryReport.objects.update_or_create(
                        return_key=r_key,
                        defaults={
                            'code': code,
                            'title': title,
                            'category': category,
                            'frequency': frequency,
                            'inst_code': data.get('InstCode', '0000013'),
                            'fin_year': data.get('FinYear', 2026),
                            'start_date': data.get('StartDate', '2026-07-01T00:00:00'),
                            'end_date': data.get('EndDate', '2026-07-31T00:00:00'),
                            'description': f"Statutory regulatory return {title} ({code}) mandated by NBE.",
                            'department': dept,
                            'return_items_list': data.get('ReturnItemsList', []),
                            'dynamic_items_list': data.get('DynamicItemsList', []),
                            'formulas': [],
                            'validation_rules': [],
                        }
                    )
                    reports_loaded += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error loading {json_file}: {e}"))
        self.stdout.write(f"   Loaded {reports_loaded} regulatory report templates.")

        self.stdout.write("3. Seeding User Accounts...")
        for u_data in DEV_SEED_USERS_DATA:
            user = UserAccount.objects.filter(email=u_data['email']).first()
            if not user:
                user = UserAccount.objects.create_user(
                    email=u_data['email'],
                    password='password',
                    id=u_data['id'],
                    name=u_data['name'],
                    role=u_data['role'],
                    status=u_data['status'],
                    department=u_data['department'],
                    employee_id=u_data['employee_id'],
                    phone_number=u_data.get('phone_number', ''),
                    institution_code='0000013',
                    is_staff=u_data.get('is_staff', False)
                )
            else:
                user.name = u_data['name']
                user.role = u_data['role']
                user.status = u_data['status']
                user.department = u_data['department']
                user.employee_id = u_data['employee_id']
                user.phone_number = u_data.get('phone_number', '')
                user.set_password('password')
                user.save()

        # Seed Special Access Grant for Tigist Alemu (Digital Lending)
        tigist = UserAccount.objects.filter(id='usr_maker_2').first()
        if tigist:
            SpecialAccessGrant.objects.get_or_create(
                id='grant_demo_1',
                defaults={
                    'user': tigist,
                    'report_key': 'DigitalLendingDL001',
                    'department': 'Digital Banking & Fintech Operations',
                    'granted_by': 'Dawit Bekele (ADMIN)',
                    'reason': 'Temporary delegation for Fintech & Digital Trade micro-lending returns (Approved by VP Operations).',
                }
            )

        self.stdout.write(f"   Created/updated {len(DEV_SEED_USERS_DATA)} development seed user accounts.")

        self.stdout.write("4. Seeding Gateway Scenario...")
        GatewayScenario.get_current()
        self.stdout.write("   Initialized NBE Gateway scenario to SUCCESS.")

        self.stdout.write("5. Seeding Demo Submissions...")
        la_report = RegulatoryReport.objects.filter(return_key='LOA_ADV_OUT_LA001').first()
        if la_report and not Submission.objects.filter(id='sub_demo_la001').exists():
            Submission.objects.create(
                id='sub_demo_la001',
                report_key='LOA_ADV_OUT_LA001',
                period_year=2026,
                period_month=7,
                status='APPROVED',
                version=1,
                maker_id='usr_maker_1',
                maker_name='Abebe Kebede',
                maker_dept='Credit Operations & Portfolio Management',
                checker_id='usr_checker_1',
                checker_name='Chala Desta',
                values={
                    '100_00001': '1582049000.50',
                    '100_00002': '423980000.00',
                    '100_00003': '2006029000.50'
                },
                dynamic_rows={},
                validation_summary={'isValid': True, 'errorCount': 0, 'warningCount': 0, 'errors': []},
                comments=[
                    {
                        'id': 'cmt_1',
                        'authorId': 'usr_maker_1',
                        'authorName': 'Abebe Kebede',
                        'authorRole': 'MAKER',
                        'createdAt': timezone.now().isoformat(),
                        'text': 'Monthly outturn prepared and reconciled against CBS GL.',
                        'action': 'SUBMIT'
                    },
                    {
                        'id': 'cmt_2',
                        'authorId': 'usr_checker_1',
                        'authorName': 'Chala Desta',
                        'authorRole': 'CHECKER',
                        'createdAt': timezone.now().isoformat(),
                        'text': 'Verified all disbursement and collection figures against Core Banking general ledger.',
                        'action': 'APPROVE'
                    }
                ]
            )

        AuditLogger.log(
            actor_id='usr_admin_1',
            actor_name='Dawit Bekele',
            actor_role='ADMIN',
            action='SEED_DATA_INITIALIZED',
            entity_type='SYSTEM',
            entity_id='OB_DATABASE',
            details='Database initialized with authoritative Oromia Bank departments, 24 NBE returns, and seed accounts.'
        )

        self.stdout.write(self.style.SUCCESS("Database seeding completed successfully!"))
