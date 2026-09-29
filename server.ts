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

// Submissions list with filtering
app.get('/api/regulatory/submissions', (req, res) => {
  const { status, reportKey, makerId } = req.query as any;
  const submissions = submissionService.getByFilter({ status, reportKey, makerId });
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
    res.status(400).json({ error: err.message });
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
    res.status(400).json({ error: err.message });
  }
});

// Validate submission
app.post('/api/regulatory/submissions/:id/validate', (req, res) => {
  try {
    const summary = submissionService.validateSubmission(req.params.id);
    res.json(summary);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
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
    res.status(400).json({ error: err.message });
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
    res.status(400).json({ error: err.message });
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
    res.status(400).json({ error: err.message });
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
  res.json(userService.getAll());
});

app.post('/api/users/:id/status', (req, res) => {
  const { status, adminName } = req.body;
  const result = userService.updateUserStatus(req.params.id, status, adminName || 'System Administrator');
  if (result.success && result.user) {
    auditService.log({
      actorId: 'usr_admin',
      actorName: adminName || 'Administrator',
      actorRole: 'ADMIN',
      action: `USER_STATUS_${status}`,
      entityType: 'USER',
      entityId: req.params.id,
      correlationId: `corr_status_${Date.now()}`,
      details: `User ${result.user.name} (${result.user.email}) status updated to ${status}`,
    });
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.put('/api/users/:id', (req, res) => {
  const result = userService.updateUser(req.params.id, req.body);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.delete('/api/users/:id', (req, res) => {
  const result = userService.deleteUser(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// -------------------------------------------------------------
// OROMIA BANK ORGANIZATIONAL STRUCTURE & SPECIAL ACCESS ROUTES
// -------------------------------------------------------------

// Get official Oromia Bank departments & report classifications
app.get('/api/departments', (req, res) => {
  res.json(departmentService.getAll());
});

// Grant special cross-department access to a Maker or Checker
app.post('/api/users/:id/special-access', (req, res) => {
  const { reportKey, department, departments, reason, expiresAt, adminName } = req.body;
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
  res.json({
    summary: auditorService.getKpiSummary(),
    queue,
  });
});

// Audit Findings
app.get(['/api/audit/findings', '/api/v1/audit/findings'], (req, res) => {
  const findings = auditorService.getFindings({
    severity: req.query.severity as any,
    status: req.query.status as any,
    department: req.query.department as any,
  });
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
  res.json(evidences);
});

app.post(['/api/audit/evidence', '/api/v1/audit/evidence'], async (req, res) => {
  const evidence = await auditorService.attachEvidence(req.body);
  res.status(201).json(evidence);
});

// Audit Working Papers / Notes
app.get(['/api/audit/notes', '/api/v1/audit/notes'], (req, res) => {
  const notes = auditorService.getWorkingNotes(req.query.reportKey as string, req.query.submissionId as string);
  res.json(notes);
});

app.post(['/api/audit/notes', '/api/v1/audit/notes'], (req, res) => {
  const note = auditorService.addWorkingNote(req.body);
  res.status(201).json(note);
});

// Remediation Action Tracking
app.get(['/api/audit/remediations', '/api/v1/audit/remediations'], (req, res) => {
  const rems = auditorService.getRemediations(req.query.findingId as string);
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
  try {
    const limit = req.query.limit || '100';
    const response = await fetch(`${DJANGO_SIMULATOR_URL}/submissions?limit=${limit}`);
    if (response.ok) {
      const data = await response.json();
      res.json(data);
      return;
    }
  } catch (err) {
    // Graceful fallback to local buffer if Django simulator is offline
  }
  res.json(nbeSimulator.getSubmissions());
});

app.get('/api/nbe-simulator/logs', async (req, res) => {
  try {
    const limit = req.query.limit || '100';
    const response = await fetch(`${DJANGO_SIMULATOR_URL}/logs?limit=${limit}`);
    if (response.ok) {
      const data = await response.json();
      res.json(data);
      return;
    }
  } catch (err) {
    // Graceful fallback
  }
  res.json(nbeSimulator.getLogs());
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
  const limit = parseInt(req.query.limit as string || '100', 10);
  res.json(auditService.getLogs(limit));
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
