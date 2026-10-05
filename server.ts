/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { getAllReports, getReportByKey } from './src/data/report-registry.ts';
import { submissionService, DEMO_USERS } from './src/services/submissionService.ts';
import { nbeSimulator } from './src/services/nbeSimulator.ts';
import { auditService } from './src/services/auditService.ts';
import { auditorService } from './src/services/auditorService.ts';
import { ExcelService } from './src/utils/excelService.ts';
import { Phase2Pipeline } from './src/services/phase2Pipeline.ts';
import { userService } from './src/services/userService.ts';
import { departmentService } from './src/services/departmentService.ts';
import {
  OROMIA_BANK_DEPARTMENTS,
  getReportsForDepartment,
  getDepartmentForReport,
} from './src/data/organizationHierarchy.ts';
import { paginateList, type PaginatedResult } from './src/utils/paginationUtils.ts';
import { configService } from './src/services/configService.ts';
import { effectiveAccessEngine } from './src/services/effectiveAccessEngine.ts';
import { bulkOperationsEngine } from './src/services/bulkOperationsEngine.ts';
import { realtimeSsotEngine } from './src/services/realtimeSsotEngine.ts';
import { configurationGovernanceService } from './src/services/configurationGovernanceService.ts';
import { biometricService } from './src/services/biometricService.ts';
import { ValidationRemediationService } from './src/services/validationRemediationService.ts';
import { sessionService } from './src/services/sessionService.ts';
import { nbeReportPackageService } from './src/services/nbeReportPackageNormalizer.ts';
import { nbeEndpointRegistry } from './src/services/nbeEndpointRegistry.ts';
import { notificationService } from './src/services/notificationService.ts';
import { reportingAnalyticsService } from './src/services/reportingAnalyticsService.ts';
import type { UserSession } from './src/types/regulatory.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

function resolveServerPort(): number {
  if (process.env.APP_PORT) {
    const parsed = parseInt(process.env.APP_PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // If running inside the AI Studio development container where Nginx is on port 8080:
  // (In that dev container, Nginx reverse-proxies from 8080 to 3000, so Node must bind to 3000)
  if (process.env.NGINX_PORT || process.env.CONTROL_PLANE_PORT) {
    const devPort = process.env.DEFAULT_APP_PORT ? parseInt(process.env.DEFAULT_APP_PORT, 10) : 3000;
    return !isNaN(devPort) && devPort > 0 ? devPort : 3000;
  }

  // In production Cloud Run deployment (where there is no Nginx and Cloud Run probes $PORT directly):
  if (process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  if (process.env.DEFAULT_APP_PORT) {
    const parsed = parseInt(process.env.DEFAULT_APP_PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  return 8080;
}

const PORT = resolveServerPort();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security & CORS Headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Idempotency-Key, X-Correlation-ID');
  res.header('Permissions-Policy', 'camera=*, microphone=()');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// -------------------------------------------------------------
// STANDARD SERVER-SIDE PAGINATION CONTRACT (PART 7)
// -------------------------------------------------------------
export { paginateList };
export type { PaginatedResult };

function getAuthOrClientStatusCode(errMessage: string): number {
  const m = (errMessage || '').toLowerCase();
  if (
    m.includes('concurrent_modification_conflict') ||
    m.includes('concurrency') ||
    m.includes('conflict')
  ) {
    return 409;
  }
  if (
    m.includes('role violation') ||
    m.includes('department restriction') ||
    m.includes('unauthorized') ||
    m.includes('restricted') ||
    m.includes('dual control violation') ||
    m.includes('segregation') ||
    m.includes('only registered makers') ||
    m.includes('only authorized makers') ||
    m.includes('only checkers') ||
    m.includes('only registered checkers') ||
    m.includes('only the maker') ||
    m.includes('only auditor') ||
    m.includes('review denied') ||
    m.includes('forbidden') ||
    m.includes('cannot delete') ||
    m.includes('report_definition_immutable') ||
    m.includes('immutable') ||
    m.includes('denied')
  ) {
    return 403;
  }
  if (m.includes('not found')) {
    return 404;
  }
  return 400;
}

// -------------------------------------------------------------
// DYNAMIC CONFIGURATION & SSOT FOUNDATION API (PHASE 2)
// -------------------------------------------------------------

// System configuration summary, version hashes, entity counts
app.get('/api/config/summary', (req, res) => {
  res.json(configService.getConfigSummary());
});

// Real-Time Server-Sent Events (SSE) configuration update stream
app.get('/api/config/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  // Initial handshake
  res.write(`event: handshake\ndata: ${JSON.stringify({ status: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  const onConfigChanged = (data: any) => {
    res.write(`event: config_changed\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onCacheInvalidated = (data: any) => {
    res.write(`event: cache_invalidated\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onSsotEvent = (evt: any) => {
    res.write(`event: ssot_event\ndata: ${JSON.stringify(evt)}\n\n`);
  };

  configService.events.on('CONFIG_CHANGED', onConfigChanged);
  configService.events.on('CACHE_INVALIDATED', onCacheInvalidated);
  realtimeSsotEngine.events.on('SSOT_EVENT', onSsotEvent);

  req.on('close', () => {
    configService.events.off('CONFIG_CHANGED', onConfigChanged);
    configService.events.off('CACHE_INVALIDATED', onCacheInvalidated);
    realtimeSsotEngine.events.off('SSOT_EVENT', onSsotEvent);
  });
});

// Explicit cache invalidation hook
app.post('/api/config/cache/invalidate', (req, res) => {
  const { domain } = req.body;
  configService.invalidateCache(domain);
  res.json({ success: true, message: `Cache invalidated for domain: ${domain || 'ALL'}`, summary: configService.getConfigSummary() });
});

// Department Hierarchy SSOT
app.get('/api/config/departments', (req, res) => {
  const flat = req.query.flat === 'true';
  const activeOnly = req.query.activeOnly !== 'false';
  const departments = configService.getDepartments({ flat, activeOnly });
  res.json(departments);
});

app.get('/api/config/departments/:id', (req, res) => {
  const dept = configService.getDepartmentById(req.params.id);
  if (!dept) {
    res.status(404).json({ error: 'Department not found' });
    return;
  }
  const ancestors = configService.getDepartmentAncestors(req.params.id);
  const descendants = configService.getDepartmentDescendants(req.params.id);
  const assignments = configService.getDepartmentReportAssignments({ departmentId: req.params.id });
  res.json({ ...dept, ancestors, descendants, assignments });
});

app.post('/api/config/departments', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'System Administrator', role: 'ADMIN' };
  try {
    const created = configService.createDepartment(req.body, actor);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/config/departments/:id', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'System Administrator', role: 'ADMIN' };
  try {
    const updated = configService.updateDepartment(req.params.id, req.body, actor);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Report Definitions & Metadata SSOT
app.get('/api/config/reports', (req, res) => {
  const { category, frequency, status, departmentId } = req.query as any;
  const reports = configService.getReports({ category, frequency, status, departmentId });
  res.json(reports);
});

app.get('/api/config/reports/:key', (req, res) => {
  const report = configService.getReportDefinition(req.params.key);
  if (!report) {
    res.status(404).json({ error: `Report definition '${req.params.key}' not found` });
    return;
  }
  res.json(report);
});

app.get('/api/config/reports/:key/versions', (req, res) => {
  const versions = configService.getReportVersions(req.params.key);
  res.json(versions);
});

app.get('/api/config/reports/:key/versions/:version', (req, res) => {
  const vNum = parseInt(req.params.version, 10);
  const version = configService.getReportVersion(req.params.key, vNum);
  if (!version) {
    res.status(404).json({ error: `Version ${vNum} of report '${req.params.key}' not found` });
    return;
  }
  res.json(version);
});

// Create new report version without destroying historical submissions
app.post('/api/config/reports/:key/versions', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  if (!req.body.changelogSummary) {
    res.status(400).json({ error: 'Changelog summary is mandatory when creating a new report version.' });
    return;
  }
  try {
    const newVersion = configService.createReportVersion(req.params.key, req.body, actor);
    res.status(201).json(newVersion);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Admin creates new report definition
app.post('/api/config/reports', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  if (!req.body.returnKey || !req.body.name) {
    res.status(400).json({ error: 'ReturnKey and Name are required to create a report definition.' });
    return;
  }
  try {
    const result = configService.createReportDefinition(req.body, actor);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Admin updates report definition metadata
app.put('/api/config/reports/:key', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  try {
    const updated = configService.updateReportDefinition(req.params.key, req.body, actor);
    res.json(updated);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Admin retires report definition
app.post('/api/config/reports/:key/retire', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  try {
    const retired = configService.retireReport(req.params.key, actor, req.body.reason);
    res.json(retired);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Create draft version
app.post('/api/config/reports/:key/versions/draft', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  try {
    const draft = configService.createDraftVersion(req.params.key, req.body, actor);
    res.status(201).json(draft);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Update draft version
app.put('/api/config/reports/:key/versions/:version', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  const vNum = parseInt(req.params.version, 10);
  try {
    const updated = configService.updateDraftVersion(req.params.key, vNum, req.body, actor);
    res.json(updated);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Validate version (structural consistency, cycle detection, unique field codes)
app.post('/api/config/reports/:key/versions/:version/validate', (req, res) => {
  const vNum = parseInt(req.params.version, 10);
  try {
    const result = configService.validateReportVersion(req.params.key, vNum);
    res.json(result);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Preview version
app.get('/api/config/reports/:key/versions/:version/preview', (req, res) => {
  const vNum = parseInt(req.params.version, 10);
  try {
    const preview = configService.previewReportVersion(req.params.key, vNum);
    res.json(preview);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Publish version
app.post('/api/config/reports/:key/versions/:version/publish', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  const vNum = parseInt(req.params.version, 10);
  try {
    const published = configService.publishReportVersion(req.params.key, vNum, actor, req.body.changelogSummary);
    res.json(published);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// ============================================================================
// NBE JSON REPORT PACKAGE IMPORT & SCHEMA NORMALIZATION (Phase 31)
// ============================================================================

// Validate NBE report JSON package without mutating configuration
app.post('/api/config/nbe-package/validate', (req, res) => {
  try {
    const payload = req.body.package !== undefined ? req.body.package : req.body;
    const result = nbeReportPackageService.validatePackage(payload);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin imports NBE report JSON package and creates governed DRAFT configuration
app.post('/api/config/nbe-package/import', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  if (!actor || actor.role !== 'ADMIN') {
    res.status(403).json({
      error: 'Forbidden: Administrator role is strictly required to import NBE report JSON packages.',
      code: 'UNAUTHORIZED_ACCESS',
    });
    return;
  }

  try {
    const payload = req.body.package !== undefined ? req.body.package : req.body;
    const imported = nbeReportPackageService.importPackageAsDraft(payload, actor);
    res.status(201).json(imported);
  } catch (err: any) {
    const statusCode = err.message?.includes('Unauthorized') ? 403 : 400;
    res.status(statusCode).json({ error: err.message });
  }
});

// List all auditable imported source artifacts
app.get('/api/config/nbe-package/artifacts', (req, res) => {
  try {
    const artifacts = nbeReportPackageService.getAllArtifacts();
    res.json(artifacts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Retrieve specific imported source artifact by hash
app.get('/api/config/nbe-package/artifacts/:hash', (req, res) => {
  try {
    const artifact = nbeReportPackageService.getArtifactByHash(req.params.hash);
    if (!artifact) {
      res.status(404).json({ error: `NBE package artifact with hash '${req.params.hash}' not found.` });
      return;
    }
    res.json(artifact);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DYNAMIC NBE API ENDPOINT REGISTRY (Phase 32)
// ============================================================================

// List all configured report endpoints
app.get('/api/config/nbe-endpoints', (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const endpoints = nbeEndpointRegistry.getAllEndpoints({ activeOnly });
    res.json(endpoints);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get endpoint configuration for a specific report
app.get('/api/config/nbe-endpoints/:key', (req, res) => {
  try {
    const endpoint = nbeEndpointRegistry.getEndpointForReport(req.params.key);
    res.json(endpoint);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin updates endpoint configuration for a report
app.put('/api/config/nbe-endpoints/:key', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  if (!actor || actor.role !== 'ADMIN') {
    res.status(403).json({
      error: 'Forbidden: Administrator role is required to modify NBE API integration endpoint.',
      code: 'UNAUTHORIZED_ACCESS',
    });
    return;
  }

  try {
    const updated = nbeEndpointRegistry.updateReportEndpoint(req.params.key, req.body.integration || req.body, actor);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List managed authentication profile references (zero secret material exposed)
app.get('/api/config/nbe-auth-profiles', (req, res) => {
  try {
    const profiles = nbeEndpointRegistry.getAuthProfiles();
    res.json(profiles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dynamic Report Authorization Matrix for Current or Specified User
app.get('/api/config/authorized-reports', (req, res) => {
  const { userId, role, department } = req.query as any;
  let userObj: any = null;

  if (userId) {
    userObj = userService.getById(userId);
  }
  if (!userObj) {
    userObj = {
      id: userId || 'anonymous',
      role: role || 'MAKER',
      department: department || 'Credit Operations',
      specialAccessGrants: [],
    };
  }

  const authMatrix = configService.getAuthorizedReportsForUser(userObj);
  res.json(authMatrix);
});

// Explicit Relationship: Department ↔ Report
app.get('/api/config/assignments/departments', (req, res) => {
  const { departmentId, reportKey, activeOnly } = req.query as any;
  const assignments = configService.getDepartmentReportAssignments({
    departmentId,
    reportKey,
    activeOnly: activeOnly === 'true',
  });
  res.json(assignments);
});

app.post('/api/config/assignments/departments', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  try {
    const assigned = configService.assignDepartmentReport(req.body, actor);
    res.status(201).json(assigned);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/config/assignments/departments/:id', (req, res) => {
  const actor = (req.body && req.body.actor) || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  const removed = configService.removeDepartmentReportAssignment(req.params.id, actor);
  if (removed) {
    res.json({ success: true, message: 'Assignment removed' });
  } else {
    res.status(404).json({ error: 'Assignment not found' });
  }
});

// Explicit Relationship: User ↔ Report
app.get('/api/config/assignments/users', (req, res) => {
  const { userId, reportKey, duty } = req.query as any;
  const assignments = configService.getUserReportAssignments({ userId, reportKey, duty });
  res.json(assignments);
});

app.post('/api/config/assignments/users', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  try {
    const assigned = configService.assignUserReport(req.body, actor);
    res.status(201).json(assigned);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/config/assignments/users/:id', (req, res) => {
  const actor = (req.body && req.body.actor) || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  const removed = configService.removeUserReportAssignment(req.params.id, actor);
  if (removed) {
    res.json({ success: true, message: 'User assignment removed' });
  } else {
    res.status(404).json({ error: 'Assignment not found' });
  }
});

// Roles & Permissions SSOT
app.get('/api/config/roles', (req, res) => {
  res.json(configService.getRoles());
});

app.put('/api/config/roles/:code/permissions', (req, res) => {
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  const { permissions } = req.body;
  if (!Array.isArray(permissions)) {
    res.status(400).json({ error: 'Permissions array required' });
    return;
  }
  try {
    const updated = configService.updateRolePermissions(req.params.code, permissions, actor);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/config/permissions', (req, res) => {
  res.json(configService.getPermissions());
});

// Workflows SSOT
app.get('/api/config/workflows', (req, res) => {
  res.json(configService.getWorkflows());
});

// Configuration Change Audit Trail
app.get('/api/config/changes', (req, res) => {
  const limit = parseInt((req.query.limit as string) || '100', 10);
  res.json(configService.getChangeLogs(limit));
});

// -------------------------------------------------------------
// PHASE 8: CONFIGURATION GOVERNANCE, VERSIONING & ROLLBACK API
// -------------------------------------------------------------

// List proposals
app.get('/api/governance/proposals', (req, res) => {
  const { status, riskLevel, entityType, entityId } = req.query;
  const proposals = configurationGovernanceService.getProposals({
    status: status as any,
    riskLevel: riskLevel as any,
    entityType: entityType as any,
    entityId: entityId as string,
  });
  res.json(proposals);
});

// Get proposal by ID
app.get('/api/governance/proposals/:id', (req, res) => {
  const proposal = configurationGovernanceService.getProposalById(req.params.id);
  if (!proposal) {
    res.status(404).json({ error: `Proposal '${req.params.id}' not found` });
    return;
  }
  res.json(proposal);
});

// Create proposal draft
app.post('/api/governance/proposals', (req, res) => {
  const actor = req.body.proposer || {
    id: 'usr_admin',
    name: 'Compliance Administrator',
    role: 'ADMIN',
    department: 'Compliance & Legal Governance',
  };
  try {
    const proposal = configurationGovernanceService.createProposalDraft(req.body, actor);
    res.status(201).json(proposal);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Validate proposal
app.post('/api/governance/proposals/:id/validate', (req, res) => {
  const validator = req.body.validator || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  try {
    const validated = configurationGovernanceService.validateProposal(req.params.id, validator);
    res.json(validated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Approve proposal (with 4-Eyes Segregation of Duties checks)
app.post('/api/governance/proposals/:id/approve', (req, res) => {
  const approver = req.body.approver || { id: 'usr_checker', name: 'Regulatory Checker', role: 'CHECKER' };
  const comments = req.body.comments || 'Approved under NBE regulatory governance guidelines';
  try {
    const approved = configurationGovernanceService.approveProposal(req.params.id, approver, comments);
    res.json(approved);
  } catch (err: any) {
    const statusCode = err.message?.includes('SEGREGATION_OF_DUTIES_VIOLATION') ? 403 : 400;
    res.status(statusCode).json({ error: err.message });
  }
});

// Reject proposal
app.post('/api/governance/proposals/:id/reject', (req, res) => {
  const rejector = req.body.rejector || { id: 'usr_checker', name: 'Regulatory Checker', role: 'CHECKER' };
  const reason = req.body.reason || 'Rejected by regulatory governance reviewer';
  try {
    const rejected = configurationGovernanceService.rejectProposal(req.params.id, rejector, reason);
    res.json(rejected);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Publish proposal (enforces optimistic concurrency locking)
app.post('/api/governance/proposals/:id/publish', (req, res) => {
  const publisher = req.body.publisher || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  try {
    const result = configurationGovernanceService.publishProposal(req.params.id, publisher);
    res.json(result);
  } catch (err: any) {
    const statusCode = err.message?.includes('CONCURRENCY_CONFLICT') ? 409 : 400;
    res.status(statusCode).json({ error: err.message });
  }
});

// Rollback to earlier configuration version
app.post('/api/governance/proposals/rollback', (req, res) => {
  const { entityType, entityId, targetVersionNumber, reason } = req.body;
  const actor = req.body.actor || { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  if (!entityType || !entityId || targetVersionNumber === undefined || !reason) {
    res.status(400).json({ error: 'entityType, entityId, targetVersionNumber, and reason are required' });
    return;
  }
  try {
    const proposal = configurationGovernanceService.rollbackToVersion(
      entityType,
      entityId,
      Number(targetVersionNumber),
      actor,
      reason
    );
    res.status(201).json(proposal);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Explain change completion gate
app.get('/api/governance/proposals/:id/explain', (req, res) => {
  try {
    const explanation = configurationGovernanceService.explainChange(req.params.id);
    res.json(explanation);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Helper to resolve requesting user for notifications
function resolveRequestingUser(req: express.Request) {
  const userId = (req.query.userId || req.headers['x-actor-id'] || req.body?.userId) as string;
  const userEmail = (req.query.userEmail || req.headers['x-actor-email'] || req.body?.userEmail) as string;
  const headerRole = (req.headers['x-actor-role'] || req.query.role || req.body?.role) as string;
  const headerDept = (req.headers['x-actor-department'] || req.query.department || req.body?.department) as string;

  let user: any = null;
  if (userEmail) {
    user = userService.getByEmail(userEmail);
  }
  if (!user && userId) {
    user = userService.getById(userId);
  }
  if (!user) {
    user = {
      id: userId || 'anonymous',
      email: userEmail || '',
      role: headerRole || 'MAKER',
      department: headerDept || 'Credit Operations & Portfolio Management',
      allowedReportKeys: [],
    };
  } else {
    if (headerRole) user.role = headerRole;
    if (headerDept) user.department = headerDept;
  }
  if (!user.allowedReportKeys || user.allowedReportKeys.length === 0) {
    user.allowedReportKeys = userService.getAllowedReportKeysForUser(user);
  }
  return user;
}

// Authoritative Notification Center API (Phase 35)
app.get('/api/notifications', (req, res) => {
  const user = resolveRequestingUser(req);
  const result = notificationService.getNotificationsForUser(user);
  res.json(result);
});

// Mark single notification as read
app.post('/api/notifications/:id/read', (req, res) => {
  const success = notificationService.markAsRead(req.params.id);
  res.json({ success });
});

// Mark all notifications as read for current user
app.post('/api/notifications/read-all', (req, res) => {
  const user = resolveRequestingUser(req);
  const count = notificationService.markAllAsReadForUser(user);
  res.json({ success: true, count });
});

// Get user governance notifications (backward compatibility with server-side filtering)
app.get('/api/governance/notifications', (req, res) => {
  const user = resolveRequestingUser(req);
  const result = notificationService.getNotificationsForUser(user);
  res.json(result.notifications);
});

// Mark notification as read
app.post('/api/governance/notifications/:id/read', (req, res) => {
  notificationService.markAsRead(req.params.id);
  configurationGovernanceService.markNotificationAsRead(req.params.id);
  res.json({ success: true });
});

// -------------------------------------------------------------
// REGULATORY API ROUTES
// -------------------------------------------------------------

// List all 24 templates
app.get('/api/regulatory/templates', (req, res) => {
  const templates = getAllReports().map((r) => ({
    ReturnKey: r.ReturnKey,
    Code: r.Code,
    Title: r.Title,
    Category: r.Category,
    department: r.department || getDepartmentForReport(r.ReturnKey),
    Frequency: r.Frequency,
    InstCode: r.InstCode,
    FinYear: r.FinYear,
    StartDate: r.StartDate,
    EndDate: r.EndDate,
    Description: r.Description,
    itemCount: r.ReturnItemsList.length,
    dynamicAreaCount: r.DynamicItemsList.length,
    formulaCount: r.Formulas.length,
    validationRuleCount: r.ValidationRules.length,
  }));
  res.json(templates);
});

// Get specific template
app.get('/api/regulatory/templates/:key', (req, res) => {
  const template = getReportByKey(req.params.key);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json(template);
});

// Submissions list with filtering and server-side pagination
app.get('/api/regulatory/submissions', (req, res) => {
  const { status, reportKey, makerId, page, page_size, limit } = req.query as any;
  const submissions = submissionService.getByFilter({ status, reportKey, makerId });
  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(submissions, page, page_size || limit));
    return;
  }
  res.json(submissions);
});

// Phase 25: Authoritative Library Query Endpoint (Requirements 1, 2, 7, 10)
app.get('/api/regulatory/library', (req, res) => {
  const {
    search,
    lifecycleState,
    status,
    reportType,
    frequency,
    startDate,
    endDate,
    sortBy,
    sortOrder,
    page,
    pageSize,
    limit,
    userId,
    userEmail,
  } = req.query as any;

  // Resolve requesting user session
  let activeUser = DEMO_USERS[0];
  if (userEmail) {
    const found = userService.getByEmail(userEmail);
    if (found) activeUser = found as any;
  } else if (userId) {
    const found = userService.getById(userId);
    if (found) activeUser = found as any;
  }

  const result = submissionService.queryLibrary(activeUser, {
    search,
    lifecycleState,
    status,
    reportType,
    frequency,
    startDate,
    endDate,
    sortBy,
    sortOrder,
    page: page ? Number(page) : undefined,
    pageSize: pageSize || limit ? Number(pageSize || limit) : undefined,
  });

  res.json(result);
});

// Reporting Performance Analytics Endpoint (Dual-Control & Submission Trends)
app.get('/api/analytics/reporting-performance', (req, res) => {
  const { timeRangeDays, department, frequency } = req.query as any;
  try {
    const analytics = reportingAnalyticsService.getAnalytics({
      timeRangeDays: timeRangeDays ? parseInt(timeRangeDays, 10) : 30,
      department: department ? String(department) : 'ALL',
      frequency: frequency ? String(frequency) : 'ALL',
    });
    res.json(analytics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reporting Performance Analytics CSV Export
app.get('/api/analytics/reporting-performance/export', (req, res) => {
  const { timeRangeDays, department, frequency } = req.query as any;
  try {
    const analytics = reportingAnalyticsService.getAnalytics({
      timeRangeDays: timeRangeDays ? parseInt(timeRangeDays, 10) : 30,
      department: department ? String(department) : 'ALL',
      frequency: frequency ? String(frequency) : 'ALL',
    });
    const csvContent = reportingAnalyticsService.generateCsvExport(analytics);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="oromia-bank-reporting-performance-analytics-${Date.now()}.csv"`
    );
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Draft Submission Endpoint (Requirements 5, 6, 9, 10)
app.delete('/api/regulatory/submissions/:id', (req, res) => {
  const { user } = req.body || {};
  const queryUser = req.query.userEmail
    ? userService.getByEmail(req.query.userEmail as string)
    : req.query.userId
    ? userService.getById(req.query.userId as string)
    : null;
  const activeUser = user || queryUser || DEMO_USERS[0];

  try {
    const deleted = submissionService.deleteSubmission(req.params.id, activeUser);
    if (deleted) {
      res.json({ success: true, message: 'Draft deleted successfully' });
    } else {
      res.status(404).json({ error: 'Submission not found' });
    }
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Get submission by ID (with authoritative cross-department isolation)
app.get('/api/regulatory/submissions/:id', (req, res) => {
  const { userEmail, userId } = req.query as any;
  let activeUser = req.body && req.body.user ? req.body.user : null;
  if (!activeUser) {
    if (userEmail) activeUser = userService.getByEmail(userEmail as string);
    else if (userId) activeUser = userService.getById(userId as string);
  }
  if (!activeUser) activeUser = DEMO_USERS[0];

  try {
    const sub = submissionService.getAuthorizedSubmission(req.params.id, activeUser);
    res.json(sub);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 403;
    res.status(status).json({ error: err.message });
  }
});

// Phase 26: Removal Impact Assessment for Admin (Requirement 8)
app.get('/api/regulatory/submissions/:id/removal-impact', (req, res) => {
  const { userEmail, userId } = req.query as any;
  let activeUser = req.body && req.body.user ? req.body.user : null;
  if (!activeUser) {
    if (userEmail) activeUser = userService.getByEmail(userEmail as string);
    else if (userId) activeUser = userService.getById(userId as string);
  }
  if (!activeUser) activeUser = DEMO_USERS[0];

  try {
    const assessment = submissionService.getRemovalImpactAssessment(req.params.id, activeUser);
    res.json(assessment);
  } catch (err: any) {
    const status = err.message.includes('not found')
      ? 404
      : getAuthOrClientStatusCode(err.message);
    res.status(status).json({ error: err.message });
  }
});

// Phase 26: Admin Governed Removal / Archiving / Voiding (Requirements 7 & 8)
app.post('/api/regulatory/submissions/:id/admin-remove', (req, res) => {
  const { action, reason, confirmed, user } = req.body || {};
  const queryUser = req.query.userEmail
    ? userService.getByEmail(req.query.userEmail as string)
    : req.query.userId
    ? userService.getById(req.query.userId as string)
    : null;
  const activeUser = user || queryUser || DEMO_USERS[0];

  try {
    const result = submissionService.adminGovernedRemoveSubmission(req.params.id, activeUser, {
      action,
      reason,
      confirmed: Boolean(confirmed),
    });
    res.json(result);
  } catch (err: any) {
    const status = err.message.includes('not found')
      ? 404
      : getAuthOrClientStatusCode(err.message);
    res.status(status).json({ error: err.message });
  }
});

// Phase 26: Flag Submission for Review (Requirement 1)
app.post('/api/regulatory/submissions/:id/flag', (req, res) => {
  const { reason, flag, user } = req.body || {};
  const queryUser = req.query.userEmail
    ? userService.getByEmail(req.query.userEmail as string)
    : req.query.userId
    ? userService.getById(req.query.userId as string)
    : null;
  const activeUser = user || queryUser || DEMO_USERS[0];

  try {
    const updated = submissionService.flagSubmission(
      req.params.id,
      activeUser,
      reason || 'Flagged for compliance review',
      flag !== undefined ? Boolean(flag) : true
    );
    res.json(updated);
  } catch (err: any) {
    const status = err.message.includes('not found')
      ? 404
      : getAuthOrClientStatusCode(err.message);
    res.status(status).json({ error: err.message });
  }
});

// Phase 26: Add Review/Audit Comment (Requirements 1 & 2)
app.post('/api/regulatory/submissions/:id/comment', (req, res) => {
  const { text, category, user } = req.body || {};
  const queryUser = req.query.userEmail
    ? userService.getByEmail(req.query.userEmail as string)
    : req.query.userId
    ? userService.getById(req.query.userId as string)
    : null;
  const activeUser = user || queryUser || DEMO_USERS[0];

  if (!text || !text.trim()) {
    res.status(400).json({ error: 'Comment text is required.' });
    return;
  }

  try {
    const updated = submissionService.addSubmissionComment(
      req.params.id,
      activeUser,
      text.trim(),
      category || 'GENERAL'
    );
    res.json(updated);
  } catch (err: any) {
    const status = err.message.includes('not found')
      ? 404
      : getAuthOrClientStatusCode(err.message);
    res.status(status).json({ error: err.message });
  }
});

// Phase 33: Reset Draft to Template Defaults (Requirement 10)
app.post('/api/regulatory/submissions/:id/reset-defaults', (req, res) => {
  const { user } = req.body || {};
  const queryUser = req.query.userEmail
    ? userService.getByEmail(req.query.userEmail as string)
    : req.query.userId
    ? userService.getById(req.query.userId as string)
    : null;
  const activeUser = user || queryUser || DEMO_USERS[0];

  try {
    const updated = submissionService.resetToTemplateDefaults(req.params.id, activeUser);
    res.json(updated);
  } catch (err: any) {
    const status = err.message.includes('not found')
      ? 404
      : getAuthOrClientStatusCode(err.message);
    res.status(status).json({ error: err.message });
  }
});

// Phase 26: Dossier Audit Events Inspection (Requirement 2)
app.get('/api/regulatory/submissions/:id/audit-events', (req, res) => {
  const { userEmail, userId } = req.query as any;
  let activeUser = req.body && req.body.user ? req.body.user : null;
  if (!activeUser) {
    if (userEmail) activeUser = userService.getByEmail(userEmail as string);
    else if (userId) activeUser = userService.getById(userId as string);
  }
  if (!activeUser) activeUser = DEMO_USERS[0];

  try {
    submissionService.getAuthorizedSubmission(req.params.id, activeUser);
    const events = auditService.query({ entityId: req.params.id });
    res.json({ events });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 403;
    res.status(status).json({ error: err.message });
  }
});

// Create new report draft
app.post('/api/regulatory/submissions', (req, res) => {
  const { reportKey, user } = req.body;
  if (!reportKey) {
    res.status(400).json({ error: 'Missing reportKey' });
    return;
  }
  const activeUser = user || DEMO_USERS[0];
  try {
    const submission = submissionService.createSubmission(reportKey, activeUser);
    res.status(201).json(submission);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Update draft values & dynamic rows
app.put('/api/regulatory/submissions/:id', (req, res) => {
  const { values, dynamicRows, user, expectedVersion } = req.body;
  const activeUser = user || DEMO_USERS[0];

  // Phase 34: Maker Template Governance & Immutability Enforcement
  // Maker enters and edits report values only. Maker cannot change report title,
  // subtitle, section title, row title, column title, field code, formula definition,
  // NBE mapping, API endpoint or validation rule.
  const forbiddenDefinitionKeys = [
    'title',
    'name',
    'subtitle',
    'templateSnapshot',
    'reportKey',
    'formulas',
    'validationRules',
    'nbeMapping',
    'endpointMetadata',
    'apiEndpoint',
    'sections',
    'rows',
    'columns',
    'fieldCodes',
    'fields',
    'returnItemsList',
    'dynamicItemsList',
  ];

  const presentForbidden = forbiddenDefinitionKeys.filter((k) => req.body[k] !== undefined);
  if (presentForbidden.length > 0 && activeUser.role === 'MAKER') {
    res.status(403).json({
      error: `REPORT_DEFINITION_IMMUTABLE: Maker cannot change report definition metadata ('${presentForbidden.join(', ')}'). Only business values and schedule data entry are allowed.`,
      code: 'REPORT_DEFINITION_IMMUTABLE',
    });
    return;
  }

  try {
    const updated = submissionService.updateDraft(
      req.params.id,
      values || {},
      dynamicRows || {},
      activeUser,
      expectedVersion !== undefined ? Number(expectedVersion) : undefined
    );
    res.json(updated);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Reuse historical/submitted report as new draft
app.post('/api/regulatory/submissions/:id/reuse', (req, res) => {
  const { user } = req.body;
  const activeUser = user || DEMO_USERS[0];
  try {
    const reused = submissionService.reuseSubmission(req.params.id, activeUser);
    res.status(201).json(reused);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Validate submission (authoritative summary)
app.post('/api/regulatory/submissions/:id/validate', (req, res) => {
  try {
    const summary = submissionService.validateSubmission(req.params.id);
    res.json(summary);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Phase 24: Authoritative Normalized Validation & Remediation Assistant Inspection
app.get('/api/regulatory/submissions/:id/remediation', (req, res) => {
  try {
    const normalizedSummary = submissionService.validateSubmissionNormalized(req.params.id);
    res.json(normalizedSummary);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Phase 24: Authoritative Remediation Auto-Fix Execution
app.post('/api/regulatory/submissions/:id/remediation/apply', (req, res) => {
  const { proposedFix, user, expectedVersion } = req.body;
  const activeUser = user || DEMO_USERS[0];
  try {
    if (!proposedFix) {
      res.status(400).json({ error: 'Missing proposedFix payload' });
      return;
    }
    const result = submissionService.remediateSubmission(
      req.params.id,
      proposedFix,
      activeUser,
      expectedVersion !== undefined ? Number(expectedVersion) : undefined
    );
    res.json(result);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Phase 24: Authoritative Real-Time Payload Validation without Persisting
app.post('/api/regulatory/validate-payload', (req, res) => {
  const { metadata, values, dynamicRows } = req.body;
  try {
    if (!metadata) {
      res.status(400).json({ error: 'Missing report metadata' });
      return;
    }
    const summary = ValidationRemediationService.normalizeReportValidation(
      metadata,
      values || {},
      dynamicRows || {}
    );
    res.json(summary);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Phase 36: Server-side query for eligible Checkers for a given report
app.get('/api/regulatory/reports/:reportKey/eligible-checkers', (req, res) => {
  const { makerId, department } = req.query;
  const makerUser = makerId ? userService.getById(String(makerId)) : DEMO_USERS[0];
  const userSession: UserSession = makerUser
    ? {
        id: makerUser.id,
        name: makerUser.name,
        email: makerUser.email,
        role: makerUser.role,
        institutionCode: makerUser.institutionCode,
        department: (department as string) || makerUser.department,
        employeeId: makerUser.employeeId,
        specialAccessGrants: makerUser.specialAccessGrants || [],
      }
    : DEMO_USERS[0];

  try {
    const eligible = effectiveAccessEngine.getEligibleCheckersForReport(req.params.reportKey, userSession);
    res.json({
      reportKey: req.params.reportKey,
      department: userSession.department,
      count: eligible.length,
      checkers: eligible,
    });
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Maker submit to Checker (Phase 36: supports selectedCheckerIds)
app.post('/api/regulatory/submissions/:id/submit', (req, res) => {
  const { user, comment, expectedVersion, selectedCheckerIds } = req.body;
  const activeUser = user || DEMO_USERS[0];
  try {
    const updated = submissionService.submitToChecker(
      req.params.id,
      activeUser,
      comment,
      expectedVersion !== undefined ? Number(expectedVersion) : undefined,
      Array.isArray(selectedCheckerIds) ? selectedCheckerIds : undefined
    );
    res.json(updated);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Phase 36: Checker accepts/opens review
app.post('/api/regulatory/submissions/:id/accept-review', (req, res) => {
  const { user } = req.body;
  const activeUser = user || DEMO_USERS[1];
  try {
    const updated = submissionService.acceptReview(req.params.id, activeUser);
    res.json(updated);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Checker review (Approve, Reject, Request Correction)
app.post('/api/regulatory/submissions/:id/review', (req, res) => {
  const { action, user, comment } = req.body;
  if (!action || !['APPROVE', 'REJECT', 'REQUEST_CORRECTION'].includes(action)) {
    res.status(400).json({ error: 'Invalid review action' });
    return;
  }
  const activeUser = user || DEMO_USERS[2]; // Default checker
  try {
    const updated = submissionService.reviewSubmission(req.params.id, action, activeUser, comment);
    res.json(updated);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Deliver approved submission to NBE
app.post('/api/regulatory/submissions/:id/deliver', async (req, res) => {
  const { user } = req.body;
  const activeUser = user || DEMO_USERS[0];
  try {
    const result = await submissionService.deliverToNBE(req.params.id, activeUser);
    res.json(result);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Batch synchronize drafts from IndexedDB (remote NBE site visits)
app.post('/api/regulatory/submissions/batch-sync', (req, res) => {
  const { submissions } = req.body;
  if (!Array.isArray(submissions)) {
    res.status(400).json({ error: 'Expected submissions array' });
    return;
  }

  let syncedCount = 0;
  for (const incoming of submissions) {
    if (!incoming || !incoming.id) continue;
    const existing = submissionService.getById(incoming.id);
    if (!existing) {
      (submissionService as any).submissions.set(incoming.id, incoming);
      syncedCount++;
    } else {
      const incomingTime = new Date(incoming.updatedAt || 0).getTime();
      const existingTime = new Date(existing.updatedAt || 0).getTime();
      if (incomingTime >= existingTime) {
        (submissionService as any).submissions.set(incoming.id, incoming);
        syncedCount++;
      }
    }

    auditService.log({
      actorId: incoming.makerId || 'mkr_site_visit',
      actorName: incoming.makerName || 'Field Examiner',
      actorRole: 'MAKER',
      action: 'OFFLINE_SYNC_SUBMISSION',
      entityType: 'REPORT_SUBMISSION',
      entityId: incoming.id,
      correlationId: `corr_sync_${Date.now()}`,
      details: `[NBE Remote Site Visit] Synchronized draft return ${incoming.reportKey} (v${incoming.version}) from field IndexedDB storage`,
    });
  }

  res.json({
    success: true,
    syncedCount,
    submissions: submissionService.getAll(),
  });
});

// Export submission to XLSX
app.get('/api/regulatory/submissions/:id/export/xlsx', (req, res) => {
  const sub = submissionService.getById(req.params.id);
  if (!sub) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }
  const template = getReportByKey(sub.reportKey);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const binary = ExcelService.exportToBinary(template, sub.values, sub.dynamicRows);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${sub.reportKey}_${sub.periodYear}_v${sub.version}.xlsx"`);
  res.send(Buffer.from(binary));
});

// -------------------------------------------------------------
// USER AUTHENTICATION & ACCESS CONTROL (ADMIN, MAKER, CHECKER, AUDITOR)
// -------------------------------------------------------------

app.post('/api/auth/login', (req, res) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, message: 'Corporate email and password are required to sign in.' });
    return;
  }
  const deviceInfo = (req.headers['user-agent'] as string) || 'Institutional Workstation';
  const result = userService.login(email, password, Boolean(rememberMe), deviceInfo);

  if (result.success && result.user) {
    // If Remember Me was requested, set secure HttpOnly cookie
    if (result.rememberMe && result.persistentSession) {
      res.setHeader('Set-Cookie', result.persistentSession.cookieHeader);
    } else {
      // If unchecked, ensure any leftover persistent cookie is cleared
      res.setHeader('Set-Cookie', sessionService.formatClearedCookieHeader());
    }

    auditService.log({
      actorId: result.user.id,
      actorName: result.user.name,
      actorRole: result.user.role,
      action: 'USER_LOGIN',
      entityType: 'AUTH',
      entityId: result.user.id,
      correlationId: `corr_auth_${Date.now()}`,
      details: `User logged in successfully as ${result.user.role}. Remember Me: ${Boolean(rememberMe)}. (Req 1, 4)`,
    });
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

// Phase 29: Persistent Session Verification Endpoint (Req 4, 6, 7, 8, 9, 10, 12)
app.get('/api/auth/session', (req, res) => {
  const cookieHeader = req.headers.cookie;
  let token = sessionService.extractTokenFromCookieHeader(cookieHeader);
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (!token && req.headers['x-remember-token']) {
    token = String(req.headers['x-remember-token']).trim();
  }

  if (!token) {
    res.status(401).json({
      success: false,
      code: 'NO_SESSION',
      message: 'No active persistent session found.',
    });
    return;
  }

  const ver = sessionService.verifyToken(token, { updateLastUsed: true });
  if (!ver.valid || !ver.user || !ver.session) {
    res.setHeader('Set-Cookie', sessionService.formatClearedCookieHeader());
    res.status(401).json({
      success: false,
      code: ver.code || 'TOKEN_INVALID',
      message: ver.message || 'Session verification failed.',
    });
    return;
  }

  // Session is valid
  res.json({
    success: true,
    user: ver.user,
    session: {
      id: ver.session.id,
      expiresAt: ver.session.expiresAt,
      lastUsedAt: ver.session.lastUsedAt,
      createdAt: ver.session.createdAt,
      deviceInfo: ver.session.deviceInfo,
    },
    requiresBiometricVerification: ver.requiresBiometricVerification,
  });
});

// Phase 29: Explicit Logout Endpoint (Req 8)
app.post('/api/auth/logout', (req, res) => {
  const cookieHeader = req.headers.cookie;
  let token = sessionService.extractTokenFromCookieHeader(cookieHeader);
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (!token && req.headers['x-remember-token']) {
    token = String(req.headers['x-remember-token']).trim();
  }
  const sessionId = req.body?.sessionId || token;

  if (sessionId) {
    sessionService.revokeSession(sessionId, 'EXPLICIT_LOGOUT');
  }

  res.setHeader('Set-Cookie', sessionService.formatClearedCookieHeader());
  res.json({
    success: true,
    message: 'Explicit portal sign out complete. Persistent session permanently invalidated. (Req 8)',
  });
});

// Phase 29: List Active Sessions for User (Req 7, 11)
app.get('/api/auth/sessions', (req, res) => {
  const email = (req.query.email as string) || '';
  if (!email) {
    res.status(400).json({ success: false, message: 'Email query parameter required.' });
    return;
  }
  const activeSessions = sessionService.getUserActiveSessions(email);
  res.json({
    success: true,
    sessions: activeSessions.map((s) => ({
      id: s.id,
      deviceInfo: s.deviceInfo,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      isRevoked: s.isRevoked,
    })),
  });
});

// Phase 29: Revoke Session Endpoint (Req 7, 11)
app.post('/api/auth/sessions/revoke', (req, res) => {
  const { sessionId, email, revokeAll } = req.body;
  if (revokeAll && email) {
    const result = sessionService.revokeAllUserSessions(email, 'ADMIN_REVOCATION');
    res.json({ success: true, message: `All ${result.revokedCount} active sessions revoked.` });
    return;
  }
  if (sessionId) {
    const rev = sessionService.revokeSession(sessionId, 'ADMIN_REVOCATION');
    res.setHeader('Set-Cookie', rev.clearedCookieHeader);
    res.json({ success: true, message: rev.message });
    return;
  }
  res.status(400).json({ success: false, message: 'sessionId or email with revokeAll required.' });
});

// Development Seed Data Reset Endpoint
app.post('/api/auth/seed-data/reset', (req, res) => {
  const result = userService.resetDevelopmentSeedData();
  auditService.log({
    actorId: 'system_dev',
    actorName: 'Development Seeder',
    actorRole: 'ADMIN',
    action: 'SEED_DATA_RESET',
    entityType: 'SYSTEM',
    entityId: 'seed_users',
    correlationId: `corr_seed_${Date.now()}`,
    details: 'Development seed accounts re-initialized with zero pre-seeded biometrics',
  });
  res.json(result);
});

// Development Seed Data Reference Endpoint
app.get('/api/auth/seed-data', (req, res) => {
  res.json({
    success: true,
    users: userService.getDevelopmentSeedSummary(),
  });
});

app.post('/api/auth/register', (req, res) => {
  const result = userService.register(req.body);
  if (result.success && result.user) {
    auditService.log({
      actorId: result.user.id,
      actorName: result.user.name,
      actorRole: result.user.role,
      action: 'USER_REGISTER',
      entityType: 'USER',
      entityId: result.user.id,
      correlationId: `corr_reg_${Date.now()}`,
      details: `New registration submitted for role ${result.user.role}. Status: PENDING_APPROVAL`,
    });
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

// Send OTP code (for Registration or Password Reset)
app.post('/api/auth/otp/send', (req, res) => {
  const { email, purpose } = req.body;
  if (!email) {
    res.status(400).json({ success: false, message: 'Email address is required.' });
    return;
  }
  const result = userService.generateOtp(email, purpose || 'REGISTRATION');
  res.json(result);
});

// Verify OTP code
app.post('/api/auth/otp/verify', (req, res) => {
  const { email, code, purpose } = req.body;
  if (!email || !code) {
    res.status(400).json({ success: false, message: 'Email and verification code are required.' });
    return;
  }
  const result = userService.verifyOtp(email, code, purpose || 'REGISTRATION');
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Reset Password
app.post('/api/auth/reset-password', (req, res) => {
  const { email, otpCode, newPassword } = req.body;
  if (!email || !otpCode || !newPassword) {
    res.status(400).json({ success: false, message: 'Email, OTP code, and new password are required.' });
    return;
  }
  const result = userService.resetPassword(email, otpCode, newPassword);
  if (result.success && result.user) {
    auditService.log({
      actorId: result.user.id,
      actorName: result.user.name,
      actorRole: result.user.role,
      action: 'PASSWORD_RESET',
      entityType: 'AUTH',
      entityId: result.user.id,
      correlationId: `corr_pwd_${Date.now()}`,
      details: `Password reset successfully via OTP verification for ${result.user.email}`,
    });
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// PHASE 10 - 14: Biometric Architecture, Security, Privacy & Compliance Endpoints

// Biometric Request ID & Security Boundary Middleware
app.use('/api/auth/biometrics', (req, res, next) => {
  const reqId = (req.headers['x-request-id'] as string) || `req_bio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('X-Request-ID', reqId);
  res.setHeader('X-Biometric-TLS-Expectation', 'TLS_1_3_STRICT');
  next();
});

// 0. Biometric Service Boundary Health Check
app.get('/api/auth/biometrics/health', (_req, res) => {
  const health = biometricService.getServiceHealth();
  res.json(health);
});

// 0b. User-Facing Privacy & Statutory Compliance Disclosure
app.get('/api/auth/biometrics/privacy-disclosure', (_req, res) => {
  const disclosure = biometricService.getPrivacyDisclosure();
  res.json({ success: true, disclosure });
});

// 1. Issue fresh cryptographic challenge (nonce)
app.post('/api/auth/biometrics/challenge', (req, res) => {
  const { email, type, purpose, rpId, origin } = req.body;
  if (!email || !type || !purpose) {
    res.status(400).json({ success: false, message: 'email, type, and purpose required.' });
    return;
  }
  try {
    const challenge = biometricService.createChallenge(email, type, purpose, rpId, origin);
    res.json({ success: true, challenge });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 2. WebAuthn Registration Options
app.post('/api/auth/biometrics/webauthn/register-options', (req, res) => {
  const { email, rpId, origin } = req.body;
  if (!email) {
    res.status(400).json({ success: false, message: 'Email is required.' });
    return;
  }
  try {
    const data = biometricService.generateWebAuthnRegistrationOptions(email, rpId, origin);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 3. WebAuthn Registration Verify
app.post('/api/auth/biometrics/webauthn/register-verify', (req, res) => {
  const { email, challengeId, response } = req.body;
  if (!email || !challengeId || !response) {
    res.status(400).json({ success: false, message: 'Email, challengeId, and response payload required.' });
    return;
  }
  const result = biometricService.verifyWebAuthnRegistration(email, challengeId, response);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// 4. WebAuthn Authentication Options
app.post('/api/auth/biometrics/webauthn/auth-options', (req, res) => {
  const { email, rpId } = req.body;
  if (!email) {
    res.status(400).json({ success: false, message: 'Email is required.' });
    return;
  }
  try {
    const data = biometricService.generateWebAuthnAuthenticationOptions(email, rpId);
    res.json({ success: true, ...data });
  } catch (err: any) {
    const status = err.message?.includes('locked') ? 429 : 400;
    res.status(status).json({ success: false, message: err.message, lockedOut: err.message?.includes('locked') });
  }
});

// 5. WebAuthn Authentication Verify
app.post('/api/auth/biometrics/webauthn/auth-verify', (req, res) => {
  const { email, challengeId, response } = req.body;
  if (!email || !challengeId || !response) {
    res.status(400).json({ success: false, message: 'Email, challengeId, and response payload required.' });
    return;
  }
  const result = biometricService.verifyWebAuthnAssertion(email, challengeId, response);
  if (result.success) {
    res.json(result);
  } else {
    res.status(result.lockedOut ? 429 : 401).json(result);
  }
});

// 6. Server-Authoritative Face Enrollment
app.post('/api/auth/biometrics/face/enroll', (req, res) => {
  const { email, challengeId, featureVector, qualityMetrics, livenessEvidence, deviceLabel } = req.body;
  if (!email || !challengeId || !featureVector) {
    res.status(400).json({ success: false, message: 'Email, challengeId, and featureVector required.' });
    return;
  }
  const result = biometricService.enrollFaceBiometric(
    email,
    challengeId,
    featureVector,
    qualityMetrics,
    livenessEvidence,
    deviceLabel
  );
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// 7. Server-Authoritative Face Verification
app.post('/api/auth/biometrics/face/verify', (req, res) => {
  const { email, challengeId, featureVector, qualityMetrics, livenessEvidence } = req.body;
  if (!email || !challengeId || !featureVector) {
    res.status(400).json({ success: false, message: 'Email, challengeId, and featureVector required.' });
    return;
  }
  const result = biometricService.verifyFaceBiometric({
    email,
    challengeId,
    featureVector,
    qualityMetrics,
    livenessEvidence,
  });
  if (result.success) {
    res.json(result);
  } else {
    res.status(result.lockedOut ? 429 : 401).json(result);
  }
});

// 8. Authoritative User Biometric Lifecycle State
app.get('/api/auth/biometrics/lifecycle/:email', (req, res) => {
  const targetEmail = req.params.email.toLowerCase().trim();
  const actorEmail = ((req.headers['x-actor-email'] as string) || (req.query.actorEmail as string) || '').toLowerCase().trim();

  // Cross-user visibility restriction to prevent account enumeration / reconnaissance
  if (actorEmail && actorEmail !== targetEmail) {
    const actor = userService.getByEmail(actorEmail);
    if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'AUDITOR')) {
      res.status(403).json({ success: false, message: 'Security violation: Unauthorized access to officer lifecycle state.' });
      return;
    }
  }

  const state = biometricService.getBiometricUserState(targetEmail);
  res.json(state);
});

// 8b. Comprehensive Biometric Security Center & Device Metadata (Safe, Non-invertible)
app.get('/api/auth/biometrics/security-center/:email', (req, res) => {
  const targetEmail = req.params.email.toLowerCase().trim();
  const actorEmail = ((req.headers['x-actor-email'] as string) || (req.query.actorEmail as string) || '').toLowerCase().trim();

  // Cross-user visibility restriction to prevent unauthorized reconnaissance
  if (actorEmail && actorEmail !== targetEmail) {
    const actor = userService.getByEmail(actorEmail);
    if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'AUDITOR')) {
      res.status(403).json({ success: false, message: 'Security violation: Unauthorized access to officer security center details.' });
      return;
    }
  }

  const details = biometricService.getSecurityCenterDetails(targetEmail);
  if (!details) {
    res.status(404).json({ success: false, message: 'Officer account not found.' });
    return;
  }
  res.json({ success: true, ...details });
});

// 9. Suspend Biometric Credential
app.post('/api/auth/biometrics/suspend', (req, res) => {
  const { email, credentialId, reason, actorEmail } = req.body;
  if (!email || !credentialId) {
    res.status(400).json({ success: false, message: 'Email and credentialId required.' });
    return;
  }
  const result = biometricService.suspendCredential(email, credentialId, reason || 'Suspended by user/admin', actorEmail);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// 9b. Resume / Reactivate Suspended Credential
app.post('/api/auth/biometrics/resume', (req, res) => {
  const { email, credentialId, reason, actorEmail, password } = req.body;
  if (!email || !credentialId) {
    res.status(400).json({ success: false, message: 'Email and credentialId required.' });
    return;
  }
  const result = biometricService.resumeCredential(email, credentialId, reason, actorEmail, password);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// 10. Revoke Biometric Credential (with step-up password support)
app.post('/api/auth/biometrics/revoke', (req, res) => {
  const { email, credentialId, reason, actorEmail, password } = req.body;
  if (!email || !credentialId) {
    res.status(400).json({ success: false, message: 'Email and credentialId required.' });
    return;
  }
  const result = biometricService.revokeCredential(email, credentialId, reason || 'Revoked by user/admin', actorEmail, password);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// 10b. Rename Device Label
app.post('/api/auth/biometrics/device/rename', (req, res) => {
  const { email, credentialId, newLabel, actorEmail } = req.body;
  if (!email || !credentialId || !newLabel) {
    res.status(400).json({ success: false, message: 'Email, credentialId, and newLabel required.' });
    return;
  }
  const result = biometricService.renameDeviceLabel(email, credentialId, newLabel, actorEmail);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// 10b. Verify Credentials and Prior Enrollment for Reset
app.post('/api/auth/biometrics/reset/verify', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, message: 'Corporate email and password are required.' });
    return;
  }
  const result = biometricService.verifyResetCredentialsAndEnrollment(email, password);
  if (result.success) {
    res.json(result);
  } else {
    res.status(result.validCredentials ? 422 : 401).json(result);
  }
});

// 11. Request Step-up Authenticated Reset
app.post('/api/auth/biometrics/reset/request', (req, res) => {
  const { email, type, password, reason, actorEmail } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, message: 'Email and password required for reset authorization.' });
    return;
  }
  const result = biometricService.requestReset(email, type || 'ALL', password, reason || 'User requested reset', actorEmail);
  if (result.success) {
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

// 12. Execute Authorized Reset
app.post('/api/auth/biometrics/reset/execute', (req, res) => {
  const { email, resetToken, actorEmail } = req.body;
  if (!email || !resetToken) {
    res.status(400).json({ success: false, message: 'Email and resetToken required.' });
    return;
  }
  const result = biometricService.executeReset(email, resetToken, actorEmail);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// 12b. Administrative Direct Reset (Supervisor Emergency Override)
app.post('/api/auth/biometrics/admin/reset', (req, res) => {
  const { adminEmail, targetEmail, type, reason, adminPassword } = req.body;
  if (!adminEmail || !targetEmail || !adminPassword) {
    res.status(400).json({ success: false, message: 'adminEmail, targetEmail, and adminPassword required.' });
    return;
  }
  const result = biometricService.adminResetBiometrics(adminEmail, targetEmail, type || 'ALL', reason || 'Administrative emergency reset', adminPassword);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// 12c. Administrative Unlock Account Lockout
app.post('/api/auth/biometrics/admin/unlock', (req, res) => {
  const { adminEmail, targetEmail, reason } = req.body;
  if (!adminEmail || !targetEmail) {
    res.status(400).json({ success: false, message: 'adminEmail and targetEmail required.' });
    return;
  }
  const result = biometricService.adminUnlockAccount(adminEmail, targetEmail, reason || 'Administrative unlock');
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// 12d. Biometric Matching Threshold & Optical Governance Settings (Phase 17)
app.get('/api/auth/biometrics/settings', (req, res) => {
  const settings = biometricService.getBiometricSettings();
  res.json({ success: true, settings });
});

app.post('/api/auth/biometrics/settings', (req, res) => {
  const { adminEmail, settings } = req.body;
  if (!adminEmail || !settings) {
    res.status(400).json({ success: false, message: 'adminEmail and settings payload required.' });
    return;
  }
  const result = biometricService.updateBiometricSettings(settings, adminEmail);
  if (result.success) {
    res.json(result);
  } else {
    res.status(403).json(result);
  }
});

// 13. Unlock Rate Limited Lockout via Step-Up Password
app.post('/api/auth/biometrics/unlock', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, message: 'Email and password required.' });
    return;
  }
  const result = biometricService.unlockWithStepUp(email, password);
  if (result.success) {
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

// 14a. Enforce Retention & Purge Expired Biometric Data
app.post('/api/auth/biometrics/retention/purge', (req, res) => {
  const { actorEmail } = req.body;
  if (actorEmail) {
    const actor = userService.getByEmail(actorEmail.toLowerCase().trim());
    if (!actor || actor.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Security violation: Administrator privilege required to purge biometric data.' });
      return;
    }
  }
  const result = biometricService.enforceRetentionRules();
  res.json({ success: true, ...result });
});

// 14b. Export Sanitized Compliance Archive for NBE Audits
app.post('/api/auth/biometrics/compliance/export', (req, res) => {
  const { requesterEmail, targetEmail } = req.body;
  if (!requesterEmail) {
    res.status(400).json({ success: false, message: 'requesterEmail required.' });
    return;
  }
  try {
    const archive = biometricService.exportComplianceArchive(requesterEmail, targetEmail);
    res.json({ success: true, archive });
  } catch (err: any) {
    res.status(403).json({ success: false, message: err.message });
  }
});

// Register biometric credentials on server (backward compatibility)
app.post('/api/auth/biometrics/register', (req, res) => {
  const { email, credential } = req.body;
  if (!email || !credential || !credential.type) {
    res.status(400).json({ success: false, message: 'Email and valid credential payload required.' });
    return;
  }
  const result = userService.registerBiometric(email, credential);
  if (result.success && result.user) {
    auditService.log({
      actorId: result.user.id,
      actorName: result.user.name,
      actorRole: result.user.role,
      action: 'BIOMETRIC_ENROLLED',
      entityType: 'USER',
      entityId: result.user.id,
      correlationId: `corr_bio_${Date.now()}`,
      details: `Enrolled ${credential.type} biometric credential for ${result.user.email}`,
    });
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Verify biometric login on server (backward compatibility)
app.post('/api/auth/biometrics/verify', (req, res) => {
  const { email, type, credentialId, faceHash } = req.body;
  if (!email || !type) {
    res.status(400).json({ success: false, message: 'Email and biometric type required.' });
    return;
  }
  const result = userService.verifyBiometric(email, type, credentialId, faceHash);
  if (result.success && result.user) {
    auditService.log({
      actorId: result.user.id,
      actorName: result.user.name,
      actorRole: result.user.role,
      action: 'BIOMETRIC_LOGIN',
      entityType: 'AUTH',
      entityId: result.user.id,
      correlationId: `corr_bio_login_${Date.now()}`,
      details: `Logged in via ${type} biometric verification (${result.user.role})`,
    });
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

// Get enrolled biometrics status for email
app.get('/api/auth/biometrics/status/:email', (req, res) => {
  const status = userService.getBiometricStatus(req.params.email);
  res.json(status);
});

app.get('/api/users', (req, res) => {
  const { search, role, status, department, sortBy, sortOrder, page, page_size, limit } = req.query as any;
  const filtered = userService.getFilteredUsers({ search, role, status, department, sortBy, sortOrder });
  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(filtered, page, page_size || limit));
    return;
  }
  res.json(filtered);
});

// Single user details
app.get('/api/users/:id', (req, res) => {
  const user = userService.getById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const { password, ...safe } = user;
  res.json(safe);
});

// Check if user can be deleted safely
app.get('/api/users/:id/can-delete', (req, res) => {
  const check = userService.canDeleteUser(req.params.id);
  res.json(check);
});

// Get user specific audit trail
app.get('/api/users/:id/audit', (req, res) => {
  const history = userService.getUserAuditHistory(req.params.id);
  const { page, page_size, limit } = req.query as any;
  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(history, page, page_size || limit));
    return;
  }
  res.json(history);
});

// Get dynamically resolved authorized reports for user
app.get('/api/users/:id/authorized-reports', (req, res) => {
  const user = userService.getById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const authMatrix = configService.getAuthorizedReportsForUser(user);
  res.json(authMatrix);
});

// -------------------------------------------------------------
// AUTHORITATIVE RELATIONSHIP & EFFECTIVE ACCESS ENGINE API (PHASE 5)
// -------------------------------------------------------------

// Authoritative access evaluation endpoint
app.post('/api/access/evaluate', (req, res) => {
  const { user, userId, reportKey, action, submissionId } = req.body;
  const resolvedUser = user || (userId ? userService.getById(userId) : null) || DEMO_USERS[0];
  const submission = submissionId ? submissionService.getById(submissionId) : req.body.submission || null;

  if (!action) {
    res.status(400).json({ allowed: false, reason: 'Action parameter is required.', code: 'INVALID_PARAMETER' });
    return;
  }

  const result = effectiveAccessEngine.evaluateAccess(resolvedUser, reportKey, action, submission);
  const httpStatus = result.allowed ? 200 : getAuthOrClientStatusCode(result.reason);
  res.status(httpStatus).json(result);
});

// Comprehensive Effective Permissions Matrix across all 24 returns
app.get('/api/access/matrix/:userId', (req, res) => {
  const user = userService.getById(req.params.userId) || DEMO_USERS.find((u) => u.id === req.params.userId);
  if (!user) {
    res.status(404).json({ error: `User not found: ${req.params.userId}` });
    return;
  }
  const matrix = effectiveAccessEngine.getEffectiveReportPermissionsMatrix(user);
  res.json({
    userId: user.id,
    userName: user.name,
    role: user.role,
    department: user.department,
    status: (user as any).status || 'ACTIVE',
    matrix,
  });
});

// Direct User-Report Assignments Management
app.get('/api/access/user-assignments/:userId', (req, res) => {
  const assignments = effectiveAccessEngine.getUserDirectReportAssignments(req.params.userId);
  res.json({ userId: req.params.userId, reportKeys: assignments });
});

app.post('/api/access/user-assignments', (req, res) => {
  const caller = req.body.user || (req.headers['x-user-role'] ? { role: req.headers['x-user-role'], name: req.headers['x-user-name'] } : null);
  if (caller && caller.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only ADMIN role can assign reports directly to users.' });
    return;
  }
  const { userId, reportKey, adminName } = req.body;
  if (!userId || !reportKey) {
    res.status(400).json({ error: 'userId and reportKey are required.' });
    return;
  }
  const resolvedAdmin = adminName || caller?.name || 'Compliance Administrator';
  effectiveAccessEngine.assignReportToUser(userId, reportKey, resolvedAdmin);
  res.status(201).json({
    success: true,
    message: `Report ${reportKey} directly assigned to user ${userId}.`,
    reportKeys: effectiveAccessEngine.getUserDirectReportAssignments(userId),
  });
});

app.delete('/api/access/user-assignments', (req, res) => {
  const caller = req.body?.user || (req.headers['x-user-role'] ? { role: req.headers['x-user-role'], name: req.headers['x-user-name'] } : null);
  if (caller && caller.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only ADMIN role can remove direct report assignments.' });
    return;
  }
  const userId = req.body?.userId || (req.query as any)?.userId;
  const reportKey = req.body?.reportKey || (req.query as any)?.reportKey;
  const adminName = req.body?.adminName || caller?.name || 'Compliance Administrator';

  if (!userId || !reportKey) {
    res.status(400).json({ error: 'userId and reportKey are required.' });
    return;
  }
  const removed = effectiveAccessEngine.removeReportFromUser(userId, reportKey, adminName);
  res.json({
    success: removed,
    message: removed ? `Report ${reportKey} unassigned from user ${userId}.` : 'Assignment not found.',
    reportKeys: effectiveAccessEngine.getUserDirectReportAssignments(userId),
  });
});

// Cache Invalidation Hook
app.post('/api/access/cache/invalidate', (req, res) => {
  const { userId, reason } = req.body;
  if (userId) {
    effectiveAccessEngine.invalidateUser(userId);
  } else {
    effectiveAccessEngine.invalidateAll(reason || 'Administrative manual cache purge');
  }
  res.json({ success: true, message: 'Authorization evaluation cache purged.' });
});

// Admin creates user account directly
app.post('/api/users', (req, res) => {
  const caller = req.body.user || (req.headers['x-user-role'] ? { role: req.headers['x-user-role'], name: req.headers['x-user-name'] } : null);
  if (caller && caller.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only ADMIN role can create new user accounts.' });
    return;
  }
  const adminName = req.body.adminName || caller?.name || 'Compliance Administrator';
  const result = userService.createUser(req.body, adminName);
  if (result.success && result.user) {
    auditService.log({
      actorId: caller?.id || 'usr_admin',
      actorName: adminName,
      actorRole: 'ADMIN',
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: result.user.id,
      correlationId: `corr_usr_create_${result.user.id}`,
      details: `Administrator created user account for ${result.user.name} (${result.user.email}) with role ${result.user.role} in department ${result.user.department}.`,
      newState: result.user,
    });
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/users/:id/status', (req, res) => {
  const caller = req.body.user || (req.headers['x-user-role'] ? { role: req.headers['x-user-role'], name: req.headers['x-user-name'] } : null);
  if (caller && caller.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only ADMIN role can update user authorization status.' });
    return;
  }
  const { status, adminName } = req.body;
  const resolvedAdmin = adminName || caller?.name || 'System Administrator';
  const result = userService.updateUserStatus(req.params.id, status, resolvedAdmin);
  if (result.success && result.user) {
    auditService.log({
      actorId: caller?.id || 'usr_admin',
      actorName: resolvedAdmin,
      actorRole: 'ADMIN',
      action: `USER_STATUS_${status}`,
      entityType: 'USER',
      entityId: req.params.id,
      correlationId: `corr_status_${Date.now()}`,
      details: `User ${result.user.name} (${result.user.email}) status updated to ${status} by ${resolvedAdmin}.`,
    });
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.put('/api/users/:id', (req, res) => {
  const caller = req.body.user || (req.headers['x-user-role'] ? { role: req.headers['x-user-role'], name: req.headers['x-user-name'] } : null);
  if (caller && caller.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only ADMIN role can modify user account details.' });
    return;
  }
  const adminName = req.body.adminName || caller?.name || 'System Administrator';
  const result = userService.updateUser(req.params.id, req.body);
  if (result.success && result.user) {
    auditService.log({
      actorId: caller?.id || 'usr_admin',
      actorName: adminName,
      actorRole: 'ADMIN',
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: req.params.id,
      correlationId: `corr_usr_upd_${Date.now()}`,
      details: `User account details updated for ${result.user.name} (${result.user.email}) [Role: ${result.user.role}, Dept: ${result.user.department}].`,
      newState: result.user,
    });
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.delete('/api/users/:id', (req, res) => {
  const caller = req.body?.user || (req.query as any)?.user || (req.headers['x-user-role'] ? { role: req.headers['x-user-role'], name: req.headers['x-user-name'] } : null);
  if (caller && caller.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only ADMIN role can delete user accounts.' });
    return;
  }
  const targetUser = userService.getById(req.params.id);
  const result = userService.deleteUser(req.params.id);
  if (result.success) {
    auditService.log({
      actorId: caller?.id || 'usr_admin',
      actorName: caller?.name || 'Compliance Administrator',
      actorRole: 'ADMIN',
      action: 'USER_DELETED',
      entityType: 'USER',
      entityId: req.params.id,
      correlationId: `corr_usr_del_${Date.now()}`,
      details: `User account ${targetUser?.name || req.params.id} permanently removed.`,
      oldState: targetUser,
    });
    res.json(result);
  } else {
    // If blocked due to historical safety, return 400 with detailed reason
    res.status(400).json(result);
  }
});

// -------------------------------------------------------------
// OROMIA BANK ORGANIZATIONAL STRUCTURE & SPECIAL ACCESS ROUTES
// -------------------------------------------------------------

// Get official Oromia Bank departments & report classifications
app.get('/api/departments', (req, res) => {
  let depts = departmentService.getAll();
  const { search, division, status, page, page_size, limit } = req.query as any;

  if (division && division !== 'ALL') {
    depts = depts.filter((d) => d.division === division);
  }
  if (status && status !== 'ALL') {
    depts = depts.filter((d) => (d.status || 'ACTIVE') === status);
  }
  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    depts = depts.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.shortCode.toLowerCase().includes(q) ||
        d.division.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.reportKeys.some((k) => k.toLowerCase().includes(q))
    );
  }

  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(depts, page, page_size || limit));
    return;
  }
  res.json(depts);
});

// Single department details
app.get('/api/departments/:id', (req, res) => {
  const dept = departmentService.getById(req.params.id) || departmentService.getByName(req.params.id);
  if (!dept) {
    res.status(404).json({ error: 'Department not found' });
    return;
  }
  const configDept = configService.getDepartmentById(dept.id);
  const ancestors = configDept ? configService.getDepartmentAncestors(dept.id) : [];
  const descendants = configDept ? configService.getDepartmentDescendants(dept.id) : [];
  const assignedUsers = userService.getAll().filter(
    (u) => u.department && (u.department.toLowerCase() === dept.name.toLowerCase() || u.department === dept.id)
  );
  const submissionsCount = submissionService.getAll().filter(
    (s) => s.department && (s.department.toLowerCase() === dept.name.toLowerCase() || (s as any).departmentId === dept.id)
  ).length;

  res.json({
    ...dept,
    ancestors,
    descendants,
    usersCount: assignedUsers.length,
    makersCount: assignedUsers.filter((u) => u.role === 'MAKER').length,
    checkersCount: assignedUsers.filter((u) => u.role === 'CHECKER').length,
    submissionsCount,
    assignedUsers: assignedUsers.map(({ password, ...safe }) => safe),
  });
});

// Check if department can be deleted safely
app.get('/api/departments/:id/can-delete', (req, res) => {
  const check = departmentService.canDeleteDepartment(req.params.id);
  res.json(check);
});

// Get department specific audit history
app.get('/api/departments/:id/audit', (req, res) => {
  const logs = configService.getDepartmentAuditHistory(req.params.id);
  const { page, page_size, limit } = req.query as any;
  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(logs, page, page_size || limit));
    return;
  }
  res.json(logs);
});

// Admin creates department
app.post('/api/departments', (req, res) => {
  const caller = req.body.user || (req.headers['x-user-role'] ? { role: req.headers['x-user-role'], name: req.headers['x-user-name'] } : null);
  if (caller && caller.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only ADMIN role can create departments.' });
    return;
  }
  const adminName = req.body.adminName || caller?.name || 'Compliance Administrator';
  const result = departmentService.addDepartment(req.body, adminName);
  if (result.success && result.department) {
    // Also sync with configService SSOT
    try {
      configService.createDepartment(
        {
          id: result.department.id,
          name: result.department.name,
          shortCode: result.department.shortCode,
          division: result.department.division,
          description: result.department.description,
          parentId: req.body.parentId || null,
          primaryResponsibilities: result.department.primaryResponsibilities,
          status: (req.body.status as any) || 'ACTIVE',
          effectiveFrom: req.body.effectiveFrom,
        },
        { id: caller?.id || 'usr_admin', name: adminName, role: 'ADMIN' }
      );
    } catch {
      // Already handled or ID exists
    }
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

// Admin updates department
app.put('/api/departments/:id', (req, res) => {
  const caller = req.body.user || (req.headers['x-user-role'] ? { role: req.headers['x-user-role'], name: req.headers['x-user-name'] } : null);
  if (caller && caller.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only ADMIN role can update departments.' });
    return;
  }
  const adminName = req.body.adminName || caller?.name || 'Compliance Administrator';
  const result = departmentService.updateDepartment(req.params.id, req.body, adminName);
  if (result.success && result.department) {
    try {
      configService.updateDepartment(
        req.params.id,
        {
          name: result.department.name,
          shortCode: result.department.shortCode,
          division: result.department.division,
          description: result.department.description,
          parentId: req.body.parentId,
          status: req.body.status,
          primaryResponsibilities: result.department.primaryResponsibilities,
          effectiveTo: req.body.effectiveTo,
        },
        { id: caller?.id || 'usr_admin', name: adminName, role: 'ADMIN' }
      );
    } catch {}
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Admin updates department lifecycle status
app.post('/api/departments/:id/status', (req, res) => {
  const caller = req.body.user || (req.headers['x-user-role'] ? { role: req.headers['x-user-role'], name: req.headers['x-user-name'] } : null);
  if (caller && caller.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only ADMIN role can change department status.' });
    return;
  }
  const adminName = req.body.adminName || caller?.name || 'Compliance Administrator';
  const { status, effectiveTo } = req.body;
  const result = departmentService.setDepartmentStatus(req.params.id, status, adminName, effectiveTo);
  if (result.success) {
    try {
      configService.setDepartmentStatus(
        req.params.id,
        status,
        { id: caller?.id || 'usr_admin', name: adminName, role: 'ADMIN' },
        effectiveTo
      );
    } catch {}
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Admin deletes department (enforces historical safety)
app.delete('/api/departments/:id', (req, res) => {
  const caller = req.body?.user || (req.query as any)?.user || (req.headers['x-user-role'] ? { role: req.headers['x-user-role'], name: req.headers['x-user-name'] } : null);
  if (caller && caller.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only ADMIN role can delete departments.' });
    return;
  }
  const adminName = req.body?.adminName || caller?.name || 'Compliance Administrator';
  const result = departmentService.removeDepartment(req.params.id, req.body?.fallbackDepartment, adminName);
  if (result.success) {
    try {
      configService.deleteDepartment(req.params.id, {
        id: caller?.id || 'usr_admin',
        name: adminName,
        role: 'ADMIN',
      });
    } catch {}
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Grant special cross-department access to a Maker or Checker
app.post('/api/users/:id/special-access', (req, res) => {
  const { reportKey, department, departments, reason, expiresAt, adminName, user } = req.body;
  if (user && user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only ADMIN role can grant cross-department special access.' });
    return;
  }
  const result = userService.grantSpecialAccess(
    req.params.id,
    { reportKey, department, departments, reason, expiresAt },
    adminName || 'System Administrator'
  );
  if (result.success && result.user) {
    const targetDesc = reportKey
      ? `report ${reportKey}`
      : departments && departments.length > 0
      ? `department(s) [${departments.join(', ')}]`
      : `department ${department}`;
    auditService.log({
      actorId: 'usr_admin',
      actorName: adminName || 'Compliance Administrator',
      actorRole: 'ADMIN',
      action: 'SPECIAL_ACCESS_GRANTED',
      entityType: 'USER_PERMISSION',
      entityId: req.params.id,
      correlationId: `corr_spec_${Date.now()}`,
      details: `Granted special access to ${result.user.name} (${result.user.role}) for ${targetDesc}. Justification: ${reason}`,
    });
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Revoke special cross-department access
app.delete('/api/users/:id/special-access/:grantId', (req, res) => {
  const user = (req.body && req.body.user) || (req.query && (req.query as any).user);
  if (user && user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only ADMIN role can revoke cross-department special access.' });
    return;
  }
  const adminName = (req.query.adminName as string) || 'System Administrator';
  const result = userService.revokeSpecialAccess(req.params.id, req.params.grantId, adminName);
  if (result.success && result.user) {
    auditService.log({
      actorId: 'usr_admin',
      actorName: adminName,
      actorRole: 'ADMIN',
      action: 'SPECIAL_ACCESS_REVOKED',
      entityType: 'USER_PERMISSION',
      entityId: req.params.id,
      correlationId: `corr_rev_${Date.now()}`,
      details: `Revoked special access grant ${req.params.grantId} for ${result.user.name}`,
    });
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// -------------------------------------------------------------
// FIRST-CLASS AUDITOR & COMPLIANCE WORKFLOW ENDPOINTS
// -------------------------------------------------------------

// Auditor Work Queue
app.get(['/api/audit/work-queue', '/api/v1/audit/work-queue'], (req, res) => {
  const queue = auditorService.getWorkQueue({
    department: (req.query.department as string) || undefined,
    submissionStatus: (req.query.status as string) || undefined,
    search: (req.query.search as string) || undefined,
  });
  const summary = auditorService.getKpiSummary();
  const { page, page_size, limit } = req.query as any;

  if (page !== undefined || page_size !== undefined) {
    const paginated = paginateList(queue, page, page_size || limit);
    res.json({
      summary,
      ...paginated,
      queue: paginated.items,
    });
    return;
  }

  res.json({
    summary,
    queue,
    items: queue,
    total: queue.length,
    page: 1,
    page_size: queue.length,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  });
});

// Audit Findings
app.get(['/api/audit/findings', '/api/v1/audit/findings'], (req, res) => {
  const findings = auditorService.getFindings({
    severity: req.query.severity as any,
    status: req.query.status as any,
    department: req.query.department as any,
  });
  const { page, page_size, limit } = req.query as any;
  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(findings, page, page_size || limit));
    return;
  }
  res.json(findings);
});

app.post(['/api/audit/findings', '/api/v1/audit/findings'], (req, res) => {
  const { user, ...findingData } = req.body;
  if (user && user.role !== 'AUDITOR' && user.role !== 'ADMIN') {
    res.status(403).json({ error: "Only AUDITOR or ADMIN roles can create audit findings." });
    return;
  }
  const finding = auditorService.createFinding({
    ...findingData,
    auditorId: user?.id || 'usr_auditor_1',
    auditorName: user?.name || 'Compliance Auditor',
  });
  res.status(201).json(finding);
});

app.patch(['/api/audit/findings/:id', '/api/v1/audit/findings/:id'], (req, res) => {
  const updated = auditorService.updateFinding(req.params.id, req.body);
  if (updated) {
    res.json(updated);
  } else {
    res.status(404).json({ error: 'Finding not found' });
  }
});

// Evidence Management
app.get(['/api/audit/evidence', '/api/v1/audit/evidence'], (req, res) => {
  const evidences = auditorService.getEvidence(req.query.reportKey as string, req.query.submissionId as string);
  const { page, page_size, limit } = req.query as any;
  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(evidences, page, page_size || limit));
    return;
  }
  res.json(evidences);
});

app.post(['/api/audit/evidence', '/api/v1/audit/evidence'], async (req, res) => {
  const evidence = await auditorService.attachEvidence(req.body);
  res.status(201).json(evidence);
});

// Audit Working Papers / Notes
app.get(['/api/audit/notes', '/api/v1/audit/notes'], (req, res) => {
  const notes = auditorService.getWorkingNotes(req.query.reportKey as string, req.query.submissionId as string);
  const { page, page_size, limit } = req.query as any;
  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(notes, page, page_size || limit));
    return;
  }
  res.json(notes);
});

app.post(['/api/audit/notes', '/api/v1/audit/notes'], (req, res) => {
  const note = auditorService.addWorkingNote(req.body);
  res.status(201).json(note);
});

// Remediation Action Tracking
app.get(['/api/audit/remediations', '/api/v1/audit/remediations'], (req, res) => {
  const rems = auditorService.getRemediations(req.query.findingId as string);
  const { page, page_size, limit } = req.query as any;
  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(rems, page, page_size || limit));
    return;
  }
  res.json(rems);
});

app.post(['/api/audit/remediations', '/api/v1/audit/remediations'], (req, res) => {
  const rem = auditorService.createRemediation(req.body);
  res.status(201).json(rem);
});

app.patch(['/api/audit/remediations/:id', '/api/v1/audit/remediations/:id'], (req, res) => {
  const { verifiedBy, status: remStatus, remediationProof, ...rest } = req.body;
  let updated;
  if (remStatus === 'VERIFIED_BY_AUDITOR') {
    updated = auditorService.verifyRemediationByAuditor(req.params.id, verifiedBy || 'Compliance Auditor', remediationProof);
  } else {
    updated = auditorService.updateRemediation(req.params.id, { status: remStatus, remediationProof, ...rest });
  }
  if (updated) res.json(updated);
  else res.status(404).json({ error: 'Remediation not found' });
});

// Audit Reports Packages
app.get(['/api/audit/reports', '/api/v1/audit/reports'], (req, res) => {
  const pkgs = auditorService.getReportPackages();
  const { page, page_size, limit } = req.query as any;
  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(pkgs, page, page_size || limit));
    return;
  }
  res.json(pkgs);
});

// Formal Audit Report Export
app.post(['/api/audit/reports/export', '/api/v1/audit/reports/export'], (req, res) => {
  const pkg = auditorService.generateAuditReport({
    period: req.body.period || 'Q1 2026',
    scopeDepartments: req.body.scopeDepartments || [],
    executiveSummary: req.body.executiveSummary,
    generatedBy: req.body.generatedBy || 'Compliance Internal Audit Directorate',
  });
  res.status(201).json(pkg);
});

// -------------------------------------------------------------
// NBE GATEWAY / SIMULATOR ADAPTER ROUTES
// Proxies OB frontend requests to the independent Django NBE Simulator microservice (port 8001)
// -------------------------------------------------------------

const DJANGO_SIMULATOR_URL = process.env.NBE_SIMULATOR_URL || 'http://127.0.0.1:8001/api/v1/nbe-simulator';

// Dynamic Report Discovery for NBE Simulator (Phase 32)
// Discovers all active and draft reports dynamically from SSOT, filtering retired reports
app.get('/api/nbe-simulator/reports', (req, res) => {
  const actorRole = (req.headers['x-actor-role'] || req.query.role || 'ADMIN') as string;
  if (actorRole && actorRole !== 'ADMIN') {
    res.status(403).json({
      error: 'Forbidden: NBE Simulator access is strictly restricted to Administrators.',
      code: 'UNAUTHORIZED_SIMULATOR_ACCESS',
    });
    return;
  }
  try {
    const reports = nbeSimulator.getAvailableReports();
    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Build canonical simulated payload from active/draft template
app.get('/api/nbe-simulator/reports/:key/payload', (req, res) => {
  const actorRole = (req.headers['x-actor-role'] || req.query.role || 'ADMIN') as string;
  if (actorRole && actorRole !== 'ADMIN') {
    res.status(403).json({
      error: 'Forbidden: NBE Simulator access is strictly restricted to Administrators.',
      code: 'UNAUTHORIZED_SIMULATOR_ACCESS',
    });
    return;
  }
  try {
    const versionNum = req.query.version ? parseInt(req.query.version as string, 10) : undefined;
    const payload = nbeSimulator.buildSimulatedPayload(req.params.key, versionNum);
    res.json(payload);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Dynamic simulated transmission for any report
app.post('/api/nbe-simulator/reports/:key/transmit', async (req, res) => {
  const actorRole = (req.headers['x-actor-role'] || req.body.role || req.body.actor?.role || 'ADMIN') as string;
  if (actorRole && actorRole !== 'ADMIN') {
    res.status(403).json({
      error: 'Forbidden: NBE Simulator transmission is strictly restricted to Administrators.',
      code: 'UNAUTHORIZED_SIMULATOR_ACCESS',
    });
    return;
  }
  try {
    const result = await nbeSimulator.simulateReportTransmission(req.params.key, {
      customPayload: req.body.payload,
      scenarioOverride: req.body.scenario,
      idempotencyKey: req.body.idempotencyKey,
    });
    res.status(result.statusCode).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/nbe-simulator/submissions', async (req, res) => {
  const actorRole = (req.headers['x-actor-role'] || req.query.role || 'ADMIN') as string;
  if (actorRole && actorRole !== 'ADMIN') {
    res.status(403).json({
      error: 'Forbidden: NBE Simulator access is strictly restricted to Administrators.',
      code: 'UNAUTHORIZED_SIMULATOR_ACCESS',
    });
    return;
  }
  const { page, page_size, limit } = req.query as any;
  let submissions: any[] = [];
  try {
    const lim = limit || '100';
    const response = await fetch(`${DJANGO_SIMULATOR_URL}/submissions?limit=${lim}`);
    if (response.ok) {
      submissions = await response.json();
    } else {
      submissions = nbeSimulator.getSubmissions();
    }
  } catch (err) {
    submissions = nbeSimulator.getSubmissions();
  }

  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(submissions, page, page_size || limit));
    return;
  }
  res.json(submissions);
});

app.get('/api/nbe-simulator/logs', async (req, res) => {
  const actorRole = (req.headers['x-actor-role'] || req.query.role || 'ADMIN') as string;
  if (actorRole && actorRole !== 'ADMIN') {
    res.status(403).json({
      error: 'Forbidden: NBE Simulator access is strictly restricted to Administrators.',
      code: 'UNAUTHORIZED_SIMULATOR_ACCESS',
    });
    return;
  }
  const { page, page_size, limit } = req.query as any;
  let logs: any[] = [];
  try {
    const lim = limit || '100';
    const response = await fetch(`${DJANGO_SIMULATOR_URL}/logs?limit=${lim}`);
    if (response.ok) {
      logs = await response.json();
    } else {
      logs = nbeSimulator.getLogs();
    }
  } catch (err) {
    logs = nbeSimulator.getLogs();
  }

  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(logs, page, page_size || limit));
    return;
  }
  res.json(logs);
});

app.delete('/api/nbe-simulator/logs', async (req, res) => {
  nbeSimulator.clearLogs();
  try {
    const response = await fetch(`${DJANGO_SIMULATOR_URL}/logs`, { method: 'DELETE' });
    if (response.ok) {
      const data = await response.json();
      res.json(data);
      return;
    }
  } catch (err) {
    // Fallback
  }
  res.json({ message: 'Logs cleared' });
});

app.get('/api/nbe-simulator/gateway-health', async (req, res) => {
  try {
    const response = await fetch(`${DJANGO_SIMULATOR_URL}/gateway-health`);
    if (response.ok) {
      const data = await response.json();
      res.json(data);
      return;
    }
  } catch (err) {
    // Fallback
  }
  const scenario = nbeSimulator.getScenario();
  const isHealthy = scenario.mode !== 'SERVER_ERROR' && scenario.mode !== 'TIMEOUT';
  const status = (scenario.mode === 'SERVER_ERROR' || scenario.mode === 'TIMEOUT')
    ? 'DEGRADED'
    : scenario.mode === 'RANDOM_FLAKY'
    ? 'DEGRADED'
    : 'ONLINE';
  const latency = scenario.latencyMs || Math.floor(25 + Math.random() * 20);

  res.json({
    status,
    healthy: isHealthy,
    gateway: 'National Bank of Ethiopia (NBE) BSD Gateway',
    endpoint: 'https://nbe.gov.et/api/v2/regulatory/gateway',
    institutionCode: '0000013',
    latencyMs: latency,
    tlsVersion: 'TLSv1.3 / mTLS',
    directives: ['BSD/03/2020', 'SBR/2026'],
    mode: scenario.mode,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/nbe-simulator/scenario', async (req, res) => {
  const actorRole = (req.headers['x-actor-role'] || req.query.role || 'ADMIN') as string;
  if (actorRole && actorRole !== 'ADMIN') {
    res.status(403).json({
      error: 'Forbidden: NBE Simulator access is strictly restricted to Administrators.',
      code: 'UNAUTHORIZED_SIMULATOR_ACCESS',
    });
    return;
  }
  try {
    const response = await fetch(`${DJANGO_SIMULATOR_URL}/scenario`);
    if (response.ok) {
      const data = await response.json();
      res.json(data);
      return;
    }
  } catch (err) {
    // Fallback
  }
  res.json(nbeSimulator.getScenario());
});

app.post('/api/nbe-simulator/scenario', async (req, res) => {
  const actorRole = (req.headers['x-actor-role'] || req.query.role || req.body?.role || 'ADMIN') as string;
  if (actorRole && actorRole !== 'ADMIN') {
    res.status(403).json({
      error: 'Forbidden: NBE Simulator access is strictly restricted to Administrators.',
      code: 'UNAUTHORIZED_SIMULATOR_ACCESS',
    });
    return;
  }
  const updatedLocal = nbeSimulator.setScenario(req.body);
  try {
    const response = await fetch(`${DJANGO_SIMULATOR_URL}/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    if (response.ok) {
      const data = await response.json();
      res.json(data);
      return;
    }
  } catch (err) {
    // Fallback
  }
  res.json(updatedLocal);
});

// Simulator HTTP Intake Endpoint
app.post('/api/nbe-simulator/submit', async (req, res) => {
  const headers = req.headers as Record<string, string>;
  try {
    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    for (const h of ['idempotency-key', 'x-correlation-id', 'x-institution-code', 'authorization', 'x-simulator-force-scenario']) {
      if (headers[h]) forwardHeaders[h] = headers[h];
    }
    const response = await fetch(`${DJANGO_SIMULATOR_URL}/submit`, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
    return;
  } catch (err) {
    // Fallback to local in-memory simulation
    const result = await nbeSimulator.processSubmission(req.body, headers);
    res.status(result.statusCode).json(result.body);
  }
});

// -------------------------------------------------------------
// AUDIT LOGS
// -------------------------------------------------------------

app.get('/api/audit-logs', (req, res) => {
  const { page, page_size, limit, entityId, actorId } = req.query as any;
  let logs = auditService.getAllLogs();
  if (entityId) logs = logs.filter((l: any) => l.entityId === entityId);
  if (actorId) logs = logs.filter((l: any) => l.actorId === actorId);

  if (page !== undefined || page_size !== undefined) {
    res.json(paginateList(logs, page, page_size || limit));
    return;
  }
  const lim = parseInt((limit as string) || '100', 10);
  res.json(logs.slice(0, lim));
});

app.post('/api/audit-logs', (req, res) => {
  const { actorId, actorName, actorRole, action, entityType, entityId, details, correlationId, newState, oldState } = req.body;
  if (!action) {
    res.status(400).json({ error: 'Action is required for audit trail entry' });
    return;
  }
  const entry = auditService.log({
    actorId: actorId || 'sys_user',
    actorName: actorName || 'System User',
    actorRole: actorRole || 'MAKER',
    action,
    entityType: entityType || 'REGULATORY',
    entityId: entityId || 'OB_SYSTEM',
    correlationId: correlationId || `corr_${Date.now()}`,
    details: details || `Recorded action ${action}`,
    newState,
    oldState,
  });
  res.status(201).json(entry);
});

app.post('/api/audit-logs/biometric', (req, res) => {
  const entry = auditService.logBiometricEvent(req.body);
  res.status(201).json(entry);
});

// Batch synchronize offline audit logs from IndexedDB
app.post('/api/audit-logs/batch', (req, res) => {
  const { logs } = req.body;
  if (!Array.isArray(logs)) {
    res.status(400).json({ error: 'Expected logs array' });
    return;
  }

  let appendedCount = 0;
  const existingIds = new Set(auditService.getLogs(1000).map((l) => l.id));

  for (const log of logs) {
    if (!log || !log.id) continue;
    if (!existingIds.has(log.id)) {
      (auditService as any).logs.unshift({
        ...log,
        syncStatus: 'SYNCED',
        persistedAt: new Date().toISOString(),
      });
      existingIds.add(log.id);
      appendedCount++;
    }
  }

  res.json({
    success: true,
    count: appendedCount,
    totalLogs: auditService.getLogs(1000).length,
  });
});

// -------------------------------------------------------------
// PHASE 2 DATA INTEGRATION & SSOT
// -------------------------------------------------------------

app.post('/api/phase2/ingest', async (req, res) => {
  const { source } = req.body;
  try {
    const job = await Phase2Pipeline.runIngestion(source || 'CORE_BANKING');
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/phase2/quality', (req, res) => {
  res.json(Phase2Pipeline.assessDataQuality());
});

app.get('/api/phase2/reconcile', (req, res) => {
  res.json(Phase2Pipeline.reconcileGeneralLedger());
});

app.post('/api/phase2/generate', (req, res) => {
  const { reportKey } = req.body;
  try {
    const generated = Phase2Pipeline.generateReportFromSSOT(reportKey || 'M_LCPLC001');
    res.json(generated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// BULK OPERATIONS, IMPORT, EXPORT & FILE WORKFLOWS (PHASE 6)
// -------------------------------------------------------------

// 1. Dry-Run Parse & Validation Preview (No authoritative mutation)
app.post('/api/bulk/dry-run', (req, res) => {
  try {
    const { targetType, format, payload, rawPayload, conflictStrategy, actor, page, pageSize } = req.body;
    const actorInfo = actor || { id: 'usr_admin', name: 'Administrator', role: 'ADMIN' };
    const content = payload || rawPayload;
    if (!content) {
      res.status(400).json({ error: 'Payload content is required for dry-run preview.' });
      return;
    }
    const result = bulkOperationsEngine.generateDryRun({
      targetType: targetType || 'USERS',
      format: format || 'CSV',
      rawPayload: content,
      conflictStrategy: conflictStrategy || 'UPDATE',
      actor: actorInfo,
      page: page ? parseInt(String(page), 10) : 1,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : 20,
    });
    res.json(result);
  } catch (err: any) {
    const status = getAuthOrClientStatusCode(err.message);
    res.status(status).json({ error: err.message });
  }
});

// 2. Fetch Cached Dry-Run with custom pagination
app.get('/api/bulk/dry-run/:dryRunId', (req, res) => {
  const { dryRunId } = req.params;
  const { page, page_size } = req.query as any;
  const result = bulkOperationsEngine.getDryRun(
    dryRunId,
    page ? parseInt(String(page), 10) : 1,
    page_size ? parseInt(String(page_size), 10) : 20
  );
  if (!result) {
    res.status(404).json({ error: `Dry-run preview '${dryRunId}' not found or has expired.` });
    return;
  }
  res.json(result);
});

// 3. Explicit Transactional Execution
app.post('/api/bulk/execute', (req, res) => {
  try {
    const { dryRunId, mode, actor, confirmed } = req.body;
    const actorInfo = actor || { id: 'usr_admin', name: 'Administrator', role: 'ADMIN' };
    if (!dryRunId) {
      res.status(400).json({ error: 'dryRunId is required. Preview must be performed first.' });
      return;
    }
    if (!confirmed) {
      res.status(400).json({ error: 'Explicit confirmation flag (confirmed: true) is mandatory.' });
      return;
    }
    const result = bulkOperationsEngine.executeDryRun({
      dryRunId,
      mode: mode || 'ATOMIC',
      actor: actorInfo,
      confirmed: true,
    });
    res.json(result);
  } catch (err: any) {
    const status = getAuthOrClientStatusCode(err.message);
    res.status(status).json({ error: err.message });
  }
});

// 4. Bulk Actions on Selected Users
app.post('/api/bulk/users/action', (req, res) => {
  try {
    const { userIds, action, payload, actor, mode } = req.body;
    const actorInfo = actor || { id: 'usr_admin', name: 'Administrator', role: 'ADMIN' };
    const result = bulkOperationsEngine.executeBulkUserAction({
      userIds,
      action,
      payload,
      actor: actorInfo,
      mode: mode || 'ATOMIC',
    });
    res.json(result);
  } catch (err: any) {
    const status = getAuthOrClientStatusCode(err.message);
    res.status(status).json({ error: err.message });
  }
});

// 5. Bulk Actions on Selected Reports
app.post('/api/bulk/reports/action', (req, res) => {
  try {
    const { reportKeys, action, payload, actor, mode } = req.body;
    const actorInfo = actor || { id: 'usr_admin', name: 'Administrator', role: 'ADMIN' };
    const result = bulkOperationsEngine.executeBulkReportAction({
      reportKeys,
      action,
      payload,
      actor: actorInfo,
      mode: mode || 'ATOMIC',
    });
    res.json(result);
  } catch (err: any) {
    const status = getAuthOrClientStatusCode(err.message);
    res.status(status).json({ error: err.message });
  }
});

// 6. Authorized, Audited Bulk Export (CSV / JSON / XLSX)
app.post('/api/bulk/export', (req, res) => {
  try {
    const { target, format, actor, filters, selectedIds } = req.body;
    const actorInfo = actor || { id: 'usr_admin', name: 'Administrator', role: 'ADMIN' };
    const exported = bulkOperationsEngine.exportData({
      target: target || 'USERS',
      format: format || 'CSV',
      actor: actorInfo,
      filters,
      selectedIds,
    });

    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
    res.setHeader('Content-Type', exported.mimeType);
    if (exported.format === 'XLSX') {
      res.send(Buffer.from(exported.content as Uint8Array));
    } else {
      res.send(exported.content);
    }
  } catch (err: any) {
    const status = getAuthOrClientStatusCode(err.message);
    res.status(status).json({ error: err.message });
  }
});

// System Health
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ONLINE',
    service: 'Oromia Bank NBE Platform',
    institutionCode: '0000013',
    registeredReportsCount: getAllReports().length,
    activeSubmissionsCount: submissionService.getAll().length,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};
app.get(['/api/health', '/health', '/healthz', '/_ah/health', '/healthcheck'], healthHandler);

// -------------------------------------------------------------
// DEV / PROD SERVER BOOTSTRAP
// -------------------------------------------------------------

function ensureDjangoSimulatorRunning() {
  if (process.env.NODE_ENV === 'production' || process.env.K_SERVICE) {
    return;
  }
  const checkUrl = 'http://127.0.0.1:8001/api/v1/nbe-simulator/gateway-health';
  fetch(checkUrl, { signal: AbortSignal.timeout(1500) })
    .then((r) => {
      if (r.ok) {
        console.log('[NBE Simulator Service] Microservice active on port 8001.');
      }
    })
    .catch(() => {
      console.log('[NBE Simulator Service] Launching independent Django service on port 8001...');
      try {
        const proc = spawn('python3', ['nbe_simulator_service/manage.py', 'runserver', '127.0.0.1:8001', '--noreload'], {
          detached: true,
          stdio: 'ignore',
          cwd: __dirname,
        });
        proc.on('error', (err) => {
          console.warn('[NBE Simulator Service] Python microservice auto-spawn unavailable (using built-in simulator engine):', err.message);
        });
        proc.unref();
      } catch (e: any) {
        console.warn('[NBE Simulator Service] Auto-spawn notice:', e.message);
      }
    });
}

async function startServer() {
  ensureDjangoSimulatorRunning();

  const isCloudRun = Boolean(process.env.K_SERVICE);
  const distIndexHtml = path.resolve(__dirname, 'dist', 'index.html');
  const distExists = fs.existsSync(distIndexHtml);

  if (distExists) {
    // Production / pre-built static serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) {
        return next();
      }
      if (fs.existsSync(distIndexHtml)) {
        return res.sendFile(distIndexHtml);
      }
      return next();
    });
  } else {
    // Vite middleware mode for development or when dist not yet built
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const activeServers: http.Server[] = [];

  const bindPort = (port: number): Promise<http.Server | null> => {
    return new Promise((resolve) => {
      const srv = http.createServer(app);
      srv.on('error', (err: any) => {
        console.warn(`[Server Port Notice] Port ${port} bind skipped (${err.code || err.message}).`);
        resolve(null);
      });
      srv.listen(port, '0.0.0.0', () => {
        console.log(`[Oromia Bank NBE Platform] Server listening on port ${port}`);
        realtimeSsotEngine.attachServer(srv, '/ws/ssot');
        resolve(srv);
      });
    });
  };

  // Determine candidate ports to bind
  // 1. If explicit APP_PORT is given, prioritize it
  // 2. In Cloud Run or standard container, process.env.PORT is usually 8080
  // 3. Port 3000 is the required app port for AI Studio Nginx proxy and iframe preview
  const candidatePorts: number[] = [];
  if (process.env.APP_PORT) {
    const p = parseInt(process.env.APP_PORT, 10);
    if (!isNaN(p) && p > 0 && !candidatePorts.includes(p)) candidatePorts.push(p);
  }
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10);
    if (!isNaN(p) && p > 0 && !candidatePorts.includes(p)) candidatePorts.push(p);
  }
  if (!candidatePorts.includes(3000)) {
    candidatePorts.push(3000);
  }
  if (!candidatePorts.includes(8080)) {
    candidatePorts.push(8080);
  }

  // Attempt binding all candidate ports concurrently
  for (const p of candidatePorts) {
    const srv = await bindPort(p);
    if (srv) {
      activeServers.push(srv);
    }
  }

  if (activeServers.length === 0) {
    throw new Error(`Failed to bind server on any candidate ports: [${candidatePorts.join(', ')}]`);
  }

  // Graceful shutdown handling for Cloud Run container lifecycle
  let isShuttingDown = false;
  const handleShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Server] Received ${signal}, closing active HTTP servers (${activeServers.length})...`);
    let remaining = activeServers.length;
    if (remaining === 0) {
      process.exit(0);
    }
    for (const srv of activeServers) {
      srv.close(() => {
        remaining--;
        if (remaining <= 0) {
          console.log('[Server] All HTTP servers closed cleanly.');
          process.exit(0);
        }
      });
    }
    setTimeout(() => {
      process.exit(0);
    }, 5000).unref();
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[Server Fatal Error on Startup]', err);
  process.exit(1);
});
