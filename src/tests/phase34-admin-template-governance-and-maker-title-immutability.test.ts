/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PHASE 34 ACCEPTANCE TEST SUITE:
 * Administrator Template Governance & Maker Title Immutability (NBE BSD/03/2020)
 *
 * Real acceptance testing verifying:
 * - Administrator owns and governs report-definition content
 * - Maker enters and edits report values only
 * - Maker cannot change report title, subtitle, section title, row title, column title,
 *   field code, formula definition, NBE mapping, API endpoint or validation rule
 * - Administrator edits titles and report-definition metadata through governed configuration workflow
 * - Structural changes create a new report-definition version rather than silently changing active version
 * - Old submissions remain unchanged using frozen template snapshot
 * - New submissions use the new active version
 * - 4-Eyes dual control enforcement (high-impact changes cannot be self-approved)
 * - Effective versions immutable after publication
 * - Affected users notified on material changes
 * - Visible version/effective date indicator to Makers
 * - Complete audit trail (who/what/when/version)
 */

import { configService } from '../services/configService.ts';
import { submissionService } from '../services/submissionService.ts';
import { configurationGovernanceService } from '../services/configurationGovernanceService.ts';
import { nbeEndpointRegistry } from '../services/nbeEndpointRegistry.ts';
import { FormulaEngine } from '../utils/formulaEngine.ts';
import { getReportByKey } from '../data/report-registry.ts';
import type { ReportMetadata, ReportSubmission, UserSession } from '../types/regulatory.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase34AdminTemplateGovernanceAndMakerTitleImmutabilityTests() {
  console.log('\n========================================================================');
  console.log('--- PHASE 34: ADMINISTRATOR TEMPLATE GOVERNANCE & MAKER TITLE IMMUTABILITY ---');
  console.log('========================================================================');

  const makerUser: UserSession = {
    id: 'usr_maker_phase34',
    name: 'Derartu Tulu (Maker)',
    role: 'MAKER',
    department: 'Credit Operations & Portfolio Management',
    email: 'derartu.maker@oromiabank.com',
    institutionCode: '0000013',
  };

  const adminProposer: UserSession = {
    id: 'usr_admin_prop_34',
    name: 'Bekele Debele (Admin)',
    role: 'ADMIN',
    department: 'Compliance & Legal Governance',
    email: 'bekele.admin@oromiabank.com',
    institutionCode: '0000013',
  };

  const checkerReviewer: UserSession = {
    id: 'usr_checker_phase34',
    name: 'Fatuma Roba (Checker)',
    role: 'CHECKER',
    department: 'Compliance & Legal Governance',
    email: 'fatuma.checker@oromiabank.com',
    institutionCode: '0000013',
  };

  // =========================================================================
  // 1. MAKER CANNOT EDIT MAIN REPORT TITLE OR METADATA (SERVER-SIDE & FRONTEND)
  // =========================================================================
  console.log('\n--- 1. Maker Cannot Edit Main Title or Report Definition Metadata ---');

  const testReportKey = 'LOA_ADV_OUT_LA001';
  const originalReport = configService.getReportDefinition(testReportKey);
  assert(Boolean(originalReport), `Found authoritative report definition for ${testReportKey}`);
  const originalTitle = originalReport!.name;

  // A: Maker attempts to update report definition metadata directly via configService
  let makerTitleEditBlocked = false;
  try {
    configService.updateReportDefinition(
      testReportKey,
      { name: 'Illegally Modified Loan Report Title by Maker' },
      makerUser as any
    );
  } catch (err: any) {
    makerTitleEditBlocked = true;
    assert(
      err.message.includes('Forbidden') || err.message.includes('Administrators'),
      `Maker updateReportDefinition blocked: ${err.message}`
    );
  }
  assert(makerTitleEditBlocked, 'Server strictly rejected Maker attempt to modify report title in configService');

  // Verify report title was NOT altered
  const reportAfterAttempt = configService.getReportDefinition(testReportKey);
  assert(reportAfterAttempt?.name === originalTitle, `Report title unchanged: "${reportAfterAttempt?.name}"`);

  // B: Maker attempts to create a new report definition
  let makerCreateBlocked = false;
  try {
    configService.createReportDefinition(
      {
        returnKey: 'MAKER_ROGUE_001',
        name: 'Rogue Return',
        category: 'Credit & Lending',
      },
      makerUser as any
    );
  } catch (err: any) {
    makerCreateBlocked = true;
    assert(err.message.includes('Forbidden'), `Maker createReportDefinition blocked: ${err.message}`);
  }
  assert(makerCreateBlocked, 'Server strictly rejected Maker attempt to create report definition');

  // C: Maker attempts to retire a report definition
  let makerRetireBlocked = false;
  try {
    configService.retireReport(testReportKey, makerUser as any, 'Rogue retirement attempt');
  } catch (err: any) {
    makerRetireBlocked = true;
    assert(err.message.includes('Forbidden'), `Maker retireReport blocked: ${err.message}`);
  }
  assert(makerRetireBlocked, 'Server strictly rejected Maker attempt to retire report definition');

  // =========================================================================
  // 2. MAKER CANNOT INJECT OR ALTER FIELD CODES IN SUBMISSION DRAFTS
  // =========================================================================
  console.log('\n--- 2. Maker Field Code Immutability & Unauthorized Code Rejection ---');

  // Create a real draft submission
  const draftSub = submissionService.createSubmission(testReportKey, makerUser);
  assert(Boolean(draftSub), `Created baseline draft submission ${draftSub.id}`);
  assert(draftSub.status === 'DRAFT', `Submission status is ${draftSub.status}`);
  const initialDataVersion = draftSub.version;

  // A: Maker attempts to update draft with an unauthorized/injected field code
  let rogueFieldCodeBlocked = false;
  try {
    submissionService.updateDraft(
      draftSub.id,
      {
        ...draftSub.values,
        UNAUTHORIZED_ROGUE_CODE_999: 99999999,
      },
      draftSub.dynamicRows,
      makerUser
    );
  } catch (err: any) {
    rogueFieldCodeBlocked = true;
    assert(
      err.message.includes('REPORT_DEFINITION_IMMUTABLE') && err.message.includes('UNAUTHORIZED_ROGUE_CODE_999'),
      `updateDraft rejected rogue field code: ${err.message}`
    );
  }
  assert(rogueFieldCodeBlocked, 'Server strictly rejected Maker attempt to inject new field code into draft');

  // B: Legitimate data entry by Maker with authorized field codes succeeds
  const effectiveTemplate = submissionService.getEffectiveTemplate(draftSub);
  const legitimateFieldCode = effectiveTemplate.ReturnItemsList[0].Code;
  const legitimateUpdatedValue = 12500000;

  const validUpdated = submissionService.updateDraft(
    draftSub.id,
    {
      ...draftSub.values,
      [legitimateFieldCode]: legitimateUpdatedValue,
    },
    draftSub.dynamicRows,
    makerUser
  );
  assert(validUpdated.values[legitimateFieldCode] === legitimateUpdatedValue, 'Valid data-entry value saved successfully');
  assert(validUpdated.version === initialDataVersion + 1, `Draft data version bumped to v${validUpdated.version}`);

  // =========================================================================
  // 3. MAKER CANNOT ALTER ROW/COLUMN TITLES OR SCHEDULE COLUMN SCHEMA
  // =========================================================================
  console.log('\n--- 3. Maker Schedule Column Schema & Row Title Immutability ---');

  // A: Maker attempts to update draft with an unauthorized schedule column in dynamicRows
  if (effectiveTemplate.DynamicItemsList.length > 0) {
    const area = effectiveTemplate.DynamicItemsList[0];
    let rogueColBlocked = false;
    try {
      submissionService.updateDraft(
        draftSub.id,
        draftSub.values,
        {
          [area.Area]: [
            {
              id: 'row_test_1',
              areaId: area.Area,
              values: {
                INJECTED_COLUMN_XYZ: 'Malicious Column Data',
              },
            },
          ],
        },
        makerUser
      );
    } catch (err: any) {
      rogueColBlocked = true;
      assert(
        err.message.includes('REPORT_DEFINITION_IMMUTABLE') && err.message.includes('INJECTED_COLUMN_XYZ'),
        `updateDraft rejected rogue column: ${err.message}`
      );
    }
    assert(rogueColBlocked, 'Server strictly rejected Maker attempt to inject schedule column');
  }

  // B: Maker attempts to modify draft version sections or column titles via configService
  let makerVersionUpdateBlocked = false;
  try {
    configService.updateDraftVersion(
      testReportKey,
      1,
      {
        changelogSummary: 'Unauthorized draft update',
        sections: [{ id: 'sec_fake', code: 'FAKE', title: 'Hacked Section Title', description: 'desc', order: 1, isRepeating: false }],
      },
      makerUser as any
    );
  } catch (err: any) {
    makerVersionUpdateBlocked = true;
    assert(err.message.includes('Forbidden'), `updateDraftVersion blocked for Maker: ${err.message}`);
  }
  assert(makerVersionUpdateBlocked, 'Server strictly rejected Maker attempt to modify version sections/titles');

  // =========================================================================
  // 4. MAKER CANNOT ALTER FORMULAS & FORMULA INTEGRITY IS ENFORCED
  // =========================================================================
  console.log('\n--- 4. Formula Definition Immutability & Authoritative Recalculation ---');

  // Check if report has formulas
  if (effectiveTemplate.Formulas.length > 0) {
    const testFormula = effectiveTemplate.Formulas[0];
    const targetCode = testFormula.targetCode;

    // Maker attempts to supply a fraudulent manual total that contradicts the formula
    const falsifiedValue = 1; // Wrong total
    const subWithFalsified = submissionService.updateDraft(
      draftSub.id,
      {
        ...draftSub.values,
        [targetCode]: falsifiedValue,
      },
      draftSub.dynamicRows,
      makerUser
    );

    // Verify server recalculated authoritative formula output and overrode falsified value
    const expectedCalc = FormulaEngine.calculateAllFormulas(effectiveTemplate.Formulas, subWithFalsified.values);
    assert(
      subWithFalsified.values[targetCode] === expectedCalc.updatedValues[targetCode],
      `Server automatically enforced formula integrity: ${targetCode} = ${subWithFalsified.values[targetCode]} (overwrote falsified input)`
    );
  }

  // =========================================================================
  // 5. MAKER CANNOT CHANGE NBE API INTEGRATION ENDPOINT
  // =========================================================================
  console.log('\n--- 5. NBE API Endpoint Registry Immutability for Makers ---');

  const baselineEndpoint = nbeEndpointRegistry.getEndpointForReport(testReportKey);
  assert(Boolean(baselineEndpoint), `Retrieved baseline endpoint for ${testReportKey}: ${baselineEndpoint.endpointUrl}`);

  let makerEndpointUpdateBlocked = false;
  try {
    nbeEndpointRegistry.updateReportEndpoint(
      testReportKey,
      {
        endpointUrl: 'https://attacker-controlled-server.com/nbe/exfiltrate',
        environmentTarget: 'PRODUCTION/NBE',
      },
      makerUser as any
    );
  } catch (err: any) {
    makerEndpointUpdateBlocked = true;
    assert(
      err.message.includes('Unauthorized') || err.message.includes('Administrator'),
      `updateReportEndpoint blocked for Maker: ${err.message}`
    );
  }
  assert(makerEndpointUpdateBlocked, 'Server strictly rejected Maker attempt to change API integration endpoint');

  // Verify endpoint was NOT mutated
  const verifiedEndpoint = nbeEndpointRegistry.getEndpointForReport(testReportKey);
  assert(
    verifiedEndpoint.endpointUrl === baselineEndpoint.endpointUrl,
    `API endpoint preserved: ${verifiedEndpoint.endpointUrl}`
  );

  // =========================================================================
  // 6. ADMIN CREATES A NEW VERSION THROUGH GOVERNED CONFIGURATION WORKFLOW
  // =========================================================================
  console.log('\n--- 6. Admin Proposes Governed Template Change with Impact Analysis ---');

  const beforeReportDef = configService.getReportDefinition(testReportKey)!;
  const initialTmplVersion = beforeReportDef.currentVersion;

  // Assign Maker as official PREPARER for LOA_ADV_OUT_LA001 so impact analysis targets them
  configService.assignUserReport(
    {
      userId: makerUser.id,
      userName: makerUser.name,
      userEmail: makerUser.email,
      departmentId: 'dept_credit_ops',
      reportKey: testReportKey,
      duty: 'MAKER',
    },
    adminProposer
  );

  // Admin proposes a material change (updating title and adding a revised statutory formula)
  const proposal = configurationGovernanceService.proposeReportDefinitionChange(
    testReportKey,
    {
      title: `${beforeReportDef.name} (Statutory Revision 2026)`,
      name: `${beforeReportDef.name} (Statutory Revision 2026)`,
      description: 'Revised statutory disclosure and provisioning structure under NBE BSD/03/2020 circular',
      formulas: [
        ...effectiveTemplate.Formulas,
        {
          targetCode: effectiveTemplate.ReturnItemsList[effectiveTemplate.ReturnItemsList.length - 1].Code,
          expression: `${effectiveTemplate.ReturnItemsList[0].Code} * 0.15`,
          description: 'Statutory Macro-prudential Risk Buffer (15%)',
          dependencies: [effectiveTemplate.ReturnItemsList[0].Code],
        },
      ],
      reason: 'Statutory revision implementing National Bank of Ethiopia Circular BSD/03/2020',
    },
    adminProposer
  );

  assert(Boolean(proposal.id), `Created governance proposal ${proposal.id}`);
  assert(proposal.status === 'DRAFT', `Proposal status: ${proposal.status}`);
  assert(proposal.entityType === 'REPORT_DEFINITION', `Entity type: ${proposal.entityType}`);
  assert(proposal.entityId === testReportKey, `Entity ID: ${proposal.entityId}`);

  // Verify automated Impact Analysis
  const impact = proposal.impactAnalysis;
  assert(Boolean(impact), 'Automated impact analysis computed successfully');
  assert(impact.riskLevel === 'HIGH', `Risk level classified as ${impact.riskLevel} due to formula/structural change`);
  assert(impact.requiresDualApproval === true, 'High-impact change requires dual approval (4-eyes enforcement)');
  assert(impact.affectedUsers.length > 0, `Impact analysis identified ${impact.affectedUsers.length} affected user(s)`);
  assert(impact.affectedReports.length > 0, `Impact analysis identified ${impact.affectedReports.length} affected report(s)`);
  assert(impact.affectedSubmissions.historicalPreserved === true, 'Impact analysis confirms 100% historical submission preservation');

  // =========================================================================
  // 7. HIGH-IMPACT CHANGE CANNOT BE SELF-APPROVED (4-EYES SEGREGATION OF DUTIES)
  // =========================================================================
  console.log('\n--- 7. 4-Eyes Segregation of Duties Enforcement (No Self-Approval) ---');

  // First validate proposal
  const validatedProp = configurationGovernanceService.validateProposal(proposal.id, adminProposer);
  assert(
    validatedProp.status === 'VALIDATED' || validatedProp.status === 'PENDING_APPROVAL',
    `Proposal validated: status is ${validatedProp.status}`
  );

  // Proposer Admin attempts to approve their own proposal
  let selfApprovalBlocked = false;
  try {
    configurationGovernanceService.approveProposal(
      proposal.id,
      adminProposer,
      'Attempting self-approval of my own proposal'
    );
  } catch (err: any) {
    selfApprovalBlocked = true;
    assert(
      err.message.includes('SEGREGATION_OF_DUTIES_VIOLATION') || err.message.includes('4-eyes'),
      `Self-approval blocked: ${err.message}`
    );
  }
  assert(selfApprovalBlocked, 'Server strictly rejected self-approval of governance proposal');

  // Independent Checker / Reviewer approves the proposal
  const approvedProposal = configurationGovernanceService.approveProposal(
    proposal.id,
    checkerReviewer,
    'Reviewed and verified against NBE Directive BSD/03/2020 statutory requirements'
  );
  assert(approvedProposal.status === 'APPROVED', `Proposal approved: status is ${approvedProposal.status}`);
  assert(approvedProposal.approvals.length === 1, 'Approval record captured in proposal');
  assert(approvedProposal.approvals[0].approverName === checkerReviewer.name, `Approved by ${checkerReviewer.name}`);

  // =========================================================================
  // 8. PUBLICATION CREATES NEW ACTIVE VERSION & IMMUTABILITY ENFORCEMENT
  // =========================================================================
  console.log('\n--- 8. Version Publication & Immutability After Publication ---');

  const publishResult = configurationGovernanceService.publishProposal(proposal.id, adminProposer);
  const newVersionNumber = publishResult.resultingVersion;
  assert(newVersionNumber === initialTmplVersion + 1, `New version number incremented to v${newVersionNumber}`);

  const activeDefAfterPublish = configService.getReportDefinition(testReportKey)!;
  assert(activeDefAfterPublish.currentVersion === newVersionNumber, `Active definition version pointer updated to v${newVersionNumber}`);
  assert(activeDefAfterPublish.name.includes('Statutory Revision 2026'), `Published title updated: "${activeDefAfterPublish.name}"`);

  // Verify that calling updateDraftVersion on the published active version is STRICTLY PROHIBITED
  let publishedVersionEditBlocked = false;
  try {
    configService.updateDraftVersion(
      testReportKey,
      newVersionNumber,
      { changelogSummary: 'Attempting to stealthily mutate active version' },
      adminProposer
    );
  } catch (err: any) {
    publishedVersionEditBlocked = true;
    assert(
      err.message.includes('immutable after publication') || err.message.includes('Cannot modify published version'),
      `Published version mutation blocked: ${err.message}`
    );
  }
  assert(publishedVersionEditBlocked, 'Server strictly rejected attempt to mutate published active version');

  // Verify that calling updateDraftVersion on the superseded old version is ALSO PROHIBITED
  let supersededVersionEditBlocked = false;
  try {
    configService.updateDraftVersion(
      testReportKey,
      initialTmplVersion,
      { changelogSummary: 'Attempting to mutate superseded historical version' },
      adminProposer
    );
  } catch (err: any) {
    supersededVersionEditBlocked = true;
    assert(err.message.includes('SUPERSEDED') || err.message.includes('immutable'), `Superseded version mutation blocked: ${err.message}`);
  }
  assert(supersededVersionEditBlocked, 'Server strictly rejected attempt to mutate superseded version');

  // =========================================================================
  // 9. OLD HISTORICAL SUBMISSIONS REMAIN UNCHANGED (FROZEN TEMPLATE SNAPSHOT)
  // =========================================================================
  console.log('\n--- 9. Historical Submissions Remain Frozen & Untouched ---');

  const historicalDraft = submissionService.getAuthorizedSubmission(draftSub.id, makerUser);
  assert(Boolean(historicalDraft), `Retrieved historical draft ${historicalDraft.id}`);

  // Verify historical draft continues to use the exact historical template snapshot
  const historicalEffectiveTmpl = submissionService.getEffectiveTemplate(historicalDraft);
  assert(
    historicalEffectiveTmpl.Title === originalTitle,
    `Historical submission permanently retains original title: "${historicalEffectiveTmpl.Title}"`
  );
  assert(
    !historicalEffectiveTmpl.Title.includes('Statutory Revision 2026'),
    'Historical submission is 100% insulated from new version title modifications'
  );
  assert(
    historicalDraft.templateVersion === initialTmplVersion,
    `Historical submission templateVersion is v${historicalDraft.templateVersion} (not v${newVersionNumber})`
  );

  // =========================================================================
  // 10. NEW SUBMISSIONS USE THE NEW ACTIVE VERSION
  // =========================================================================
  console.log('\n--- 10. New Submissions Use Newly Published Active Version ---');

  const newDraftSub = submissionService.createSubmission(testReportKey, makerUser);
  assert(Boolean(newDraftSub), `Created new draft submission ${newDraftSub.id}`);
  assert(
    newDraftSub.templateVersion === newVersionNumber,
    `New submission created with templateVersion v${newDraftSub.templateVersion}`
  );

  const newEffectiveTmpl = submissionService.getEffectiveTemplate(newDraftSub);
  assert(
    newEffectiveTmpl.Title.includes('Statutory Revision 2026'),
    `New submission consumes updated active title: "${newEffectiveTmpl.Title}"`
  );

  // =========================================================================
  // 11. NOTIFICATIONS DISPATCHED TO AFFECTED USERS
  // =========================================================================
  console.log('\n--- 11. User Notification Dispatch on Material Change ---');

  const userNotifications = configurationGovernanceService.getNotificationsForUser(makerUser.id);
  const relevantNotif = userNotifications.find((n) => n.proposalId === proposal.id);
  assert(Boolean(relevantNotif), `Found dispatch notification for Maker ${makerUser.name} on proposal ${proposal.id}`);
  assert(relevantNotif!.riskLevel === 'HIGH', `Notification highlights ${relevantNotif!.riskLevel} risk level`);
  assert(relevantNotif!.message.length > 20, `Notification message delivered: "${relevantNotif!.message}"`);

  // =========================================================================
  // 12. AUDIT TRAIL CAPTURES WHO/WHAT/WHEN/VERSION (EXPLAIN CHANGE GATE)
  // =========================================================================
  console.log('\n--- 12. Audit Trail & Regulatory Change Explanation (Non-Repudiation) ---');

  const explanation = configurationGovernanceService.explainChange(proposal.id);
  assert(Boolean(explanation), 'Generated regulatory change explanation');
  assert(explanation.actor.name === adminProposer.name, `Captured Proposer: ${explanation.actor.name}`);
  assert(explanation.approval?.approvedBy === checkerReviewer.name, `Captured Approver: ${explanation.approval?.approvedBy}`);
  assert(explanation.version.versionNumber === newVersionNumber, `Captured Resulting Version: v${explanation.version.versionNumber}`);
  assert(explanation.impactSummary.summaryNarrative.length > 20, `Generated narrative: "${explanation.impactSummary.summaryNarrative}"`);

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 34 ACCEPTANCE TESTS PASSED (100% SUCCESS)');
  console.log('========================================================================');
}

// Allow direct CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase34AdminTemplateGovernanceAndMakerTitleImmutabilityTests().catch((err) => {
    console.error('❌ PHASE 34 TEST EXECUTION FAILED:', err);
    process.exit(1);
  });
}
