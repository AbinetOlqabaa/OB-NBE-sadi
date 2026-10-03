/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SimulationScenarioConfig } from '../types/regulatory.ts';
import { configService } from './configService.ts';
import { nbeEndpointRegistry } from './nbeEndpointRegistry.ts';

export interface SimulatorReportOption {
  returnKey: string;
  code: string;
  name: string;
  version: number;
  status: string;
  frequency: string;
  category: string;
  endpointUrl: string;
  environmentTarget: string;
  fieldCount: number;
  dynamicAreaCount: number;
}

export interface ReceivedReportRecord {
  id: string;
  receivedAt: string;
  returnKey: string;
  institutionCode: string;
  finYear: number;
  periodStart: string;
  periodEnd: string;
  payload: any;
  headers: Record<string, string>;
  idempotencyKey: string;
  correlationId: string;
  status: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE';
  validationErrors?: string[];
  submissionReceiptNumber: string;
}

export interface SimulatorApiLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  statusText?: string;
  returnKey?: string;
  institutionCode?: string;
  idempotencyKey?: string;
  correlationId?: string;
  message: string;
  durationMs: number;
  requestHeaders?: Record<string, string>;
  requestBody?: any;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  tlsInfo?: {
    protocol: string;
    cipherSuite: string;
    clientCertValidated: boolean;
  };
}

class NBESimulatorService {
  private scenario: SimulationScenarioConfig = {
    mode: 'ALWAYS_SUCCESS',
    failureRatePercent: 0,
    latencyMs: 150,
  };

  private receivedSubmissions: ReceivedReportRecord[] = [];
  private apiLogs: SimulatorApiLog[] = [
    {
      id: 'log_seed_1',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      method: 'POST',
      path: '/api/v1/nbe-simulator/submit',
      statusCode: 200,
      statusText: '200 OK',
      returnKey: 'POBEPE001',
      institutionCode: '0000013',
      idempotencyKey: 'idemp_sub_prev_101',
      correlationId: 'corr_nbe_918237',
      message: 'Report POBEPE001 (Balance Sheet Assets) successfully ingested. Assigned official receipt NBE-REC-20260925-8812',
      durationMs: 78,
      requestHeaders: {
        'content-type': 'application/json',
        'x-correlation-id': 'corr_nbe_918237',
        'idempotency-key': 'idemp_sub_prev_101',
        'x-institution-code': '0000013',
        'authorization': 'Bearer NBE_MTLS_TOKEN_99182',
      },
      requestBody: {
        ReturnKey: 'POBEPE001',
        InstCode: '0000013',
        FinYear: 2026,
        StartDate: '2026-01-01',
        EndDate: '2026-01-31',
        ReturnItemsList: [
          { Code: 'R01_C01', Value: 12500000000 },
          { Code: 'R02_C01', Value: 48500000000 },
          { Code: 'R03_C01', Value: 61000000000 },
        ],
      },
      responseHeaders: {
        'content-type': 'application/json',
        'server': 'NBE-Gateway/2.4.1 (Ubuntu-Enterprise)',
        'x-nbe-cluster': 'nbe-bsd-node-02',
      },
      responseBody: {
        status: 'ACCEPTED',
        message: 'Regulatory report successfully verified and accepted into NBE repository.',
        receiptNumber: 'NBE-REC-20260925-8812',
        correlationId: 'corr_nbe_918237',
      },
      tlsInfo: {
        protocol: 'TLSv1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384',
        clientCertValidated: true,
      },
    },
    {
      id: 'log_seed_2',
      timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      method: 'GET',
      path: '/api/nbe-simulator/gateway-health',
      statusCode: 200,
      statusText: '200 OK',
      institutionCode: '0000013',
      correlationId: 'corr_probe_314159',
      message: 'Heartbeat probe / health telemetry verified with NBE BSD Core cluster',
      durationMs: 32,
      requestHeaders: {
        'user-agent': 'OromiaBank-ComplianceEngine/2.0',
        'accept': 'application/json',
      },
      responseHeaders: {
        'content-type': 'application/json',
        'server': 'NBE-Gateway/2.4.1',
      },
      responseBody: {
        status: 'ONLINE',
        healthy: true,
        gateway: 'National Bank of Ethiopia (NBE) BSD Gateway',
        latencyMs: 32,
      },
      tlsInfo: {
        protocol: 'TLSv1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384',
        clientCertValidated: true,
      },
    },
  ];
  private knownIdempotencyKeys: Set<string> = new Set();

  public getScenario(): SimulationScenarioConfig {
    return { ...this.scenario };
  }

  public setScenario(newScenario: Partial<SimulationScenarioConfig>): SimulationScenarioConfig {
    this.scenario = { ...this.scenario, ...newScenario };
    return { ...this.scenario };
  }

  public getSubmissions(): ReceivedReportRecord[] {
    return [...this.receivedSubmissions];
  }

  public getLogs(): SimulatorApiLog[] {
    return [...this.apiLogs];
  }

  public clearLogs(): void {
    this.apiLogs = [];
  }

  public addLog(entry: Omit<SimulatorApiLog, 'id' | 'timestamp'>): SimulatorApiLog {
    const fullEntry: SimulatorApiLog = {
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.apiLogs.unshift(fullEntry);
    return fullEntry;
  }

  /**
   * Evaluates incoming regulatory report submission against active simulator configuration.
   */
  public async processSubmission(
    payload: any,
    headers: Record<string, string>
  ): Promise<{ statusCode: number; body: any }> {
    const startTime = Date.now();
    const idempotencyKey = headers['idempotency-key'] || headers['x-idempotency-key'] || 'NONE';
    const correlationId = headers['x-correlation-id'] || 'corr_' + Math.random().toString(36).substring(2, 9);
    const returnKey = payload?.ReturnKey || payload?.returnKey || 'UNKNOWN';
    const institutionCode = payload?.InstCode || payload?.institutionCode || '0000013';

    // Apply configured latency
    if (this.scenario.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.scenario.latencyMs));
    }

    const standardTlsInfo = {
      protocol: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
      clientCertValidated: true,
    };

    const respHeaders = {
      'content-type': 'application/json',
      'server': 'NBE-Gateway/2.4.1 (Ubuntu-Enterprise)',
      'x-nbe-cluster': 'nbe-bsd-node-01',
      'x-correlation-id': correlationId,
    };

    // 1. Scenario: Timeout Simulation
    if (this.scenario.mode === 'TIMEOUT') {
      const respBody = { error: 'Gateway Timeout', message: 'NBE Portal Gateway Timeout: No response within 10s', correlationId };
      const logEntry: SimulatorApiLog = {
        id: 'log_' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        method: 'POST',
        path: '/api/v1/nbe-simulator/submit',
        statusCode: 504,
        statusText: '504 Gateway Timeout',
        returnKey,
        institutionCode,
        idempotencyKey,
        correlationId,
        message: 'Simulated Gateway Timeout (504): NBE Central Gateway did not respond within deadline',
        durationMs: Date.now() - startTime,
        requestHeaders: headers,
        requestBody: payload,
        responseHeaders: respHeaders,
        responseBody: respBody,
        tlsInfo: standardTlsInfo,
      };
      this.apiLogs.unshift(logEntry);
      return {
        statusCode: 504,
        body: respBody,
      };
    }

    // 2. Scenario: Auth Failure
    if (this.scenario.mode === 'AUTH_FAILURE') {
      const respBody = { error: 'Unauthorized', message: 'Invalid or expired mTLS client certificate / bearer token', correlationId };
      const logEntry: SimulatorApiLog = {
        id: 'log_' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        method: 'POST',
        path: '/api/v1/nbe-simulator/submit',
        statusCode: 401,
        statusText: '401 Unauthorized',
        returnKey,
        institutionCode,
        idempotencyKey,
        correlationId,
        message: 'Simulated Authentication Failure: Invalid or expired mTLS client certificate / bearer token',
        durationMs: Date.now() - startTime,
        requestHeaders: headers,
        requestBody: payload,
        responseHeaders: respHeaders,
        responseBody: respBody,
        tlsInfo: {
          protocol: 'TLSv1.3',
          cipherSuite: 'TLS_AES_256_GCM_SHA384',
          clientCertValidated: false,
        },
      };
      this.apiLogs.unshift(logEntry);
      return {
        statusCode: 401,
        body: respBody,
      };
    }

    // 3. Scenario: Internal Server Error 500
    if (this.scenario.mode === 'SERVER_ERROR') {
      const respBody = { error: 'Internal Server Error', message: 'NBE Data Ingestion Gateway temporary outage', correlationId };
      const logEntry: SimulatorApiLog = {
        id: 'log_' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        method: 'POST',
        path: '/api/v1/nbe-simulator/submit',
        statusCode: 500,
        statusText: '500 Internal Server Error',
        returnKey,
        institutionCode,
        idempotencyKey,
        correlationId,
        message: 'Simulated NBE Central Server Error (500): Database connectivity pool exhausted',
        durationMs: Date.now() - startTime,
        requestHeaders: headers,
        requestBody: payload,
        responseHeaders: respHeaders,
        responseBody: respBody,
        tlsInfo: standardTlsInfo,
      };
      this.apiLogs.unshift(logEntry);
      return {
        statusCode: 500,
        body: respBody,
      };
    }

    // 4. Duplicate Check (Idempotency)
    if (idempotencyKey !== 'NONE' && this.knownIdempotencyKeys.has(idempotencyKey)) {
      const existing = this.receivedSubmissions.find((s) => s.idempotencyKey === idempotencyKey);
      const respBody = {
        status: 'SUCCESS_IDEMPOTENT_DUPLICATE',
        message: 'Report payload was previously received and confirmed.',
        receiptNumber: existing?.submissionReceiptNumber || 'REC-EXISTING',
        correlationId,
      };
      const logEntry: SimulatorApiLog = {
        id: 'log_' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        method: 'POST',
        path: '/api/v1/nbe-simulator/submit',
        statusCode: 200,
        statusText: '200 OK (Idempotent)',
        returnKey,
        institutionCode,
        idempotencyKey,
        correlationId,
        message: `Idempotent duplicate request safely detected and acknowledged with existing receipt ${existing?.submissionReceiptNumber}`,
        durationMs: Date.now() - startTime,
        requestHeaders: headers,
        requestBody: payload,
        responseHeaders: respHeaders,
        responseBody: respBody,
        tlsInfo: standardTlsInfo,
      };
      this.apiLogs.unshift(logEntry);
      return {
        statusCode: 200,
        body: respBody,
      };
    }

    // 5. Schema Validation in Simulator
    const validationErrors: string[] = [];
    if (!payload?.ReturnKey && !payload?.returnKey) validationErrors.push('Missing ReturnKey identifier');
    if (!payload?.InstCode && !payload?.institutionCode) validationErrors.push('Missing InstCode institutional code');
    if ((payload?.InstCode && payload.InstCode !== '0000013') || (payload?.institutionCode && payload.institutionCode !== '0000013')) {
      validationErrors.push(`Unrecognized institution code: ${payload?.InstCode || payload?.institutionCode}`);
    }

    if (this.scenario.mode === 'VALIDATION_FAILURE' || validationErrors.length > 0) {
      if (validationErrors.length === 0) {
        validationErrors.push('Simulated regulatory schema discrepancy: Net loan volume variance detected against NBE prudential standards.');
      }

      const respBody = {
        error: 'Unprocessable Entity',
        message: 'Regulatory report validation rejected by NBE intake engine',
        validationErrors,
        correlationId,
      };

      const logEntry: SimulatorApiLog = {
        id: 'log_' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        method: 'POST',
        path: '/api/v1/nbe-simulator/submit',
        statusCode: 422,
        statusText: '422 Unprocessable Entity',
        returnKey,
        institutionCode,
        idempotencyKey,
        correlationId,
        message: `Regulatory schema validation rejected: ${validationErrors.join('; ')}`,
        durationMs: Date.now() - startTime,
        requestHeaders: headers,
        requestBody: payload,
        responseHeaders: respHeaders,
        responseBody: respBody,
        tlsInfo: standardTlsInfo,
      };
      this.apiLogs.unshift(logEntry);

      return {
        statusCode: 422,
        body: respBody,
      };
    }

    // 6. Success Reception
    const receiptNum = 'NBE-REC-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    if (idempotencyKey !== 'NONE') {
      this.knownIdempotencyKeys.add(idempotencyKey);
    }

    const record: ReceivedReportRecord = {
      id: 'rec_' + Math.random().toString(36).substring(2, 9),
      receivedAt: new Date().toISOString(),
      returnKey,
      institutionCode,
      finYear: payload.FinYear || payload.finYear || 2026,
      periodStart: payload.StartDate || payload.periodStart || '2026-01-01',
      periodEnd: payload.EndDate || payload.periodEnd || '2026-01-31',
      payload,
      headers,
      idempotencyKey,
      correlationId,
      status: 'ACCEPTED',
      submissionReceiptNumber: receiptNum,
    };

    this.receivedSubmissions.unshift(record);

    const respBody = {
      status: 'ACCEPTED',
      message: 'Regulatory report successfully verified and accepted into NBE repository.',
      receiptNumber: receiptNum,
      timestamp: record.receivedAt,
      correlationId,
    };

    const logEntry: SimulatorApiLog = {
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: '/api/v1/nbe-simulator/submit',
      statusCode: 200,
      statusText: '200 OK',
      returnKey,
      institutionCode,
      idempotencyKey,
      correlationId,
      message: `Report ${returnKey} successfully ingested. Assigned official receipt ${receiptNum}`,
      durationMs: Date.now() - startTime,
      requestHeaders: headers,
      requestBody: payload,
      responseHeaders: respHeaders,
      responseBody: respBody,
      tlsInfo: standardTlsInfo,
    };
    this.apiLogs.unshift(logEntry);

    return {
      statusCode: 200,
      body: respBody,
    };
  }

  /**
   * Discovers all available reports from SSOT for dynamic simulator registration.
   * Filters out RETIRED reports to preserve active selection hygiene (Req 9, 14).
   */
  public getAvailableReports(): SimulatorReportOption[] {
    const allDefs = configService.getReports();
    const activeAndDraftDefs = allDefs.filter((d) => d.status !== 'RETIRED');

    return activeAndDraftDefs.map((def) => {
      const activeVer = def.activeVersionSnapshot;
      const versions = configService.getReportVersions(def.returnKey);
      const latestVer = activeVer || (versions.length > 0 ? versions[versions.length - 1] : undefined);
      const endpointConfig = nbeEndpointRegistry.getEndpointForReport(def.returnKey, latestVer?.versionNumber);

      const fieldCount = latestVer?.fields?.length || 0;
      const dynamicAreaCount = latestVer?.columns?.length || 0;

      return {
        returnKey: def.returnKey,
        code: def.code || def.returnKey,
        name: def.name,
        version: latestVer?.versionNumber || def.currentVersion || 1,
        status: def.status,
        frequency: def.frequency,
        category: def.category,
        endpointUrl: endpointConfig.endpointUrl,
        environmentTarget: endpointConfig.environmentTarget,
        fieldCount,
        dynamicAreaCount,
      };
    });
  }

  /**
   * Generates a canonical NBE JSON payload using active template metadata.
   * Strips sample values while honoring field data types and explicit structural defaults (Req 9).
   */
  public buildSimulatedPayload(reportKey: string, versionNumber?: number): any {
    const normalizedKey = (reportKey || '').trim().toUpperCase();
    const def = configService.getReportDefinition(normalizedKey);
    if (!def) {
      throw new Error(`Report definition '${normalizedKey}' not found.`);
    }

    const versions = configService.getReportVersions(normalizedKey);
    let targetVersion = versionNumber ? versions.find((v) => v.versionNumber === versionNumber) : def.activeVersionSnapshot;
    if (!targetVersion && versions.length > 0) {
      targetVersion = versions[versions.length - 1];
    }

    const fields = targetVersion?.fields || [];
    const columns = targetVersion?.columns || [];

    const returnItems = fields.map((f, idx) => {
      let mockVal: any;
      if (f.defaultValue !== undefined && f.defaultValue !== '') {
        mockVal = f.defaultValue;
      } else if (f.dataType === 'NUMERIC') {
        mockVal = (idx + 1) * 12500000;
      } else if (f.dataType === 'DATE') {
        mockVal = '2026-01-31';
      } else {
        mockVal = `OROMIA_${f.itemCode}_VAL`;
      }
      return {
        Code: f.itemCode,
        Value: mockVal,
      };
    });

    const dynamicAreas = columns.length > 0 ? [
      {
        Area: 1,
        Rows: [
          columns.reduce((acc, col, cIdx) => {
            acc[col.columnKey] = col.defaultValue !== undefined ? col.defaultValue : (col.dataType === 'NUMERIC' ? (cIdx + 1) * 500000 : `SAMPLE_${col.columnKey}`);
            return acc;
          }, {} as Record<string, any>)
        ]
      }
    ] : [];

    const finYear = def.finYear || 2026;
    return {
      ReturnKey: normalizedKey,
      InstCode: def.instCode || '0000013',
      FinYear: finYear,
      StartDate: `${finYear}-01-01`,
      EndDate: `${finYear}-01-31`,
      ReturnItemsList: returnItems,
      DynamicItemsList: dynamicAreas,
    };
  }

  /**
   * Simulates end-to-end report transmission through the dynamic endpoint route.
   */
  public async simulateReportTransmission(
    reportKey: string,
    options?: {
      customPayload?: any;
      scenarioOverride?: SimulationScenarioConfig['mode'];
      idempotencyKey?: string;
    }
  ): Promise<{ statusCode: number; body: any; payload: any; headers: Record<string, string>; endpointConfig: any }> {
    const normalizedKey = (reportKey || '').trim().toUpperCase();
    const endpointConfig = nbeEndpointRegistry.getEndpointForReport(normalizedKey);
    const payload = options?.customPayload || this.buildSimulatedPayload(normalizedKey);

    const idempotencyKey = options?.idempotencyKey || `SIM_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const correlationId = `corr_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const headers: Record<string, string> = {
      'content-type': endpointConfig.contentType || 'application/json',
      'idempotency-key': idempotencyKey,
      'x-correlation-id': correlationId,
      'x-institution-code': payload.InstCode || '0000013',
      'x-nbe-environment': endpointConfig.environmentTarget,
      'x-nbe-auth-profile': endpointConfig.authProfileRef,
      'authorization': `Bearer NBE_${endpointConfig.authProfileRef.toUpperCase()}`,
    };

    let originalMode: SimulationScenarioConfig['mode'] | undefined;
    if (options?.scenarioOverride) {
      originalMode = this.scenario.mode;
      this.scenario.mode = options.scenarioOverride;
    }

    try {
      const result = await this.processSubmission(payload, headers);
      return {
        statusCode: result.statusCode,
        body: result.body,
        payload,
        headers,
        endpointConfig,
      };
    } finally {
      if (originalMode) {
        this.scenario.mode = originalMode;
      }
    }
  }
}

export const nbeSimulator = new NBESimulatorService();
