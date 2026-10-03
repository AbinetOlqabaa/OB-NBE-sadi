/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { configService, type ActorInfo, type ReportDefinitionSSOT, type ReportVersionSSOT } from './configService.ts';
import { auditService } from './auditService.ts';

export type IntegrationEnvironmentTarget = 'LOCAL/SIMULATOR' | 'TEST/NBE TEST' | 'PRODUCTION/NBE';

export type IdempotencyStrategy = 'HEADER_UUID' | 'HASH_SHA256' | 'SUBMISSION_VERSION_KEY';

export interface ReportIntegrationConfigSSOT {
  id?: string;
  reportKey: string;
  versionNumber?: number;
  environmentTarget: IntegrationEnvironmentTarget;
  endpointUrl: string;
  httpMethod: 'POST' | 'PUT';
  contentType: string;
  expectedResponseType: string;
  timeoutMs: number;
  nbeReportIdentifier: string;
  idempotencyStrategy: IdempotencyStrategy;
  authProfileRef: string; // Reference ONLY (never secrets/private keys)
  requestMapping?: Record<string, string>;
  responseMapping?: Record<string, string>;
  simulatorScenario?: {
    defaultScenario?: 'ALWAYS_SUCCESS' | 'VALIDATION_FAILURE' | 'AUTH_FAILURE' | 'TIMEOUT' | 'SERVER_ERROR';
    mockReceiptPrefix?: string;
    expectedLatencyMs?: number;
  };
  productionEnabled: boolean; // Strictly false by default; disabled unless explicitly permitted
  updatedBy?: string;
  updatedAt?: string;
}

export interface ManagedAuthProfile {
  id: string;
  name: string;
  description: string;
  type: 'SIMULATOR_LOCAL' | 'VAULT_OAUTH2_REF' | 'HSM_MTLS_CERT_REF';
  environment: IntegrationEnvironmentTarget;
  tlsVersion: string;
  cipherSuite: string;
  publicFingerprintSha256?: string; // Public fingerprint only, NEVER private keys
  issuer?: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

/**
 * Authoritative registry of managed authentication profiles.
 * Notice: This registry stores strictly references and public cryptographic fingerprints.
 * Under NO circumstances are private keys, passwords, client certificates, or raw tokens stored or exposed here.
 */
export const MANAGED_AUTH_PROFILES: ManagedAuthProfile[] = [
  {
    id: 'auth_local_simulator',
    name: 'Local NBE Simulator Authentication Profile',
    description: 'Internal development and simulator gateway loopback with simulated Bearer handshake.',
    type: 'SIMULATOR_LOCAL',
    environment: 'LOCAL/SIMULATOR',
    tlsVersion: 'TLSv1.3',
    cipherSuite: 'TLS_AES_256_GCM_SHA384',
    status: 'ACTIVE',
  },
  {
    id: 'auth_nbe_testbed_vault',
    name: 'NBE Central Testbed Managed OAuth2 Profile',
    description: 'Vault-brokered OAuth2 token reference targeting official NBE Sandbox / Testbed environment.',
    type: 'VAULT_OAUTH2_REF',
    environment: 'TEST/NBE TEST',
    tlsVersion: 'TLSv1.3',
    cipherSuite: 'TLS_AES_256_GCM_SHA384',
    issuer: 'NBE-Identity-Federation-CA',
    status: 'ACTIVE',
  },
  {
    id: 'auth_nbe_prod_hsm',
    name: 'NBE Production mTLS Hardware Security Module Profile',
    description: 'FIPS 140-2 Level 3 HSM client certificate reference for official statutory filing.',
    type: 'HSM_MTLS_CERT_REF',
    environment: 'PRODUCTION/NBE',
    tlsVersion: 'TLSv1.3',
    cipherSuite: 'TLS_AES_256_GCM_SHA384',
    publicFingerprintSha256: '8F:3A:91:2C:4D:11:0E:5B:78:29:40:9A:E1:82:73:64:55:12:34:CD:EF:98:76:54:32:10:AB:CD:EF:12:34:56',
    issuer: 'National Bank of Ethiopia Root CA - Regulatory Operations',
    status: 'ACTIVE',
  },
];

export interface EndpointValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class NbeEndpointRegistryService {
  private endpointStore: Map<string, ReportIntegrationConfigSSOT> = new Map();

  constructor() {
    this.seedDefaultEndpoints();
  }

  /**
   * Pre-populates default simulator endpoint configurations for canonical reports.
   */
  private seedDefaultEndpoints(): void {
    // Default fallback integration template
    const defaultReports = [
      'POBEPE001',
      'M_LCPLC001',
      'LOA_ADV_OUT_LA001',
      'TOP_20_BOR_TB001',
      'COL_SOL_18M_LL001',
      'NBE_LIQ_RES_2026',
    ];

    for (const key of defaultReports) {
      this.endpointStore.set(key, {
        reportKey: key,
        environmentTarget: 'LOCAL/SIMULATOR',
        endpointUrl: '/api/v1/nbe-simulator/submit',
        httpMethod: 'POST',
        contentType: 'application/json',
        expectedResponseType: 'application/json',
        timeoutMs: 30000,
        nbeReportIdentifier: `NBE_RET_${key}`,
        idempotencyStrategy: 'HEADER_UUID',
        authProfileRef: 'auth_local_simulator',
        productionEnabled: false,
        simulatorScenario: {
          defaultScenario: 'ALWAYS_SUCCESS',
          mockReceiptPrefix: 'NBE-REC',
          expectedLatencyMs: 150,
        },
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Validates integration endpoint syntax, protocol, environment policy, and network security.
   */
  public validateEndpoint(config: Partial<ReportIntegrationConfigSSOT>): EndpointValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.reportKey || !config.reportKey.trim()) {
      errors.push('Report key is required for integration configuration.');
    }

    if (!config.endpointUrl || !config.endpointUrl.trim()) {
      errors.push('Endpoint URL or simulator route is required.');
    } else {
      const url = config.endpointUrl.trim();

      // Check for directory traversal or illegal characters
      if (url.includes('..')) {
        errors.push('Endpoint URL cannot contain directory traversal sequences (..).');
      }

      // Check scheme
      if (url.startsWith('/')) {
        // Safe relative path
        if (!url.startsWith('/api/')) {
          warnings.push('Relative endpoint should typically reside under /api/ route namespace.');
        }
      } else {
        // Absolute URL
        try {
          const parsed = new URL(url);
          const protocol = parsed.protocol.toLowerCase();

          if (protocol !== 'http:' && protocol !== 'https:') {
            errors.push(`Disallowed endpoint protocol '${protocol}'. Only HTTP and HTTPS are permitted.`);
          }

          const hostname = parsed.hostname.toLowerCase();

          // Reject cloud metadata services and dangerous internal IPs
          if (
            hostname === '169.254.169.254' ||
            hostname === 'metadata.google.internal' ||
            hostname === '0.0.0.0' ||
            hostname.endsWith('.internal')
          ) {
            errors.push(`Host '${hostname}' is prohibited by regulatory security policy (SSRF prevention).`);
          }

          // Policy check based on target environment
          const env = config.environmentTarget || 'LOCAL/SIMULATOR';
          if (env === 'LOCAL/SIMULATOR') {
            if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
              warnings.push(`Local simulator target configured with non-local hostname '${hostname}'.`);
            }
          } else if (env === 'PRODUCTION/NBE') {
            if (protocol !== 'https:') {
              errors.push('PRODUCTION/NBE endpoint MUST use secure HTTPS protocol with mTLS.');
            }
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
              errors.push('PRODUCTION/NBE environment cannot target localhost or loopback addresses.');
            }
          }
        } catch {
          errors.push(`Malformed endpoint URL syntax: '${url}'.`);
        }
      }
    }

    // Validate HTTP Method
    if (config.httpMethod && config.httpMethod !== 'POST' && config.httpMethod !== 'PUT') {
      errors.push(`Unsupported HTTP method '${config.httpMethod}'. Only POST and PUT are permitted by NBE contract.`);
    }

    // Validate Timeout
    if (config.timeoutMs !== undefined) {
      if (typeof config.timeoutMs !== 'number' || config.timeoutMs < 1000 || config.timeoutMs > 120000) {
        errors.push('Timeout must be a numeric value between 1,000ms (1s) and 120,000ms (2 minutes).');
      }
    }

    // Validate Auth Profile Reference
    if (config.authProfileRef) {
      const profile = MANAGED_AUTH_PROFILES.find((p) => p.id === config.authProfileRef);
      if (!profile) {
        errors.push(`Unrecognized authentication profile reference '${config.authProfileRef}'.`);
      } else if (config.environmentTarget && profile.environment !== config.environmentTarget) {
        warnings.push(`Profile '${profile.name}' is designated for ${profile.environment} but assigned to ${config.environmentTarget}.`);
      }
    }

    // Production transmission safety rule
    if (config.environmentTarget === 'PRODUCTION/NBE' && config.productionEnabled) {
      // Check if global system environment permits production transmission
      const allowProd = typeof process !== 'undefined' && process.env?.ALLOW_PRODUCTION_NBE_TRANSMISSION === 'true';
      if (!allowProd) {
        warnings.push('Production transmission is marked enabled, but system runtime environment has disabled live NBE gateway routing.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Retrieves the integration configuration for a report.
   * Priority:
   * 1. Version-specific integrationConfig in SSOT (if report version published or draft)
   * 2. Report definition integrationConfig in SSOT
   * 3. In-memory registry override
   * 4. Generated default simulator endpoint configuration
   */
  public getEndpointForReport(reportKey: string, versionNumber?: number): ReportIntegrationConfigSSOT {
    const normalizedKey = (reportKey || '').trim().toUpperCase();

    // 1: Check in-memory registry override first
    if (this.endpointStore.has(normalizedKey)) {
      return this.sanitizeConfig(this.endpointStore.get(normalizedKey)!);
    }

    // 2: Check SSOT via configService
    try {
      const def = configService.getReportDefinition(normalizedKey);
      if (def) {
        const versions = configService.getReportVersions(normalizedKey);
        let targetVersion: ReportVersionSSOT | undefined;
        if (versionNumber) {
          targetVersion = versions.find((v: any) => v.versionNumber === versionNumber);
        }
        if (!targetVersion && def.activeVersionSnapshot) {
          targetVersion = def.activeVersionSnapshot;
        }
        if (!targetVersion && versions.length > 0) {
          targetVersion = versions[versions.length - 1];
        }

        if (targetVersion && (targetVersion as any).integrationConfig) {
          return this.sanitizeConfig((targetVersion as any).integrationConfig);
        }

        if ((def as any).integrationConfig) {
          return this.sanitizeConfig((def as any).integrationConfig);
        }

        // Also check displayConfiguration.integration from Phase 31 import
        if (def.displayConfiguration?.integration) {
          const imported = def.displayConfiguration.integration;
          return this.sanitizeConfig({
            reportKey: normalizedKey,
            environmentTarget: (imported.apiEndpoint && imported.apiEndpoint.startsWith('https://')) ? 'PRODUCTION/NBE' : 'LOCAL/SIMULATOR',
            endpointUrl: imported.apiEndpoint || '/api/v1/nbe-simulator/submit',
            httpMethod: imported.httpMethod || 'POST',
            contentType: imported.contentType || 'application/json',
            expectedResponseType: 'application/json',
            timeoutMs: imported.timeoutMs || 30000,
            nbeReportIdentifier: `NBE_RET_${normalizedKey}`,
            idempotencyStrategy: 'HEADER_UUID',
            authProfileRef: imported.authenticationProfile || 'auth_local_simulator',
            productionEnabled: false,
            updatedAt: def.updatedAt,
          });
        }
      }
    } catch {
      // Proceed to fallback
    }

    // 3: Dynamic default for newly imported or existing reports
    const fallbackConfig: ReportIntegrationConfigSSOT = {
      reportKey: normalizedKey,
      environmentTarget: 'LOCAL/SIMULATOR',
      endpointUrl: '/api/v1/nbe-simulator/submit',
      httpMethod: 'POST',
      contentType: 'application/json',
      expectedResponseType: 'application/json',
      timeoutMs: 30000,
      nbeReportIdentifier: `NBE_RET_${normalizedKey}`,
      idempotencyStrategy: 'HEADER_UUID',
      authProfileRef: 'auth_local_simulator',
      productionEnabled: false,
      simulatorScenario: {
        defaultScenario: 'ALWAYS_SUCCESS',
        mockReceiptPrefix: 'NBE-REC',
        expectedLatencyMs: 150,
      },
      updatedAt: new Date().toISOString(),
    };

    return this.sanitizeConfig(fallbackConfig);
  }

  /**
   * Returns all configured report endpoints.
   */
  public getAllEndpoints(options?: { activeOnly?: boolean }): ReportIntegrationConfigSSOT[] {
    const reports = configService.getReports();
    const results: ReportIntegrationConfigSSOT[] = [];
    const seen = new Set<string>();

    for (const r of reports) {
      if (options?.activeOnly && r.status === 'RETIRED') {
        continue;
      }
      results.push(this.getEndpointForReport(r.returnKey));
      seen.add(r.returnKey.toUpperCase());
    }

    // Include any in-memory store records not yet in configService
    for (const [key, conf] of this.endpointStore.entries()) {
      if (!seen.has(key.toUpperCase())) {
        results.push(this.sanitizeConfig(conf));
        seen.add(key.toUpperCase());
      }
    }

    return results;
  }

  /**
   * Updates or registers the integration configuration for a report definition.
   * Strictly enforces Administrator authorization.
   */
  public updateReportEndpoint(
    reportKey: string,
    integrationInput: Partial<ReportIntegrationConfigSSOT>,
    actor: ActorInfo
  ): ReportIntegrationConfigSSOT {
    if (!actor || actor.role !== 'ADMIN') {
      throw new Error(`Unauthorized: Administrator role is required to modify NBE API integration endpoint.`);
    }

    const normalizedKey = (reportKey || '').trim().toUpperCase();
    const existing = this.getEndpointForReport(normalizedKey);

    const merged: ReportIntegrationConfigSSOT = {
      ...existing,
      ...integrationInput,
      reportKey: normalizedKey,
      updatedBy: actor.name || actor.id,
      updatedAt: new Date().toISOString(),
    };

    // Validate
    const validation = this.validateEndpoint(merged);
    if (!validation.valid) {
      throw new Error(`Endpoint validation failed: ${validation.errors.join('; ')}`);
    }

    // Save in registry store
    this.endpointStore.set(normalizedKey, merged);

    // Also persist in configService SSOT if report exists
    try {
      const def = configService.getReportDefinition(normalizedKey);
      if (def) {
        (def as any).integrationConfig = merged;
        if (def.activeVersionSnapshot) {
          (def.activeVersionSnapshot as any).integrationConfig = merged;
        }
      }
    } catch {}

    // Audit log
    auditService.log({
      correlationId: `corr_reg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role as any,
      action: 'CONFIGURATION_UPDATE',
      entityType: 'NBE_ENDPOINT_REGISTRY',
      entityId: normalizedKey,
      details: `Updated NBE integration endpoint for ${normalizedKey} (${merged.environmentTarget}: ${merged.endpointUrl})`,
    });

    return this.sanitizeConfig(merged);
  }

  /**
   * List all managed authentication profiles.
   * Guarantees zero sensitive secrets or keys are returned.
   */
  public getAuthProfiles(): ManagedAuthProfile[] {
    return MANAGED_AUTH_PROFILES.map((p) => ({ ...p }));
  }

  /**
   * Sanitizes configuration object to guarantee zero leakage of secret or sensitive material.
   */
  private sanitizeConfig(config: ReportIntegrationConfigSSOT): ReportIntegrationConfigSSOT {
    const copy = { ...config };
    // Explicitly delete any accidental credential fields
    delete (copy as any).clientSecret;
    delete (copy as any).privateKey;
    delete (copy as any).password;
    delete (copy as any).token;
    delete (copy as any).clientCert;
    return copy;
  }
}

export const nbeEndpointRegistry = new NbeEndpointRegistryService();
