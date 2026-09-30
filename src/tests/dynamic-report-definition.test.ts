/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { configService } from '../services/configService.ts';
import { getAllReports, getReportByKey, NBE_REPORTS } from '../data/report-registry.ts';
import { submissionService, DEMO_USERS } from '../services/submissionService.ts';
import { NBEAdapter } from '../services/nbeAdapter.ts';
import { auditorService } from '../services/auditorService.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[Dynamic Report Test Assertion Failed]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runDynamicReportDefinitionTests(): Promise<void> {
  console.log('\n========================================================================');
  console.log('--- 16. PHASE 4 DYNAMIC REPORT DEFINITION & TEMPLATE MANAGEMENT ---');
  console.log('========================================================================');

  const adminActor = { id: 'usr_admin', name: 'Compliance Administrator', role: 'ADMIN' };
  const makerUser = DEMO_USERS.find((u) => u.role === 'MAKER')!;
  const checkerUser = DEMO_USERS.find((u) => u.role === 'CHECKER' && u.department === makerUser.department)!;

  // --------------------------------------------------------------------------
  // PART 1: PRESERVATION OF 24 NBE STATUTORY REPORTS
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Preservation of 24 NBE Statutory Report Definitions ---');
  const allReports = getAllReports();
  assert(allReports.length >= 24, `Active registry contains at least 24 returns (found ${allReports.length})`);
  assert(NBE_REPORTS.length === 24, 'Baseline NBE statutory catalog retains strictly 24 pre-configured returns');

  const sampleKey = 'LOA_PORT_EP001';
  const sampleReport = getReportByKey(sampleKey);
  assert(Boolean(sampleReport), `Statutory return '${sampleKey}' resolved from registry`);
  assert(sampleReport!.ReturnItemsList.length > 0, `${sampleKey} has ${sampleReport!.ReturnItemsList.length} fixed fields`);
  assert(sampleReport!.Formulas.length > 0, `${sampleKey} has statutory calculation formulas`);

  const dynamicSample = getReportByKey('TOP_20_BOR_TB001');
  assert(Boolean(dynamicSample), `Statutory return 'TOP_20_BOR_TB001' resolved from registry`);
  assert(dynamicSample!.DynamicItemsList.length > 0, `TOP_20_BOR_TB001 has ${dynamicSample!.DynamicItemsList.length} dynamic schedule area(s)`);

  // Verify SSOT Seeding of 24 Reports
  const ssotReport = configService.getReportDefinition(sampleKey);
  assert(Boolean(ssotReport), `SSOT contains metadata definition for '${sampleKey}'`);
  assert(ssotReport!.currentVersion >= 1, `SSOT reports have active version number >= 1`);
  assert(ssotReport!.activeVersionSnapshot !== undefined, `SSOT report contains active version snapshot`);

  // --------------------------------------------------------------------------
  // PART 2: METADATA-DRIVEN REPORT DEFINITION CAPABILITY
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Metadata-Driven Report Definition Creation ---');
  const newReturnKey = 'OROMIA_AGRI_CR001';
  const created = configService.createReportDefinition(
    {
      returnKey: newReturnKey,
      code: 'AGRI_CR001',
      name: 'Agricultural Credit & Seasonal Lending Return',
      description: 'Prudential return for commercial farming and coffee export facilities.',
      category: 'Credit & Lending',
      frequency: 'QUARTERLY',
      status: 'DRAFT',
      defaultDepartmentId: 'dept_credit_ops',
      departmentIds: ['dept_credit_ops', 'dept_risk_mgmt'],
      initialStatus: 'DRAFT',
      changelogSummary: 'Initial metadata-driven definition for agricultural financing',
      fields: [
        {
          id: 'fld_agri_001',
          itemId: '00001',
          itemCode: 'AGRI_EXP_001',
          itemDescription: 'Direct Agricultural Seasonal Loans Outstanding',
          dataType: 'NUMERIC',
          isRequired: true,
          isCalculated: false,
          validationRules: [],
          order: 1,
        },
        {
          id: 'fld_agri_002',
          itemId: '00002',
          itemCode: 'AGRI_EXP_002',
          itemDescription: 'Agro-processing & Value Chain Facility Balances',
          dataType: 'NUMERIC',
          isRequired: true,
          isCalculated: false,
          validationRules: [],
          order: 2,
        },
        {
          id: 'fld_agri_003',
          itemId: '00003',
          itemCode: 'AGRI_TOTAL',
          itemDescription: 'Total Agricultural Portfolio Exposure',
          dataType: 'NUMERIC',
          isRequired: false,
          isCalculated: true,
          formulaExpression: 'AGRI_EXP_001 + AGRI_EXP_002',
          validationRules: [],
          order: 3,
        },
      ],
      columns: [
        {
          id: 'col_agri_farmer',
          columnKey: 'COOPERATIVE_NAME',
          headerLabel: 'Primary Union / Producer Cooperative',
          dataType: 'STRING',
          isRequired: true,
          order: 1,
          width: '260px',
        },
        {
          id: 'col_agri_crop',
          columnKey: 'CROP_CATEGORY',
          headerLabel: 'Agricultural Commodity Type (Coffee / Grain / Oilseed)',
          dataType: 'STRING',
          isRequired: true,
          order: 2,
          width: '180px',
        },
        {
          id: 'col_agri_hectares',
          columnKey: 'HECTARES_CULTIVATED',
          headerLabel: 'Arable Land Area (Hectares)',
          dataType: 'NUMERIC',
          isRequired: false,
          order: 3,
          width: '140px',
        },
      ],
      sections: [
        {
          id: 'sec_agri_main',
          code: 'CORE_EXP',
          title: 'Direct Agricultural Credit Facilities',
          order: 1,
          description: 'Production credit, crop cultivation, harvesting facilities',
          isRepeating: false,
        },
      ],
      formulas: [
        {
          targetCode: 'AGRI_TOTAL',
          expression: 'AGRI_EXP_001 + AGRI_EXP_002',
          description: 'Total Agricultural Portfolio Exposure',
          dependencies: ['AGRI_EXP_001', 'AGRI_EXP_002'],
        },
      ],
      nbeMapping: {
        returnKey: newReturnKey,
        instCode: '0000013',
        finYear: 2026,
        scheduleSheet: 'AGRI_SCHED_01',
      },
    },
    adminActor
  );

  assert(Boolean(created.report), `Created report definition '${newReturnKey}'`);
  assert(created.version.status === 'DRAFT', `Initial version status is DRAFT`);
  assert(created.version.versionNumber === 1, `Initial version number is 1`);
  assert(created.version.fields.length === 3, `Version defines 3 return fields`);
  assert(created.version.columns.length === 3, `Version defines 3 dynamic columns`);
  assert(created.version.sections.length === 1, `Version defines 1 section`);
  assert(created.version.formulas.length === 1, `Version defines 1 formula`);

  // --------------------------------------------------------------------------
  // PART 3: STRUCTURAL VALIDATION & CYCLE DETECTION
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Version Structural Validation & Formula Dependency Verification ---');
  const validResult = configService.validateReportVersion(newReturnKey, 1);
  assert(validResult.valid === true, 'Valid version passes structural checks');
  assert(validResult.errors.length === 0, 'No errors in correctly configured version');

  // Verify that status transitioned to VALIDATED
  const validatedVer = configService.getReportVersion(newReturnKey, 1);
  assert(validatedVer?.status === 'VALIDATED', `Version status transitioned to VALIDATED`);

  // Test Circular Dependency Detection
  configService.updateDraftVersion(
    newReturnKey,
    1,
    {
      formulas: [
        { targetCode: 'AGRI_EXP_001', expression: 'AGRI_EXP_002 + 10', dependencies: ['AGRI_EXP_002'] },
        { targetCode: 'AGRI_EXP_002', expression: 'AGRI_TOTAL * 0.5', dependencies: ['AGRI_TOTAL'] },
        { targetCode: 'AGRI_TOTAL', expression: 'AGRI_EXP_001 * 2', dependencies: ['AGRI_EXP_001'] }, // Creates cycle!
      ],
    },
    adminActor
  );

  const circularResult = configService.validateReportVersion(newReturnKey, 1);
  assert(circularResult.valid === false, 'Validation rejects circular formula dependency graph');
  assert(
    circularResult.errors.some((e) => e.includes('Circular formula calculation dependency')),
    'Error message specifically identifies circular dependency'
  );

  // Restore clean formula
  configService.updateDraftVersion(
    newReturnKey,
    1,
    {
      formulas: [
        {
          targetCode: 'AGRI_TOTAL',
          expression: 'AGRI_EXP_001 + AGRI_EXP_002',
          description: 'Total Agricultural Portfolio Exposure',
          dependencies: ['AGRI_EXP_001', 'AGRI_EXP_002'],
        },
      ],
    },
    adminActor
  );
  configService.validateReportVersion(newReturnKey, 1);

  // --------------------------------------------------------------------------
  // PART 4: VERSION PREVIEW & PUBLISH LIFECYCLE
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Preview and Authoritative Publish Lifecycle ---');
  const preview = configService.previewReportVersion(newReturnKey, 1);
  assert(Boolean(preview.previewMetadata), 'Preview metadata successfully generated');
  assert(preview.previewMetadata.ReturnKey === newReturnKey, 'Preview retains correct ReturnKey');
  assert(preview.version.status === 'PREVIEW', 'Version transitions to PREVIEW state');

  // Publish Version 1
  const publishedV1 = configService.publishReportVersion(
    newReturnKey,
    1,
    adminActor,
    'Official publication of Agricultural Credit & Seasonal Lending Return v1'
  );
  assert(publishedV1.status === 'ACTIVE', 'Published version is now ACTIVE');
  assert(Boolean(publishedV1.publishedAt), 'Published version contains publishedAt timestamp');

  // Active catalog synchronization
  const inRegistryV1 = getReportByKey(newReturnKey);
  assert(Boolean(inRegistryV1), 'Published return is immediately available in active regulatory registry');
  assert(inRegistryV1?.ReturnItemsList.length === 3, 'Active catalog has 3 return items from SSOT metadata');

  // --------------------------------------------------------------------------
  // PART 5: DYNAMIC FORM SUBMISSION USING VERSION 1 SCHEMA
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Dynamic Form Generation & Maker Submission on Version 1 ---');
  const subV1 = submissionService.createSubmission(newReturnKey, makerUser as any);
  assert(subV1.status === 'DRAFT', 'Maker draft successfully created for metadata return');
  assert(subV1.templateVersion === 1, 'Draft stamps templateVersion: 1');
  assert(subV1.templateSnapshot !== undefined, 'Draft seals immutable template snapshot');
  assert(subV1.templateSnapshot!.ReturnItemsList.length === 3, 'Snapshot retains Version 1 fields');

  // Populate values
  submissionService.updateDraft(
    subV1.id,
    {
      'AGRI_EXP_001': 150000000,
      'AGRI_EXP_002': 75000000,
      'AGRI_TOTAL': 225000000,
    },
    {
      1: [
        {
          id: 'row_1',
          areaId: 1,
          values: {
            'COOPERATIVE_NAME': 'Oromia Coffee Farmers Cooperative Union (OCFCU)',
            'CROP_CATEGORY': 'Arabica Washed Coffee',
            'HECTARES_CULTIVATED': 1250,
          },
        },
      ],
    },
    makerUser as any
  );

  // Maker submits to Checker
  const submittedV1 = submissionService.submitToChecker(subV1.id, makerUser as any, 'Q1 2026 agricultural figures ready');
  assert(submittedV1.status === 'PENDING_CHECKER', 'V1 submission is now PENDING_CHECKER');

  // Checker reviews & approves
  const approvedV1 = submissionService.reviewSubmission(subV1.id, 'APPROVE', checkerUser as any, '4-eyes sign-off');
  assert(approvedV1.status === 'APPROVED', 'V1 submission is APPROVED');

  // --------------------------------------------------------------------------
  // PART 6: SAFE STRUCTURAL CHANGE (VERSION BUMP V1 -> V2)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Administrator Safe Structural Change (Publish Version 2) ---');
  // Create draft for Version 2 (Adding new drought insurance & climate contingency fields)
  const draftV2 = configService.createDraftVersion(
    newReturnKey,
    {
      changelogSummary: 'Directive SBB/89/2026: Mandatory Climate Risk & Index Crop Insurance Sub-reporting',
      fields: [
        ...publishedV1.fields,
        {
          id: 'fld_agri_004',
          itemId: '00004',
          itemCode: 'AGRI_CLIMATE_INS',
          itemDescription: 'Satellite Index Crop Insurance Backed Lending Balance',
          dataType: 'NUMERIC',
          isRequired: false,
          isCalculated: false,
          validationRules: [],
          order: 4,
        },
      ],
    },
    adminActor
  );

  assert(draftV2.versionNumber === 2, 'Draft version is incremented to 2');
  assert(draftV2.status === 'DRAFT', 'Version 2 is in DRAFT state');
  assert(draftV2.fields.length === 4, 'Version 2 defines 4 fields (3 old + 1 new climate field)');

  // Validate Version 2
  const v2Val = configService.validateReportVersion(newReturnKey, 2);
  assert(v2Val.valid === true, 'Version 2 passes structural validation');

  // Authoritatively publish Version 2
  const publishedV2 = configService.publishReportVersion(
    newReturnKey,
    2,
    adminActor,
    'Promoted Agricultural Return to Version 2 with Climate Insurance reporting'
  );
  assert(publishedV2.status === 'ACTIVE', 'Version 2 is now ACTIVE');

  // VERIFY IMMUTABILITY: Version 1 must NOT be destructively mutated!
  const archivedV1 = configService.getReportVersion(newReturnKey, 1);
  assert(archivedV1?.status === 'SUPERSEDED', 'Historical Version 1 is marked SUPERSEDED');
  assert(Boolean(archivedV1?.effectiveTo), 'Historical Version 1 has an effectiveTo timestamp');
  assert(archivedV1?.fields.length === 3, 'Historical Version 1 fields are strictly preserved (3 fields)');

  // --------------------------------------------------------------------------
  // PART 7: HISTORICAL REPRODUCIBILITY VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Historical Submission Reproducibility & Dual Template Behavior ---');
  // Historical submission subV1 must still render Version 1 schema (3 fields)
  const historicalSub = submissionService.getById(subV1.id)!;
  assert(historicalSub.templateVersion === 1, 'Historical submission retains templateVersion 1');
  assert(historicalSub.templateSnapshot!.ReturnItemsList.length === 3, 'Historical submission template snapshot remains frozen at 3 fields');
  assert(!historicalSub.templateSnapshot!.ReturnItemsList.some((i: any) => i.Code === 'AGRI_CLIMATE_INS'), 'Historical submission snapshot does NOT contain Version 2 field');

  // NEW submission must consume active Version 2 schema (4 fields)
  const subV2 = submissionService.createSubmission(newReturnKey, makerUser as any);
  assert(subV2.templateVersion === 2, 'New submission created after version bump consumes templateVersion 2');
  assert(subV2.templateSnapshot!.ReturnItemsList.length === 4, 'New submission template snapshot has 4 fields');
  assert(subV2.templateSnapshot!.ReturnItemsList.some((i: any) => i.Code === 'AGRI_CLIMATE_INS'), 'New submission snapshot includes Version 2 climate field');

  // --------------------------------------------------------------------------
  // PART 8: AUDITOR VISIBILITY & EVIDENCE INTEGRITY
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Auditor Inspection & Finding Creation on Metadata Report ---');
  const auditQueue = auditorService.getWorkQueue();
  assert(auditQueue.length > 0, 'Auditor work queue is populated');

  const finding = auditorService.createFinding({
    reportKey: newReturnKey,
    submissionId: subV1.id,
    department: 'Credit Operations & Portfolio Management',
    title: 'OCFCU Agricultural Facility Documentation Verification',
    description: 'Verified coffee export cooperative warehouse receipts match reported loan limit.',
    severity: 'LOW',
    status: 'OPEN',
    auditorId: 'usr_auditor_1',
    auditorName: 'Compliance Auditor',
  });
  assert(Boolean(finding.id), 'Audit finding successfully created on metadata-driven report');

  // --------------------------------------------------------------------------
  // PART 9: CANONICAL NBE PAYLOAD GENERATION
  // --------------------------------------------------------------------------
  console.log('\n--- 9. Canonical NBE Payload Generation ---');
  const payloadV1 = NBEAdapter.buildNBEPayload(historicalSub);
  assert(payloadV1.ReturnKey === newReturnKey, 'Payload has correct ReturnKey');
  assert(payloadV1.InstCode === '0000013', 'Payload has Oromia Bank InstCode 0000013');
  assert(payloadV1.ReturnItemsList.length === 3, 'Payload reflects submission field count');
  assert(payloadV1.DynamicItemsList.length === 1, 'Payload reflects schedule breakdown tables');
  assert(payloadV1.DynamicItemsList[0].Rows.length === 1, 'Payload contains schedule row');

  // --------------------------------------------------------------------------
  // PART 10: REPORT RETIREMENT & SAFE DECOMMISSIONING
  // --------------------------------------------------------------------------
  console.log('\n--- 10. Report Retirement & Historical Preservation ---');
  const retiredRep = configService.retireReport(
    newReturnKey,
    adminActor,
    'Replaced by Unified Agrifinance Framework BSD/09/2027'
  );
  assert(retiredRep.status === 'RETIRED', 'Report definition is marked RETIRED');
  assert(Boolean(retiredRep.effectiveTo), 'Report has effectiveTo timestamp stamped');

  // Historical submission still exists and remains verifiable
  const postRetireSub = submissionService.getById(subV1.id);
  assert(Boolean(postRetireSub), 'Historical submission survives report retirement');
  assert(postRetireSub?.status === 'APPROVED', 'Historical submission status is unchanged');

  console.log('\n✅ All Phase 4 Dynamic Report Definition & Template Management tests passed cleanly.');
}
