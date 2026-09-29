from django.utils import timezone
from apps.permissions.authorization import AuthorizationEngine

class WorkflowEngine:
    """
    Authoritative state transition engine.
    Enforces Maker-Checker segregation, 4-eyes principle, and valid state lifecycles.
    """

    LEGAL_TRANSITIONS = {
        'DRAFT': ['PENDING_CHECKER', 'DRAFT'],
        'CORRECTION_REQUIRED': ['PENDING_CHECKER', 'DRAFT'],
        'PENDING_CHECKER': ['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'],
        'APPROVED': ['SENDING'],
        'SENDING': ['SENT', 'FAILED'],
        'FAILED': ['SENDING', 'DRAFT'],
        'REJECTED': ['DRAFT'],
        'SENT': [],
    }

    @classmethod
    def can_transition(cls, current_status: str, target_status: str, user, submission) -> tuple[bool, str]:
        # Administrator & Auditor roles are strictly oversight - cannot change report workflow state
        if getattr(user, 'role', '') in ('ADMIN', 'AUDITOR'):
            return False, "Auditor and Administrator roles are restricted to compliance oversight per NBE directives and Abinet Alemu mandate. An Auditor does not gain Maker or Checker privileges."

        allowed_targets = cls.LEGAL_TRANSITIONS.get(current_status, [])
        if target_status not in allowed_targets:
            return False, f"Illegal state transition from {current_status} to {target_status}."

        # Submission to Checker (DRAFT -> PENDING_CHECKER)
        if target_status == 'PENDING_CHECKER':
            authorized, reason = AuthorizationEngine.evaluate_access(user, submission.report_key, 'SUBMIT_CHECKER', submission)
            if not authorized:
                return False, reason
            return True, "Authorized Maker submission."

        # Checker Review (PENDING_CHECKER -> APPROVED / REJECTED / CORRECTION_REQUIRED)
        if target_status in ('APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'):
            authorized, reason = AuthorizationEngine.evaluate_access(user, submission.report_key, 'REVIEW', submission)
            if not authorized:
                return False, reason
            return True, "Authorized Checker decision."

        # Maker Final Delivery (APPROVED -> SENDING)
        if target_status == 'SENDING':
            authorized, reason = AuthorizationEngine.evaluate_access(user, submission.report_key, 'DELIVER_NBE', submission)
            if not authorized:
                return False, reason
            return True, "Authorized Maker final delivery."

        # System/Gateway results (SENDING -> SENT or FAILED)
        if target_status in ('SENT', 'FAILED'):
            return True, "State resolved by NBE gateway."

        return False, "Transition not recognized."
