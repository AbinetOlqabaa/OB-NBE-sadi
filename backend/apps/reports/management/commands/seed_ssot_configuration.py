from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.departments.models import Department, DepartmentReportAssignment
from apps.reports.models import ReportDefinition, ReportVersion, RegulatoryReport
from apps.accounts.models import Role, Permission
from apps.workflows.models import WorkflowDefinition, WorkflowStep

class Command(BaseCommand):
    help = 'Seeds authoritative configuration SSOT records for Oromia Bank NBE Platform'

    def handle(self, *args, **options):
        self.stdout.write("Seeding Oromia Bank SSOT Configuration...")

        # 1. Seed Roles
        roles_data = [
            ("ADMIN", "Compliance Administrator", "Full system configuration and user management", ["*"]),
            ("MAKER", "Regulatory Reporting Maker", "Prepares, fills, and submits department regulatory returns", [
                "REPORT_CREATE_DRAFT", "REPORT_EDIT_DRAFT", "REPORT_VALIDATE", "WORKFLOW_SUBMIT_CHECKER"
            ]),
            ("CHECKER", "Four-Eyes Regulatory Checker", "Reviews, verifies, and approves department regulatory returns", [
                "REPORT_VIEW", "REPORT_VALIDATE", "WORKFLOW_CHECKER_APPROVE", "WORKFLOW_CHECKER_REJECT", "WORKFLOW_REQUEST_CORRECTION"
            ]),
            ("AUDITOR", "Internal Compliance Auditor", "Independent supervision, work queue inspection, and findings", [
                "AUDIT_INSPECT_ALL", "AUDIT_CREATE_FINDING", "AUDIT_ATTACH_EVIDENCE", "AUDIT_GENERATE_REPORT"
            ]),
        ]
        for code, name, desc, perms in roles_data:
            Role.objects.update_or_create(
                code=code,
                defaults={"name": name, "description": desc, "permissions": perms, "is_active": True}
            )

        # 2. Seed Permissions
        permissions_data = [
            ("REPORT_CREATE_DRAFT", "Create Return Draft", "REPORT", "Allows drafting a regulatory return"),
            ("REPORT_EDIT_DRAFT", "Edit Return Draft", "REPORT", "Allows editing numbers in a draft return"),
            ("REPORT_VALIDATE", "Run Validation Engine", "REPORT", "Validates return rules and mathematical constraints"),
            ("WORKFLOW_SUBMIT_CHECKER", "Submit to Checker", "WORKFLOW", "Submits draft to four-eyes review"),
            ("WORKFLOW_CHECKER_APPROVE", "Approve Return", "WORKFLOW", "Approves return for central bank transmission"),
            ("WORKFLOW_CHECKER_REJECT", "Reject Return", "WORKFLOW", "Rejects return back to draft"),
            ("WORKFLOW_REQUEST_CORRECTION", "Request Correction", "WORKFLOW", "Demands correction from Maker"),
            ("WORKFLOW_DELIVER_NBE", "Deliver to NBE", "WORKFLOW", "Transmits return to National Bank of Ethiopia"),
            ("ADMIN_MANAGE_USERS", "Manage Users", "ADMIN", "Creates, approves, and configures users"),
            ("ADMIN_MANAGE_DEPARTMENTS", "Manage Departments", "ADMIN", "Configures department hierarchy"),
            ("ADMIN_MANAGE_REPORTS", "Manage Reports", "ADMIN", "Configures report definitions and versions"),
            ("AUDIT_INSPECT_ALL", "Inspect All Submissions", "AUDIT", "Read-only inspection across all bank returns"),
            ("AUDIT_CREATE_FINDING", "Create Audit Finding", "AUDIT", "Files regulatory non-compliance findings"),
        ]
        for code, name, cat, desc in permissions_data:
            Permission.objects.update_or_create(
                code=code,
                defaults={"name": name, "category": cat, "description": desc}
            )

        # 3. Seed Workflow Definitions
        wf, _ = WorkflowDefinition.objects.update_or_create(
            code="WF_STANDARD_FOUR_EYES",
            defaults={
                "id": "WF_STANDARD_FOUR_EYES",
                "name": "Standard NBE Four-Eyes Dual Control Workflow",
                "description": "Statutory workflow complying with NBE Directive BSD/03/2020",
                "version": 1,
                "is_active": True,
            }
        )

        steps_data = [
            (1, "Draft Preparation", "DRAFT", ["MAKER"], ["CREATE", "EDIT", "VALIDATE", "SUBMIT"], False),
            (2, "Four-Eyes Verification", "PENDING_CHECKER", ["CHECKER"], ["APPROVE", "REJECT", "REQUEST_CORRECTION"], False),
            (3, "Compliance Authorized", "APPROVED", ["MAKER"], ["TRANSMIT"], False),
            (4, "Regulatory Delivery", "SENT", [], ["AUDIT_SEAL"], False),
        ]
        for step_num, name, state, roles, actions, bio in steps_data:
            WorkflowStep.objects.update_or_create(
                workflow=wf,
                step_number=step_num,
                defaults={
                    "name": name,
                    "state_code": state,
                    "allowed_roles": roles,
                    "permitted_actions": actions,
                    "requires_biometric": bio,
                }
            )

        self.stdout.write(self.style.SUCCESS("SSOT Configuration seeded successfully in Django."))
