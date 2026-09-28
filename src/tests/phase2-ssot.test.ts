/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Phase2Pipeline } from '../services/phase2Pipeline.ts';
import { ssotRegistry } from '../services/ssotRegistry.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[Phase 2 SSOT Assertion Failed]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase2SsotTests() {
  console.log('\n======================================================');
  console.log('--- 4. PHASE 2 SSOT, INGESTION & DATA QUALITY TESTS ---');
  console.log('======================================================');

  // Test 1: Ingestion from Core Banking System (Finacle / T24)
  const jobCore = await Phase2Pipeline.runIngestion('CORE_BANKING');
  assert(jobCore.status === 'COMPLETED', 'Core Banking ingestion job completed successfully');
  assert(jobCore.recordsIngested > 0, `Processed ${jobCore.recordsIngested.toLocaleString()} raw bronze records`);
  assert(jobCore.bronzeRecords === jobCore.recordsIngested, 'Bronze records match ingested raw records');
  assert(jobCore.goldAggregates === 24, 'Gold tier aggregates match 24 regulatory returns');

  // Test 2: Ingestion from ERP General Ledger (Oracle / SAP)
  const jobErp = await Phase2Pipeline.runIngestion('ERP');
  assert(jobErp.status === 'COMPLETED', 'ERP General Ledger ingestion job completed successfully');
  assert(jobErp.recordsIngested > 0, `Processed ${jobErp.recordsIngested.toLocaleString()} ERP records`);

  // Test 3: Data Quality Assessment across SSOT entities
  const quality = Phase2Pipeline.assessDataQuality();
  assert(quality.overallScore >= 80, `Data Quality overall score is high (${quality.overallScore}%)`);
  assert(quality.checks.length === 5, `Evaluated ${quality.checks.length} data quality dimensions`);
  for (const check of quality.checks) {
    assert(check.passed, `Data quality check passed: ${check.category} (${check.score}%)`);
  }

  // Test 4: General Ledger Reconciliation
  const recon = Phase2Pipeline.reconcileGeneralLedger();
  assert(Array.isArray(recon) && recon.length >= 3, `GL Reconciliation evaluated ${recon.length} balance sheet ledgers`);
  for (const account of recon) {
    assert(account.reconciled && account.status === 'BALANCED', `GL Account ${account.glAccount} (${account.glAccountName}) is balanced with zero variance`);
  }

  // Test 5: On-Demand Report Generation from SSOT Gold Layer
  const generatedReport = Phase2Pipeline.generateReportFromSSOT('M_LCPLC001');
  assert(Boolean(generatedReport), 'Report generated successfully from SSOT Gold Layer');
  assert(generatedReport.reportKey === 'M_LCPLC001', 'Generated report key is M_LCPLC001');
  assert(Object.keys(generatedReport.values).length > 0, `Generated ${Object.keys(generatedReport.values).length} values from SSOT`);

  console.log('✓ All Phase 2 SSOT, Ingestion & Data Quality tests passed successfully.');
}
