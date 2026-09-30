/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
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
import { paginateList, PaginatedResult } from './src/utils/paginationUtils.ts';
import { configService } from './src/services/configService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security & CORS Headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Idempotency-Key, X-Correlation-ID');
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

  configService.events.on('CONFIG_CHANGED', onConfigChanged);
  configService.events.on('CACHE_INVALIDATED', onCacheInvalidated);

  req.on('close', () => {
    configService.events.off('CONFIG_CHANGED', onConfigChanged);
    configService.events.off('CACHE_INVALIDATED', onCacheInvalidated);
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
    res.status(400).json({ error: err.message });
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

// Get submission by ID
app.get('/api/regulatory/submissions/:id', (req, res) => {
  const sub = submissionService.getById(req.params.id);
  if (!sub) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }
  res.json(sub);
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
  const { values, dynamicRows, user } = req.body;
  const activeUser = user || DEMO_USERS[0];
  try {
    const updated = submissionService.updateDraft(req.params.id, values || {}, dynamicRows || {}, activeUser);
    res.json(updated);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Validate submission
app.post('/api/regulatory/submissions/:id/validate', (req, res) => {
  try {
    const summary = submissionService.validateSubmission(req.params.id);
    res.json(summary);
  } catch (err: any) {
    res.status(getAuthOrClientStatusCode(err.message)).json({ error: err.message });
  }
});

// Maker submit to Checker
app.post('/api/regulatory/submissions/:id/submit', (req, res) => {
  const { user, comment } = req.body;
  const activeUser = user || DEMO_USERS[0];
  try {
    const updated = submissionService.submitToChecker(req.params.id, activeUser, comment);
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
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, message: 'Corporate email and password are required to sign in.' });
    return;
  }
  const result = userService.login(email, password);
  if (result.success && result.user) {
    auditService.log({
      actorId: result.user.id,
      actorName: result.user.name,
      actorRole: result.user.role,
      action: 'USER_LOGIN',
      entityType: 'AUTH',
      entityId: result.user.id,
      correlationId: `corr_auth_${Date.now()}`,
      details: `User logged in successfully as ${result.user.role}`,
    });
    res.json(result);
  } else {
    res.status(401).json(result);
  }
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

// Register biometric credentials on server
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

// Verify biometric login on server
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

app.get('/api/nbe-simulator/submissions', async (req, res) => {
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

// System Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Oromia Bank NBE Platform',
    institutionCode: '0000013',
    registeredReportsCount: getAllReports().length,
    activeSubmissionsCount: submissionService.getAll().length,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// -------------------------------------------------------------
// DEV / PROD SERVER BOOTSTRAP
// -------------------------------------------------------------

function ensureDjangoSimulatorRunning() {
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
        proc.unref();
      } catch (e: any) {
        console.warn('[NBE Simulator Service] Auto-spawn notice:', e.message);
      }
    });
}

async function startServer() {
  ensureDjangoSimulatorRunning();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Oromia Bank NBE Platform] Server listening on port ${PORT}`);
  });
}

startServer();
