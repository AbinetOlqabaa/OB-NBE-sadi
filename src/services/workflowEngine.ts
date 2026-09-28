/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReportSubmission, SubmissionStatus, UserSession, SubmissionComment } from '../types/regulatory.ts';

export interface TransitionResult {
  success: boolean;
  newStatus?: SubmissionStatus;
  error?: string;
  auditAction?: string;
}

export class WorkflowEngine {
  /**
   * Evaluates if a state transition is legal according to strict Maker-Checker rules:
   * 1. Segregation of Duties: Maker cannot approve their own report.
   * 2. Administrator role is strictly read-only oversight; Admins cannot alter, submit, or approve reports.
   * 3. Makers prepare returns and submit to Checker.
   * 4. Checkers from the authorized department review and sign off (Approve, Reject, Request Correction).
   * 5. Once Approved, it is the Maker who executes the final submission of the report to the NBE.
   */
  public static canTransition(
    currentStatus: SubmissionStatus,
    targetStatus: SubmissionStatus,
    user: UserSession,
    submission: ReportSubmission
  ): TransitionResult {
    // Rule: Administrator is strictly oversight - cannot apply changes or submissions on reports
    if (user.role === 'ADMIN') {
      return {
        success: false,
        error:
          'Administrator role is restricted to informative compliance oversight per NBE directives. Operational transitions must be performed by authorized Makers and Checkers.',
      };
    }

    // Rule: Segregation of Duties - Maker cannot review or approve their own report
    if (['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'].includes(targetStatus) && user.id === submission.makerId) {
      return {
        success: false,
        error: 'Segregation of duties violation: Maker cannot review, approve, or reject their own submission.',
      };
    }

    // Role-based state transitions
    switch (currentStatus) {
      case 'DRAFT':
      case 'CORRECTION_REQUIRED':
        if (targetStatus === 'PENDING_CHECKER') {
          if (user.role !== 'MAKER') {
            return { success: false, error: 'Only a Maker can submit reports for Checker review.' };
          }
          return { success: true, newStatus: 'PENDING_CHECKER', auditAction: 'MAKER_SUBMIT' };
        }
        if (targetStatus === 'DRAFT') {
          if (user.role !== 'MAKER') {
            return { success: false, error: 'Only a Maker can save draft reports.' };
          }
          return { success: true, newStatus: 'DRAFT', auditAction: 'SAVE_DRAFT' };
        }
        return { success: false, error: `Illegal transition from ${currentStatus} to ${targetStatus}` };

      case 'PENDING_CHECKER':
        if (user.role !== 'CHECKER') {
          return { success: false, error: 'Only an authorized Checker from the report department can review submissions.' };
        }
        if (targetStatus === 'APPROVED') {
          return { success: true, newStatus: 'APPROVED', auditAction: 'CHECKER_APPROVE' };
        }
        if (targetStatus === 'REJECTED') {
          return { success: true, newStatus: 'REJECTED', auditAction: 'CHECKER_REJECT' };
        }
        if (targetStatus === 'CORRECTION_REQUIRED') {
          return { success: true, newStatus: 'CORRECTION_REQUIRED', auditAction: 'REQUEST_CORRECTION' };
        }
        return { success: false, error: `Illegal transition from ${currentStatus} to ${targetStatus}` };

      case 'APPROVED':
        // Per NBE requirements: "It's the Maker who makes the final submission of the report to the NBE"
        if (targetStatus === 'SENDING') {
          if (user.role !== 'MAKER') {
            return {
              success: false,
              error: 'Segregation rule: It is the Maker who makes the final submission of the approved report to the NBE.',
            };
          }
          return { success: true, newStatus: 'SENDING', auditAction: 'MAKER_FINAL_NBE_SUBMISSION' };
        }
        return { success: false, error: `Approved reports can only transition to SENDING for NBE delivery.` };

      case 'SENDING':
        if (targetStatus === 'SENT') {
          return { success: true, newStatus: 'SENT', auditAction: 'NBE_DELIVERY_CONFIRMED' };
        }
        if (targetStatus === 'FAILED') {
          return { success: true, newStatus: 'FAILED', auditAction: 'NBE_DELIVERY_FAILED' };
        }
        return { success: false, error: `Sending state can only resolve to SENT or FAILED.` };

      case 'FAILED':
        if (targetStatus === 'SENDING') {
          if (user.role !== 'MAKER') {
            return { success: false, error: 'Only the Maker can retry NBE delivery for failed submissions.' };
          }
          return { success: true, newStatus: 'SENDING', auditAction: 'RETRY_NBE_DELIVERY' };
        }
        if (targetStatus === 'CORRECTION_REQUIRED') {
          return { success: true, newStatus: 'CORRECTION_REQUIRED', auditAction: 'RESET_FAILED_FOR_CORRECTION' };
        }
        return { success: false, error: `Failed reports can only be retried (SENDING) or reset for correction.` };

      case 'REJECTED':
        if (targetStatus === 'DRAFT' || targetStatus === 'CORRECTION_REQUIRED') {
          if (user.role !== 'MAKER') {
            return { success: false, error: 'Only a Maker can reopen a rejected submission for revisions.' };
          }
          return { success: true, newStatus: 'CORRECTION_REQUIRED', auditAction: 'REOPEN_REJECTED' };
        }
        return { success: false, error: `Rejected submissions cannot directly transition to ${targetStatus}.` };

      case 'SENT':
        return { success: false, error: 'Submission has already been delivered to NBE and is immutable.' };

      default:
        return { success: false, error: `Unknown submission status: ${currentStatus}` };
    }
  }

  /**
   * Applies the state transition and updates version / timestamps.
   */
  public static applyTransition(
    submission: ReportSubmission,
    targetStatus: SubmissionStatus,
    user: UserSession,
    commentText?: string
  ): { updatedSubmission: ReportSubmission; comment: SubmissionComment } {
    const check = this.canTransition(submission.status, targetStatus, user, submission);
    if (!check.success) {
      throw new Error(check.error || 'Transition denied by workflow rules');
    }

    const now = new Date().toISOString();
    const isNewVersion = targetStatus === 'CORRECTION_REQUIRED' || targetStatus === 'DRAFT';

    const comment: SubmissionComment = {
      id: 'comm_' + Math.random().toString(36).substring(2, 9),
      userId: user.id,
      userName: user.name,
      userRole: user.role as any,
      comment: commentText || `Status transitioned to ${targetStatus}`,
      action:
        targetStatus === 'APPROVED'
          ? 'APPROVE'
          : targetStatus === 'REJECTED'
          ? 'REJECT'
          : targetStatus === 'CORRECTION_REQUIRED'
          ? 'REQUEST_CORRECTION'
          : targetStatus === 'PENDING_CHECKER'
          ? 'SUBMIT'
          : 'NOTE',
      timestamp: now,
    };

    const updated: ReportSubmission = {
      ...submission,
      status: targetStatus,
      version: isNewVersion ? submission.version + 1 : submission.version,
      updatedAt: now,
      comments: [...submission.comments, comment],
    };

    if (targetStatus === 'PENDING_CHECKER') {
      updated.submittedAt = now;
    }

    if (targetStatus === 'APPROVED' || targetStatus === 'REJECTED' || targetStatus === 'CORRECTION_REQUIRED') {
      updated.reviewedAt = now;
      updated.checkerId = user.id;
      updated.checkerName = user.name;
      updated.checkerEmail = user.email;
      updated.checkerDepartment = user.department;
    }

    if (targetStatus === 'APPROVED') {
      updated.approvedAt = now;
    }

    if (targetStatus === 'SENDING') {
      updated.finalSubmittedAt = now;
      updated.finalSubmittedBy = `${user.name} (${user.role})`;
    }

    return { updatedSubmission: updated, comment };
  }
}
