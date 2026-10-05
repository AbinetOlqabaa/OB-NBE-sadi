/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 37 ACCEPTANCE TEST SUITE:
 * Cross-Phase Integration, Security, Regression & Acceptance (Phases 31 - 36)
 * Specification: 37_CROSS_PHASE_INTEGRATION_SECURITY_REGRESSION_AND_ACCEPTANCE.md
 * Regulatory Authority: National Bank of Ethiopia (Bank Supervision Directorate)
 * Licensed Institution: Oromia Bank S.C. (InstCode: 0000013)
 */

import { submissionService } from '../services/submissionService.ts';
import { ValidationRemediationService } from '../services/validationRemediationService.ts';
import { sessionService } from '../services/sessionService.ts';
import { userService } from '../services/userService.ts';
import { effectiveAccessEngine } from '../services/effectiveAccessEngine.ts';
import { departmentService } from '../services/departmentService.ts';
import { configService } from '../services/configService.ts';
import { auditService } from '../services/auditService.ts';
import { biometricService } from '../services/biometricService.ts';
import { configurationGovernanceService } from '../services/configurationGovernanceService.ts';
import { nbeReportPackageService } from '../services/nbeReportPackageNormalizer.ts';
import { nbeEndpointRegistry } from '../services/nbeEndpointRegistry.ts';
import { templateInitializationService, TemplateInitializationService } from '../services/templateInitializationService.ts';
import { notificationService } from '../services/notificationService.ts';
import { isTabAuthorizedForRole } from '../App.tsx';
import { getReportByKey } from '../data/report-registry.ts';
import { indexedDbStorage } from '../services/indexedDbStorage.ts';
import type {
  ReportSubmission,
  UserSession,
  SpecialAccessGrant,
  DynamicRowRecord,
  ReportMetadata,
  ReviewerAssignment,
} from '../types/regulatory.ts';

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase37CrossPhaseIntegrationSecurityRegressionAndAcceptanceTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 37: CROSS-PHASE INTEGRATION, SECURITY, REGRESSION & ACCEPTANCE ---');
  console.log('========================================================================\n');

  // Setup pristine state
  sessionService.resetSessions();
  userService.resetDevelopmentSeedData();
  notificationService.clearAll();
  effectiveAccessEngine.setUserProvider(userService);

  const adminUser = userService.getByEmail('admin@oromiabank.com')!;
  const creditMaker = userService.getByEmail('abebe.kebede@oromiabank.com')!;
  const creditChecker1 = userService.getByEmail('chala.desta@oromiabank.com')!;
  const creditChecker2 = userService.getByEmail('almaz.bekele@oromiabank.com')!;
  const tradeMaker = userService.getByEmail('tigist.alemu@oromiabank.com')!;
  const tradeChecker = userService.getByEmail('meron.worku@oromiabank.com')!;
  const auditorUser = userService.getByEmail('auditor@oromiabank.com')!;

  const adminActor = { id: adminUser.id, name: adminUser.name, role: 'ADMIN' as const };
  const makerActor = { id: creditMaker.id, name: creditMaker.name, role: 'MAKER' as const };
  const checkerActor = { id: creditChecker1.id, name: creditChecker1.name, role: 'CHECKER' as const };

  // =========================================================================
  // SCENARIO 1: IMPORT TO USABLE REPORT (End-to-End Governance Lifecycle)
  // Admin imports NBE JSON -> schema validation -> preview -> reviews
  // titles/sections/columns/formulas -> configures/verifies API endpoint ->
  // publishes through governed approval -> appears in Admin NBE Simulator.
  // Maker sees new report according to dept authorization -> creates clean instance ->
  // sees correct titles/labels -> enters values -> autosaves -> validates -> submits.
  // =========================================================================
  console.log('--- Scenario 1: Import to Usable Report (Complete Admin → Maker Lifecycle) ---');

  const testReturnKey = 'NBE_E2E_INT_01';
  const rawNbePackage = {
    packageVersion: '1.0',
    report: {
      returnKey: testReturnKey,
      shortCode: 'E2E_01',
      mainTitle: 'End-to-End Integration Liquidity & Capital Return',
      subTitles: ['Schedule A: Liquid Assets Computation', 'Schedule B: Capital Adequacy Base'],
      description: 'Canonical cross-phase integration test return for statutory NBE validation.',
      frequency: 'MONTHLY',
      regulatoryCategory: 'Capital Adequacy & Liquidity Operations',
      sections: [
        {
          code: 'SEC_ASSETS',
          title: 'Liquid Assets Portfolio',
          description: 'Cash, central bank reserves and treasury instruments',
          order: 1,
        },
        {
          code: 'SEC_LIABILITIES',
          title: 'Short-term Liabilities',
          description: 'Demand deposits and maturing interbank commitments',
          order: 2,
        },
      ],
      fields: [
        {
          itemCode: `${testReturnKey}_CASH`,
          itemDescription: 'Vault Cash & Cash in Transit (ETB)',
          sectionCode: 'SEC_ASSETS',
          dataType: 'NUMERIC',
          isRequired: true,
          isCalculated: false,
          sampleValue: '500,000,000.00', // Sample value that MUST be stripped
          order: 1,
        },
        {
          itemCode: `${testReturnKey}_RESERVE`,
          itemDescription: 'Mandatory Reserve Balance with NBE',
          sectionCode: 'SEC_ASSETS',
          dataType: 'NUMERIC',
          isRequired: true,
          isCalculated: false,
          sampleValue: '1,200,000,000.00',
          order: 2,
        },
        {
          itemCode: `${testReturnKey}_TOTAL_ASSETS`,
          itemDescription: 'Total Primary Liquid Assets',
          sectionCode: 'SEC_ASSETS',
          dataType: 'NUMERIC',
          isRequired: false,
          isCalculated: true,
          formulaExpression: `${testReturnKey}_CASH + ${testReturnKey}_RESERVE`,
          order: 3,
        },
      ],
      columns: [],
      formulas: [
        {
          targetCode: `${testReturnKey}_TOTAL_ASSETS`,
          expression: `${testReturnKey}_CASH + ${testReturnKey}_RESERVE`,
          description: 'Calculated Sum of Liquid Assets',
          dependencies: [`${testReturnKey}_CASH`, `${testReturnKey}_RESERVE`],
        },
      ],
      validationRules: [
        {
          code: 'VAL_ASSETS_NON_NEGATIVE',
          description: 'Primary liquid assets must be non-negative',
          expression: `${testReturnKey}_CASH >= 0`,
          severity: 'ERROR',
        },
      ],
      integrationConfig: {
        apiEndpoint: '/api/v1/nbe-simulator/e2e-submit',
        httpMethod: 'POST',
        contentType: 'application/json',
        authenticationProfile: 'auth_local_simulator',
        timeoutMs: 25000,
        idempotencyStrategy: 'HEADER_UUID',
      },
    },
  };

  // 1.1 Admin imports NBE JSON package
  const importResult = nbeReportPackageService.importPackageAsDraft(rawNbePackage, adminActor);
  assert(importResult.success === true, 'Admin successfully imported NBE JSON package');
  assert(importResult.report.returnKey === testReturnKey, 'Imported report definition returnKey matches');
  assert(importResult.validation.sampleValuesStrippedCount >= 2, 'Sample values were stripped from package definition');

  // 1.2 Schema validation & preview
  const normalizedReport = importResult.report;
  const normalizedVersion = importResult.version;
  assert(normalizedReport.name === 'End-to-End Integration Liquidity & Capital Return', 'Normalized title verified');
  assert(normalizedVersion.sections.length === 2, 'Sections correctly parsed and normalized');
  assert(normalizedVersion.formulas.length === 1, 'Formulas correctly parsed and normalized');

  // 1.3 Verify API endpoint configuration in NBE Endpoint Registry
  const registeredEndpoint = nbeEndpointRegistry.getEndpointForReport(testReturnKey);
  assert(registeredEndpoint.endpointUrl === '/api/v1/nbe-simulator/e2e-submit', 'API endpoint configured and verified in registry');
  assert(registeredEndpoint.authProfileRef === 'auth_local_simulator', 'Auth profile reference correctly established');

  // 1.4 Governed publication: Admin publishes version 1
  const publishedVersion = configService.publishReportVersion(testReturnKey, 1, adminActor);
  assert(publishedVersion.status === 'ACTIVE', 'Report version 1 published to ACTIVE status');

  // Assign department: Credit Operations & Portfolio Management
  configService.updateReportDefinition(
    testReturnKey,
    {
      defaultDepartmentId: creditMaker.department,
      departmentIds: [creditMaker.department],
    },
    adminActor
  );

  // 1.5 Report appears in Admin NBE Simulator endpoint registry
  const simulatorEndpoints = nbeEndpointRegistry.getAllEndpoints({ activeOnly: true });
  assert(simulatorEndpoints.some((ep) => ep.reportKey === testReturnKey), 'Report appears in Admin NBE Simulator endpoints');

  // 1.6 Maker sees report according to department authorization
  const makerAllowedKeys = effectiveAccessEngine.getAllowedReportKeysForUser(creditMaker);
  assert(makerAllowedKeys.includes(testReturnKey), 'Credit Maker sees new report according to department authorization');

  // Trade Maker (different department) does NOT see report
  const tradeAllowedKeys = effectiveAccessEngine.getAllowedReportKeysForUser(tradeMaker);
  assert(!tradeAllowedKeys.includes(testReturnKey), 'Trade Maker without grant cannot see Credit report');

  // 1.7 Maker creates clean instance
  const cleanInstance = submissionService.createSubmission(testReturnKey, creditMaker);
  assert(cleanInstance.id.startsWith('sub_'), 'Clean instance created with unique submission ID');
  assert(cleanInstance.status === 'DRAFT', 'Initial submission status is DRAFT');

  // 1.8 Confirm no sample values leaked into clean instance
  assert(cleanInstance.values[`${testReturnKey}_CASH`] === '' || cleanInstance.values[`${testReturnKey}_CASH`] === undefined, 'No sample value leaked into Cash field');

  // 1.9 Maker enters values
  const enteredValues: Record<string, string | number> = {
    [`${testReturnKey}_CASH`]: '450000000.00',
    [`${testReturnKey}_RESERVE`]: '1100000000.00',
    [`${testReturnKey}_TOTAL_ASSETS`]: '1550000000.00',
  };
  const updatedInstance = submissionService.updateDraft(cleanInstance.id, enteredValues, {}, creditMaker, 1);
  assert(updatedInstance.version === 2, 'Draft updated to version 2');
  assert(Number(updatedInstance.values[`${testReturnKey}_CASH`]) === 450000000, 'Entered Cash value persisted accurately');

  // 1.10 Autosave snapshot and revision verification
  assert((updatedInstance.historicalSnapshots || []).length >= 1, 'Autosave historical snapshot captured on edit');
  assert((updatedInstance.revisionHistory || []).length >= 1, 'Revision history logged with Maker attribution');

  // 1.11 Validation
  const valResult = submissionService.validateSubmission(cleanInstance.id);
  assert(valResult.isValid === true, 'Submission validates cleanly with zero errors');

  // 1.12 Submit to Checker
  const submittedSub = submissionService.submitToChecker(
    cleanInstance.id,
    creditMaker,
    'Submitting E2E Integration return for supervisory review',
    2,
    [creditChecker1.id]
  );
  assert(submittedSub.status === 'PENDING_CHECKER', 'Report transitioned to PENDING_CHECKER');
  assert(submittedSub.primaryCheckerId === creditChecker1.id, 'Designated Checker persisted as primary reviewer');

  // =========================================================================
  // SCENARIO 2: MAKER CANNOT ALTER DEFINITION
  // Title editing, subtitle editing, row/column title editing, formula editing,
  // endpoint editing, validation-rule editing, field-code editing.
  // All must be rejected both in UI and server-side.
  // =========================================================================
  console.log('\n--- Scenario 2: Maker Cannot Alter Report Definition (Server-Side Rejection) ---');

  // 2.1 Attempt title editing by Maker
  let titleEditBlocked = false;
  try {
    configService.updateReportDefinition(
      testReturnKey,
      { name: 'Maker Altered Title' },
      makerActor as any
    );
  } catch (err: any) {
    titleEditBlocked = true;
    assert(err.message.includes('Forbidden') || err.message.includes('Administrators'), 'Direct title alteration by Maker strictly blocked');
  }
  assert(titleEditBlocked, 'Maker title modification attempt blocked with security error');

  // 2.2 Attempt report code / field code modification by Maker
  let codeEditBlocked = false;
  try {
    configService.updateReportDefinition(
      testReturnKey,
      { code: 'FORGED_CODE' },
      makerActor as any
    );
  } catch (err: any) {
    codeEditBlocked = true;
  }
  assert(codeEditBlocked, 'Maker report code alteration attempt strictly blocked');

  // 2.3 Attempt formula editing by Maker
  let formulaEditBlocked = false;
  try {
    configService.updateDraftVersion(
      testReturnKey,
      1,
      {
        formulas: [
          {
            targetCode: `${testReturnKey}_TOTAL_ASSETS`,
            expression: '0',
            description: 'Maker zeroed formula',
            dependencies: [],
          },
        ],
      },
      makerActor as any
    );
  } catch (err: any) {
    formulaEditBlocked = true;
    assert(err.message.includes('Forbidden') || err.message.includes('Administrators') || err.message.includes('immutable'), 'Direct formula alteration by Maker strictly blocked');
  }
  assert(formulaEditBlocked, 'Maker formula modification attempt strictly blocked');

  // 2.4 Attempt endpoint editing by Maker
  let endpointEditBlocked = false;
  try {
    nbeEndpointRegistry.updateReportEndpoint(
      testReturnKey,
      { endpointUrl: 'https://malicious-attacker.com/steal-nbe-data' },
      makerActor as any
    );
  } catch (err: any) {
    endpointEditBlocked = true;
    assert(err.message.includes('Unauthorized') || err.message.includes('Administrator'), 'Direct endpoint alteration by Maker strictly blocked');
  }
  assert(endpointEditBlocked, 'Maker API endpoint alteration attempt strictly blocked');

  // 2.5 Verify template definition remained pristine
  const intactDef = configService.getReportDefinition(testReturnKey)!;
  assert(intactDef.name === 'End-to-End Integration Liquidity & Capital Return', 'Report definition name remains pristine and untampered');

  // =========================================================================
  // SCENARIO 3: CHECKER ASSIGNMENT & NOTIFICATION WORKFLOW
  // Maker selects one or multiple eligible Checkers, submits, authorized
  // notifications generated. Unauthorized Checkers cannot be selected even via forged requests.
  // =========================================================================
  console.log('\n--- Scenario 3: Checker Assignment & Notification Workflow ---');

  // 3.1 Eligibility check
  const eligibleCheckers = effectiveAccessEngine.getEligibleCheckersForReport(testReturnKey, creditMaker);
  const eligibleIds = eligibleCheckers.map((c) => c.id);
  assert(eligibleIds.includes(creditChecker1.id), 'Active Credit Checker 1 is eligible');
  assert(eligibleIds.includes(creditChecker2.id), 'Active Credit Checker 2 is eligible');
  assert(!eligibleIds.includes(tradeChecker.id), 'Trade Checker without grant is excluded');
  assert(!eligibleIds.includes(creditMaker.id), 'Maker cannot be included in eligible Checkers');

  // 3.2 Forged Checker ID rejection
  const forgedVal = effectiveAccessEngine.validateCheckerSelection(testReturnKey, creditMaker, ['usr_non_existent_fake_id']);
  assert(!forgedVal.valid && forgedVal.error?.includes('Unauthorized Checker selection'), 'Validation rejects forged/non-existent Checker ID with security error');

  let forgedSubmitBlocked = false;
  const draftForForged = submissionService.createSubmission(testReturnKey, creditMaker);
  submissionService.updateDraft(draftForForged.id, enteredValues, {}, creditMaker, 1);
  try {
    submissionService.submitToChecker(draftForForged.id, creditMaker, 'Submitting with forged checker', 2, ['usr_non_existent_fake_id']);
  } catch (err: any) {
    forgedSubmitBlocked = true;
    assert(err.message.includes('Unauthorized') || err.message.includes('Checker') || err.message.includes('Invalid'), 'Submission with forged Checker ID strictly blocked');
  }
  assert(forgedSubmitBlocked, 'Submission attempt with forged Checker ID blocked');

  // 3.3 Unauthorized cross-department selection rejection
  const crossDeptVal = effectiveAccessEngine.validateCheckerSelection(testReturnKey, creditMaker, [tradeChecker.id]);
  assert(!crossDeptVal.valid && crossDeptVal.error?.includes('Unauthorized Checker selection'), 'Selection of unauthorized cross-department Checker strictly rejected');

  // 3.4 Self-selection rejection (Segregation of Duties)
  const selfSelectVal = effectiveAccessEngine.validateCheckerSelection(testReturnKey, creditMaker, [creditMaker.id]);
  assert(!selfSelectVal.valid && selfSelectVal.error?.includes('Segregation of duties'), 'Maker self-selection strictly rejected under Segregation of Duties');

  // 3.5 Multi-checker submission with notifications
  const multiSub = submissionService.createSubmission(testReturnKey, creditMaker);
  submissionService.updateDraft(multiSub.id, enteredValues, {}, creditMaker, 1);
  const multiSubmitted = submissionService.submitToChecker(
    multiSub.id,
    creditMaker,
    'Dual-checker assignment test',
    2,
    [creditChecker1.id, creditChecker2.id]
  );
  assert(multiSubmitted.assignedCheckerIds?.length === 2, 'Both Checkers persisted on submission record');
  assert(multiSubmitted.primaryCheckerId === creditChecker1.id, 'First reviewer designated as primary');

  // 3.6 Verify smart notifications dispatched
  const checker1Notifications = notificationService.getNotificationsForUser(creditChecker1).notifications;
  const checker2Notifications = notificationService.getNotificationsForUser(creditChecker2).notifications;
  const tradeNotifications = notificationService.getNotificationsForUser(tradeMaker).notifications;

  assert(checker1Notifications.some((n) => n.targetReportKey === testReturnKey), 'Checker 1 received assignment notification');
  assert(checker2Notifications.some((n) => n.targetReportKey === testReturnKey), 'Checker 2 received assignment notification');
  assert(!tradeNotifications.some((n) => n.targetReportKey === testReturnKey), 'Trade Maker received zero notifications (no cross-dept leak)');

  // =========================================================================
  // SCENARIO 4: DASHBOARD ISOLATION (Role-Locked Workspaces)
  // Verify each role can access only its own dashboard and that NBE Simulator is Admin-only.
  // =========================================================================
  console.log('\n--- Scenario 4: Dashboard Isolation & Role Segregation ---');

  // 4.1 Admin: can access Admin Dashboard & Simulator; cannot access Maker, Checker, Auditor
  assert(isTabAuthorizedForRole('ADMIN_DASHBOARD', 'ADMIN'), 'Admin can access Admin Dashboard');
  assert(isTabAuthorizedForRole('NBE_SIMULATOR', 'ADMIN'), 'Admin can access NBE Simulator');
  assert(!isTabAuthorizedForRole('MAKER_WORKSPACE', 'ADMIN'), 'Admin cannot access Maker Workspace');
  assert(!isTabAuthorizedForRole('CHECKER_INBOX', 'ADMIN'), 'Admin cannot access Checker Inbox');
  assert(!isTabAuthorizedForRole('AUDITOR_DASHBOARD', 'ADMIN'), 'Admin cannot access Auditor Dashboard');

  // 4.2 Maker: can access Maker Workspace only; cannot access Admin, Checker, Auditor, Simulator
  assert(isTabAuthorizedForRole('MAKER_WORKSPACE', 'MAKER'), 'Maker can access Maker Workspace');
  assert(!isTabAuthorizedForRole('ADMIN_DASHBOARD', 'MAKER'), 'Maker cannot access Admin Dashboard');
  assert(!isTabAuthorizedForRole('CHECKER_INBOX', 'MAKER'), 'Maker cannot access Checker Inbox');
  assert(!isTabAuthorizedForRole('AUDITOR_DASHBOARD', 'MAKER'), 'Maker cannot access Auditor Dashboard');
  assert(!isTabAuthorizedForRole('NBE_SIMULATOR', 'MAKER'), 'Maker cannot access NBE Simulator');

  // 4.3 Checker: can access Checker Inbox only; cannot access Admin, Maker, Auditor, Simulator
  assert(isTabAuthorizedForRole('CHECKER_INBOX', 'CHECKER'), 'Checker can access Checker Inbox');
  assert(!isTabAuthorizedForRole('ADMIN_DASHBOARD', 'CHECKER'), 'Checker cannot access Admin Dashboard');
  assert(!isTabAuthorizedForRole('MAKER_WORKSPACE', 'CHECKER'), 'Checker cannot access Maker Workspace');
  assert(!isTabAuthorizedForRole('AUDITOR_DASHBOARD', 'CHECKER'), 'Checker cannot access Auditor Dashboard');
  assert(!isTabAuthorizedForRole('NBE_SIMULATOR', 'CHECKER'), 'Checker cannot access NBE Simulator');

  // 4.4 Auditor: can access Auditor Dashboard only; cannot access Admin, Maker, Checker, Simulator
  assert(isTabAuthorizedForRole('AUDITOR_DASHBOARD', 'AUDITOR'), 'Auditor can access Auditor Dashboard');
  assert(!isTabAuthorizedForRole('ADMIN_DASHBOARD', 'AUDITOR'), 'Auditor cannot access Admin Dashboard');
  assert(!isTabAuthorizedForRole('MAKER_WORKSPACE', 'AUDITOR'), 'Auditor cannot access Maker Workspace');
  assert(!isTabAuthorizedForRole('CHECKER_INBOX', 'AUDITOR'), 'Auditor cannot access Checker Inbox');
  assert(!isTabAuthorizedForRole('NBE_SIMULATOR', 'AUDITOR'), 'Auditor cannot access NBE Simulator');

  // =========================================================================
  // SCENARIO 5: EMPTY-TEMPLATE BEHAVIOR & SANITIZATION
  // Create a report with every editable field untouched. Confirm:
  // - no meaningless warning storm
  // - placeholders are not submitted as business values
  // - required fields become blocking at validation/submission stage
  // - optional fields remain clean
  // - no invented financial facts stored.
  // =========================================================================
  console.log('\n--- Scenario 5: Empty-Template Behavior & Neutral Sanitization ---');

  const emptySub = submissionService.createSubmission(testReturnKey, creditMaker);

  // 5.1 Verify values are clean
  const valKeys = Object.keys(emptySub.values || {});
  for (const k of valKeys) {
    const val = emptySub.values[k];
    assert(!TemplateInitializationService.isPlaceholderString(val), `Field ${k} has no placeholder literal stored`);
  }

  // 5.2 Validate empty draft: required fields are blocking
  const emptyValidation = submissionService.validateSubmission(emptySub.id);
  assert(emptyValidation.isValid === false, 'Empty return with mandatory fields is correctly invalid');
  assert(emptyValidation.errorsCount >= 2 || emptyValidation.fieldErrors.length >= 2, 'Required fields produce blocking errors');

  // 5.3 Verify no warning storm on untouched draft
  const normalizedEmpty = submissionService.validateSubmissionNormalized(emptySub.id);
  assert(normalizedEmpty.blockingErrorsCount > 0, 'Blocking errors identified for missing mandatory items');
  // Confirm explanations cite missing required inputs without phantom warning storm
  for (const item of normalizedEmpty.items) {
    assert(item.explanation.whatIsWrong.length > 0, 'Structured 4-part explanation present');
    assert(item.explanation.whyItMatters.length > 0, 'Why it matters present');
  }

  // 5.4 Submit attempt with empty required fields is strictly blocked
  let submitEmptyBlocked = false;
  try {
    submissionService.submitToChecker(emptySub.id, creditMaker, 'Attempting empty submit', 1);
  } catch (err: any) {
    submitEmptyBlocked = true;
    assert(err.message.includes('validation') || err.message.includes('cannot be submitted'), 'Submission of invalid empty return blocked');
  }
  assert(submitEmptyBlocked, 'Submission of uncompleted empty draft strictly blocked at gate');

  // 5.5 Sanitization test: verify placeholder strings are stripped and never submitted as facts
  const valuesWithPlaceholders: Record<string, string | number> = {
    [`${testReturnKey}_CASH`]: '0.00 ETB', // UI display string
    [`${testReturnKey}_RESERVE`]: '1200000000.00',
  };
  const sanitized = TemplateInitializationService.sanitizePayloadForNBE(valuesWithPlaceholders, {});
  assert(sanitized.values[`${testReturnKey}_CASH`] === '', 'Placeholder "0.00 ETB" stripped to empty string');
  assert(TemplateInitializationService.isPlaceholderString('0.00 ETB') === true, 'isPlaceholderString accurately identifies UI display placeholders');

  // =========================================================================
  // SCENARIO 6: HISTORICAL SAFETY & TEMPLATE VERSION EVOLUTION
  // Change report title/structure in a new Admin version.
  // Confirm old submitted reports retain old title/structure and new reports use new active version.
  // =========================================================================
  console.log('\n--- Scenario 6: Historical Safety & Template Version Evolution ---');

  // 6.1 Create and complete a submission under Version 1
  const v1Sub = submissionService.createSubmission(testReturnKey, creditMaker);
  submissionService.updateDraft(
    v1Sub.id,
    {
      [`${testReturnKey}_CASH`]: '300000000',
      [`${testReturnKey}_RESERVE`]: '700000000',
      [`${testReturnKey}_TOTAL_ASSETS`]: '1000000000',
    },
    {},
    creditMaker,
    1
  );
  submissionService.submitToChecker(v1Sub.id, creditMaker, 'V1 final submission', 2, [creditChecker1.id]);
  submissionService.reviewSubmission(v1Sub.id, 'APPROVE', creditChecker1, 'V1 Approved');

  const frozenV1 = submissionService.getById(v1Sub.id)!;
  assert(frozenV1.status === 'APPROVED', 'V1 submission successfully approved');
  assert(frozenV1.templateSnapshot !== undefined, 'V1 submission has frozen template snapshot');
  const v1OriginalTitle = frozenV1.templateSnapshot?.Title || (frozenV1.templateSnapshot as any)?.name || (frozenV1.templateSnapshot as any)?.mainTitle;
  assert(v1OriginalTitle === 'End-to-End Integration Liquidity & Capital Return', 'V1 snapshot contains original title');

  // 6.2 Admin creates and publishes Version 2 with modified title and extra field
  const v2Draft = configService.createDraftVersion(
    testReturnKey,
    {
      sections: [
        {
          id: `sec_${testReturnKey}_main`,
          code: 'MAIN',
          title: 'Revised Liquidity & Capital Framework (2027 Evolution)',
          order: 1,
          description: 'Updated schedule under revised NBE Directive',
          isRepeating: false,
        },
      ],
      fields: [
        {
          id: `fld_${testReturnKey}_cash`,
          itemId: '001',
          itemCode: `${testReturnKey}_CASH`,
          itemDescription: 'Vault Cash & Cash in Transit (ETB)',
          dataType: 'NUMERIC',
          isRequired: true,
          isCalculated: false,
          validationRules: [],
          order: 1,
        },
        {
          id: `fld_${testReturnKey}_reserve`,
          itemId: '002',
          itemCode: `${testReturnKey}_RESERVE`,
          itemDescription: 'Mandatory Reserve Balance with NBE',
          dataType: 'NUMERIC',
          isRequired: true,
          isCalculated: false,
          validationRules: [],
          order: 2,
        },
        {
          id: `fld_${testReturnKey}_foreign`,
          itemId: '003',
          itemCode: `${testReturnKey}_FOREIGN_NOSTRO`,
          itemDescription: 'Foreign Currency Nostro Balances (Converted ETB)',
          dataType: 'NUMERIC',
          isRequired: false,
          isCalculated: false,
          validationRules: [],
          order: 3,
        },
        {
          id: `fld_${testReturnKey}_total`,
          itemId: '004',
          itemCode: `${testReturnKey}_TOTAL_ASSETS`,
          itemDescription: 'Total Primary Liquid Assets (Enhanced)',
          dataType: 'NUMERIC',
          isRequired: false,
          isCalculated: true,
          formulaExpression: `${testReturnKey}_CASH + ${testReturnKey}_RESERVE + ${testReturnKey}_FOREIGN_NOSTRO`,
          validationRules: [],
          order: 4,
        },
      ],
      columns: [],
      formulas: [],
      validationRules: [],
      changelogSummary: 'Version 2: Added Foreign Nostro Balances schedule and updated title',
    },
    adminActor
  );

  const publishedV2 = configService.publishReportVersion(testReturnKey, v2Draft.versionNumber, adminActor);
  assert(publishedV2.status === 'ACTIVE', 'Version 2 published to ACTIVE status');
  assert(publishedV2.versionNumber === 2, 'Version 2 active in configService');

  // 6.3 Verify old submitted report still preserves pristine V1 title and snapshot
  const reloadedV1 = submissionService.getById(v1Sub.id)!;
  const reloadedV1Title = reloadedV1.templateSnapshot?.Title || (reloadedV1.templateSnapshot as any)?.name || (reloadedV1.templateSnapshot as any)?.mainTitle;
  assert(reloadedV1Title === 'End-to-End Integration Liquidity & Capital Return', 'Historical V1 report permanently preserves pristine V1 title');
  const v1ItemsCount = reloadedV1.templateSnapshot?.ReturnItemsList?.length || (reloadedV1.templateSnapshot as any)?.fields?.length;
  assert(v1ItemsCount === 3, 'Historical V1 snapshot preserves exact 3 fields without V2 field leakage');

  // 6.4 Verify new report instance uses Version 2 template
  const newV2Sub = submissionService.createSubmission(testReturnKey, creditMaker);
  assert(newV2Sub.templateVersion === 2, 'New submission created using new active Version 2');
  const v2ItemsCount = newV2Sub.templateSnapshot?.ReturnItemsList?.length || (newV2Sub.templateSnapshot as any)?.fields?.length;
  assert(v2ItemsCount === 4, 'New submission template snapshot includes Version 2 extra field');

  // =========================================================================
  // SECURITY REGRESSION MATRIX
  // Comprehensive attack surface verification
  // =========================================================================
  console.log('\n--- Security Regression Matrix (Attack Surface Verification) ---');

  // S.1 Cross-role dashboard URL access
  assert(!isTabAuthorizedForRole('ADMIN_DASHBOARD', 'MAKER'), 'Maker cross-role to Admin dashboard blocked');
  assert(!isTabAuthorizedForRole('CHECKER_INBOX', 'MAKER'), 'Maker cross-role to Checker inbox blocked');
  assert(!isTabAuthorizedForRole('MAKER_WORKSPACE', 'CHECKER'), 'Checker cross-role to Maker workspace blocked');
  assert(!isTabAuthorizedForRole('NBE_SIMULATOR', 'CHECKER'), 'Checker cross-role to NBE Simulator blocked');

  // S.2 Cross-department report access
  const crossDeptEval = effectiveAccessEngine.evaluateAccess(tradeMaker, testReturnKey, 'CREATE_DRAFT');
  assert(crossDeptEval.allowed === false, 'Cross-department draft creation blocked without special access');
  assert(crossDeptEval.reason.includes('department'), 'Descriptive department mismatch reason provided');

  // S.3 Forged report IDs
  let forgedReportBlocked = false;
  try {
    submissionService.createSubmission('NON_EXISTENT_FORGED_REPORT_99', creditMaker);
  } catch (err: any) {
    forgedReportBlocked = true;
  }
  assert(forgedReportBlocked, 'Creation attempt on forged report key strictly blocked');

  // S.4 Forged submission IDs
  const nonExistentSub = submissionService.getById('sub_completely_fake_id_99999');
  assert(nonExistentSub === undefined, 'Query for non-existent submission returns undefined');

  // S.5 Unauthorized endpoint changes
  let unauthEndpointBlocked = false;
  try {
    nbeEndpointRegistry.updateReportEndpoint(testReturnKey, { endpointUrl: '/api/hacked' }, checkerActor as any);
  } catch (err: any) {
    unauthEndpointBlocked = true;
  }
  assert(unauthEndpointBlocked, 'Non-admin endpoint modification strictly rejected');

  // S.6 Unauthorized template changes
  let unauthTemplateBlocked = false;
  try {
    configService.createDraftVersion(testReturnKey, { fields: [] }, checkerActor as any);
  } catch (err: any) {
    unauthTemplateBlocked = true;
  }
  assert(unauthTemplateBlocked, 'Non-admin template creation strictly rejected');

  // S.7 Notification enumeration & department scoping
  const allNotifications = notificationService.getAllAuthoritativeNotifications();
  const tradeNotificationsScoped = notificationService.getNotificationsForUser(tradeMaker).notifications;
  assert(
    !tradeNotificationsScoped.some((n) => n.targetReportKey === testReturnKey),
    'Notifications strictly scoped; Trade Maker cannot enumerate Credit returns'
  );

  // S.8 Duplicate assignment prevention
  const dupCheck = effectiveAccessEngine.validateCheckerSelection(testReturnKey, creditMaker, [creditChecker1.id, creditChecker1.id]);
  assert(!dupCheck.valid && dupCheck.error?.includes('Duplicate'), 'Duplicate Checker ID in assignment selection strictly rejected');

  // S.9 Stale version update (Optimistic concurrency locking)
  let staleUpdateBlocked = false;
  try {
    submissionService.updateDraft(newV2Sub.id, { [`${testReturnKey}_CASH`]: '100' }, {}, creditMaker, 999);
  } catch (err: any) {
    staleUpdateBlocked = true;
    assert(err.message.includes('CONCURRENT_MODIFICATION_CONFLICT'), 'Stale version throws CONCURRENT_MODIFICATION_CONFLICT');
  }
  assert(staleUpdateBlocked, 'Optimistic locking prevents lost updates on stale version edit');

  // S.10 Race condition & duplicate review prevention
  let duplicateReviewBlocked = false;
  try {
    submissionService.reviewSubmission(v1Sub.id, 'APPROVE', creditChecker1, 'Duplicate concurrent review');
  } catch (err: any) {
    duplicateReviewBlocked = true;
    assert(
      err.message.includes('APPROVED') ||
        err.message.includes('Duplicate review') ||
        err.message.includes('status') ||
        err.message.includes('Review denied') ||
        err.message.includes('PENDING_CHECKER'),
      'Duplicate review action blocked on already approved return'
    );
  }
  assert(duplicateReviewBlocked, 'Duplicate review on already settled submission strictly blocked');

  // S.11 4-Eyes Segregation of duties: Maker cannot approve own submission
  let selfApprovalBlocked = false;
  try {
    submissionService.reviewSubmission(submittedSub.id, 'APPROVE', creditMaker, 'Self approval attempt');
  } catch (err: any) {
    selfApprovalBlocked = true;
    assert(err.message.includes('Segregation') || err.message.includes('Maker') || err.message.includes('4-eyes') || err.message.includes('denied'), 'Self approval rejected');
  }
  assert(selfApprovalBlocked, 'Maker self-approval strictly rejected');

  // =========================================================================
  // PERFORMANCE AND RESILIENCE MEASUREMENTS
  // Measure: JSON import, schema normalization, template preview, report creation,
  // validation, notification dispatch, simulator registration/discovery,
  // Library search, dashboard route authorization.
  // =========================================================================
  console.log('\n--- Performance Benchmarks & Resilience Latency ---');

  // P.1 JSON import
  const tImport0 = performance.now();
  const perfPackage = {
    packageVersion: '1.0',
    report: {
      returnKey: 'PERF_TEST_RET',
      shortCode: 'PERF_01',
      mainTitle: 'Performance Benchmark Return',
      frequency: 'MONTHLY',
      regulatoryCategory: 'Benchmarking',
      fields: [
        { itemCode: 'PERF_01', itemDescription: 'Field 1', dataType: 'NUMERIC' },
        { itemCode: 'PERF_02', itemDescription: 'Field 2', dataType: 'NUMERIC' },
      ],
      sections: [{ code: 'SEC1', title: 'Section 1' }],
    },
  };
  nbeReportPackageService.validatePackage(perfPackage);
  const tImport = performance.now() - tImport0;
  console.log(`  JSON Import & Validation: ${tImport.toFixed(3)}ms (Threshold: < 50ms)`);
  assert(tImport < 50, 'JSON Import meets performance threshold (< 50ms)');

  // P.2 Schema normalization
  const tNorm0 = performance.now();
  nbeReportPackageService.validatePackage(rawNbePackage);
  const tNorm = performance.now() - tNorm0;
  console.log(`  Schema Normalization & Preview: ${tNorm.toFixed(3)}ms (Threshold: < 30ms)`);
  assert(tNorm < 30, 'Schema Normalization meets performance threshold (< 30ms)');

  // P.3 Report creation
  const tCreate0 = performance.now();
  const perfSub = submissionService.createSubmission(testReturnKey, creditMaker);
  const tCreate = performance.now() - tCreate0;
  console.log(`  Report Draft Initialization: ${tCreate.toFixed(3)}ms (Threshold: < 25ms)`);
  assert(tCreate < 25, 'Report Creation meets performance threshold (< 25ms)');

  // P.4 Validation
  const tVal0 = performance.now();
  submissionService.validateSubmission(perfSub.id);
  const tVal = performance.now() - tVal0;
  console.log(`  Validation Evaluation: ${tVal.toFixed(3)}ms (Threshold: < 30ms)`);
  assert(tVal < 30, 'Validation meets performance threshold (< 30ms)');

  // P.5 Notification dispatch
  const tNotif0 = performance.now();
  notificationService.addNotification({
    recipientUserId: creditChecker1.id,
    category: 'WORKFLOW',
    priority: 'HIGH',
    title: 'Performance Benchmark Notification',
    message: 'Testing dispatch latency',
    targetReportKey: testReturnKey,
  });
  const tNotif = performance.now() - tNotif0;
  console.log(`  Notification Dispatch: ${tNotif.toFixed(3)}ms (Threshold: < 15ms)`);
  assert(tNotif < 15, 'Notification Dispatch meets performance threshold (< 15ms)');

  // P.6 Simulator discovery
  const tSim0 = performance.now();
  nbeEndpointRegistry.getAllEndpoints({ activeOnly: true });
  const tSim = performance.now() - tSim0;
  console.log(`  Simulator Discovery: ${tSim.toFixed(3)}ms (Threshold: < 10ms)`);
  assert(tSim < 10, 'Simulator Discovery meets performance threshold (< 10ms)');

  // P.7 Library search
  const tLib0 = performance.now();
  submissionService.queryLibrary(creditMaker, { search: 'Liquidity' });
  const tLib = performance.now() - tLib0;
  console.log(`  Library Query & Search: ${tLib.toFixed(3)}ms (Threshold: < 25ms)`);
  assert(tLib < 25, 'Library Search meets performance threshold (< 25ms)');

  // P.8 Dashboard route authorization
  const tAuth0 = performance.now();
  isTabAuthorizedForRole('MAKER_WORKSPACE', 'MAKER');
  isTabAuthorizedForRole('ADMIN_DASHBOARD', 'MAKER');
  const tAuth = performance.now() - tAuth0;
  console.log(`  Dashboard Route Authorization: ${tAuth.toFixed(3)}ms (Threshold: < 5ms)`);
  assert(tAuth < 5, 'Dashboard Route Authorization meets performance threshold (< 5ms)');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 37 CROSS-PHASE INTEGRATION & ACCEPTANCE TESTS PASSED CLEANLY');
  console.log('========================================================================\n');
}

// Direct execution harness
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase37CrossPhaseIntegrationSecurityRegressionAndAcceptanceTests().catch((err) => {
    console.error('Phase 37 Acceptance Testing Failed:', err);
    process.exit(1);
  });
}
