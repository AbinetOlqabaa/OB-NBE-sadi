/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReportSubmission, DeliveryAttempt } from '../types/regulatory.ts';
import { nbeSimulator } from './nbeSimulator.ts';
import { auditService } from './auditService.ts';

export interface DeliveryResult {
  success: boolean;
  statusCode: number;
  response: any;
  attempt: DeliveryAttempt;
  error?: string;
}

export class NBEAdapter {
  private baseUrl: string = 'http://localhost:3000/api/nbe-simulator';
  private maxRetries: number = 3;
  private timeoutMs: number = 10000;

  /**
   * Prepares the canonical NBE JSON report payload from a submission record.
   */
  public static buildNBEPayload(submission: ReportSubmission): any {
    const returnItems = Object.entries(submission.values).map(([code, val]) => ({
      Code: code,
      Value: val,
    }));

    const dynamicAreas = Object.entries(submission.dynamicRows || {}).map(([areaId, rows]) => ({
      Area: Number(areaId),
      Rows: rows.map((r) => r.values),
    }));

    return {
      ReturnKey: submission.reportKey,
      InstCode: submission.institutionCode || '0000013',
      FinYear: submission.periodYear || 2026,
      StartDate: submission.periodStart,
      EndDate: submission.periodEnd,
      ReturnItemsList: returnItems,
      DynamicItemsList: dynamicAreas,
    };
  }

  /**
   * Delivers a regulatory report to NBE with safe retries, correlation tracking, and idempotency protection.
   */
  public async deliverReport(
    submission: ReportSubmission,
    attemptNumber: number = 1
  ): Promise<DeliveryResult> {
    const correlationId = 'corr_' + Math.random().toString(36).substring(2, 10);
    const idempotencyKey = submission.idempotencyKey || 'idemp_' + submission.id + '_v' + submission.version;

    const payload = NBEAdapter.buildNBEPayload(submission);
    const headers = {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
      'x-correlation-id': correlationId,
      'x-institution-code': submission.institutionCode || '0000013',
      'authorization': 'Bearer NBE_SIMULATED_OAUTH2_TOKEN',
    };

    let attempt: DeliveryAttempt = {
      id: 'att_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      endpointUrl: `${this.baseUrl}/submit`,
      status: 'FAILED',
      statusCode: 500,
      correlationId,
      idempotencyKey,
      requestPayload: payload,
      responsePayload: null,
      attemptNumber,
    };

    try {
      // Direct call into our local simulator service
      const res = await nbeSimulator.processSubmission(payload, headers);

      attempt.statusCode = res.statusCode;
      attempt.responsePayload = res.body;

      if (res.statusCode >= 200 && res.statusCode < 300) {
        attempt.status = 'SUCCESS';

        auditService.log({
          actorId: submission.checkerId || 'system',
          actorName: submission.checkerName || 'Checker Reviewer',
          actorRole: 'CHECKER',
          action: 'NBE_DELIVERY_SUCCESS',
          entityType: 'REPORT_SUBMISSION',
          entityId: submission.id,
          correlationId,
          details: `Report ${submission.reportKey} delivered to NBE. Official receipt: ${res.body.receiptNumber}`,
        });

        return {
          success: true,
          statusCode: res.statusCode,
          response: res.body,
          attempt,
        };
      }

      // Retryable errors: 504 Timeout or 500 Server Error
      if ((res.statusCode === 504 || res.statusCode === 500) && attemptNumber < this.maxRetries) {
        // Wait exponential backoff (100ms * attemptNumber)
        await new Promise((r) => setTimeout(r, 100 * attemptNumber));
        return this.deliverReport(submission, attemptNumber + 1);
      }

      attempt.status = res.statusCode === 504 ? 'TIMEOUT' : 'REJECTED';
      attempt.error = res.body?.message || 'NBE delivery failed with status ' + res.statusCode;

      auditService.log({
        actorId: submission.checkerId || 'system',
        actorName: submission.checkerName || 'Checker Reviewer',
        actorRole: 'CHECKER',
        action: 'NBE_DELIVERY_FAILURE',
        entityType: 'REPORT_SUBMISSION',
        entityId: submission.id,
        correlationId,
        details: `Delivery of ${submission.reportKey} failed: ${attempt.error}`,
      });

      return {
        success: false,
        statusCode: res.statusCode,
        response: res.body,
        attempt,
        error: attempt.error,
      };
    } catch (err: any) {
      attempt.status = 'FAILED';
      attempt.error = err.message || 'Network error communicating with NBE Gateway';

      if (attemptNumber < this.maxRetries) {
        await new Promise((r) => setTimeout(r, 150 * attemptNumber));
        return this.deliverReport(submission, attemptNumber + 1);
      }

      return {
        success: false,
        statusCode: 500,
        response: null,
        attempt,
        error: attempt.error,
      };
    }
  }
}

export const nbeAdapter = new NBEAdapter();
