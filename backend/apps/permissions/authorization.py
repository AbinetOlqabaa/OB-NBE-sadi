from typing import Tuple, Optional
from django.utils import timezone

class AuthorizationEngine:
    """
    Authoritative server-side authorization enforcement for NBE Regulatory Reporting.
    No client state or parameter is ever trusted as the authority for access control.
    """

    @staticmethod
    def evaluate_access(user, report_key: str, action: str, submission=None) -> Tuple[bool, str]:
        """
        Evaluates whether a user can perform an action on a report.
        Actions: 'VIEW', 'CREATE_DRAFT', 'EDIT_DRAFT', 'SUBMIT_CHECKER', 'REVIEW', 'DELIVER_NBE'
        """
        if not user or not user.is_authenticated:
            return False, "Authentication credentials required."

        if user.status != 'ACTIVE':
            return False, f"Account is not active (current status: {user.status})."

        role = getattr(user, 'role', '')
        user_dept = getattr(user, 'department', '')

        # Resolve report's authoritative department
        from apps.reports.models import RegulatoryReport
        try:
            report = RegulatoryReport.objects.select_related('department').get(return_key=report_key)
            report_dept_name = report.department.name if report.department else ""
        except RegulatoryReport.DoesNotExist:
            return False, f"Regulatory report {report_key} does not exist."

        # VIEW permissions:
        # All authenticated users (Admin, Maker, Checker, Auditor) can view reports and submissions
        if action == 'VIEW':
            return True, "Authorized to view report."

        # AUDITOR and ADMIN permissions:
        # Strictly READ-ONLY per NBE directives. Cannot create, edit, submit, or approve.
        if role in ('ADMIN', 'AUDITOR'):
            return False, f"Role {role} is restricted to read-only oversight per NBE directives. Operational execution forbidden."

        # Check Department match or Active Special Access Grant
        is_home_department = (user_dept.strip().lower() == report_dept_name.strip().lower())
        has_special_access = False

        active_grants = user.special_access_grants.filter(revoked=False)
        for grant in active_grants:
            if grant.covers_report(report_key, report_dept_name):
                has_special_access = True
                break

        has_dept_authority = is_home_department or has_special_access

        # MAKER Actions:
        if action in ('CREATE_DRAFT', 'EDIT_DRAFT', 'SUBMIT_CHECKER'):
            if role != 'MAKER':
                return False, f"Action {action} requires MAKER role (current role: {role})."
            if not has_dept_authority:
                return False, f"Maker from '{user_dept}' is not authorized for report {report_key} belonging to '{report_dept_name}'."
            return True, "Authorized Maker operation."

        # CHECKER Actions (Review / Approve / Reject / Request Correction):
        if action == 'REVIEW':
            if role != 'CHECKER':
                return False, f"Review actions require CHECKER role (current role: {role})."
            if not has_dept_authority:
                return False, f"Checker from '{user_dept}' is not authorized to review reports belonging to '{report_dept_name}'."
            
            # 4-Eyes Principle / Segregation of duties: Maker cannot review own report!
            if submission and str(submission.maker_id) == str(user.id):
                return False, "Segregation of Duties Violation: A Maker cannot review, approve, or reject their own submission."
            return True, "Authorized Checker operation."

        # DELIVER_NBE Action:
        # Per NBE regulation: Maker performs the final submission of the approved report to the NBE.
        if action == 'DELIVER_NBE':
            if role != 'MAKER':
                return False, "Per NBE regulations, only the authorized Maker can deliver approved returns to NBE."
            if not has_dept_authority:
                return False, "Maker lacks departmental authority for final NBE delivery."
            if submission and submission.status != 'APPROVED':
                return False, f"Only returns in APPROVED state can be delivered to NBE (current state: {submission.status})."
            return True, "Authorized for NBE delivery."

        return False, f"Unknown action: {action}"
