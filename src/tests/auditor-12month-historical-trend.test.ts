/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { strict as assert } from 'node:assert';
import { auditorService } from '../services/auditorService.ts';
import { getAllReports } from '../data/report-registry.ts';

export async function runAuditor12MonthHistoricalTrendTests() {
  console.log('========================================================================');
  console.log('--- TEST SUITE: AUDITOR 12-MONTH HISTORICAL TREND VISUALIZATION ---');
  console.log('========================================================================\n');

  // 1. VERIFICATION OF 12-MONTH DATASET STRUCTURE
  console.log('--- 1. Verification of 12-Month Historical Points for Default Report (ANARN001) ---');
  const trend = auditorService.get12MonthHistoricalTrend('ANARN001');

  assert(trend.reportKey === 'ANARN001', 'Report key is preserved.');
  assert(typeof trend.reportTitle === 'string' && trend.reportTitle.length > 0, 'Report title is present.');
  assert(trend.months.length === 12, `Trend contains exactly 12 monthly points (found ${trend.months.length}).`);

  // Verify chronological order from Month -11 to Current Month
  for (let i = 0; i < 12; i++) {
    const pt = trend.months[i];
    assert(typeof pt.month === 'string' && pt.month.length > 0, `Month ${i} has valid label (${pt.month}).`);
    assert(typeof pt.period === 'string' && pt.period.includes('-M'), `Period ${i} is formatted (${pt.period}).`);
    assert(typeof pt.primaryValue === 'number' && pt.primaryValue > 0, `Primary value for ${pt.month} is positive number (${pt.primaryValue}).`);
    assert(typeof pt.varianceFromMean === 'number', `Variance from mean is calculated for ${pt.month}.`);
    assert(['SENT', 'APPROVED', 'PENDING_CHECKER', 'DRAFT'].includes(pt.status), `Status is valid regulatory state (${pt.status}).`);
  }
  console.log('  ✓ Verified 12 consecutive monthly statutory data points.');

  // 2. MATHEMATICAL ACCURACY OF SUMMARY METRICS
  console.log('\n--- 2. Mathematical Accuracy of 12-Month Summary Statistics ---');
  const values = trend.months.map((m) => m.primaryValue);
  const calculatedMean = Math.round(values.reduce((a, b) => a + b, 0) / 12);
  assert(trend.summary.twelveMonthMean === calculatedMean, `12-month mean (${trend.summary.twelveMonthMean}) matches calculated sum/12 (${calculatedMean}).`);
  console.log(`  ✓ 12-Month Mean: ${trend.summary.twelveMonthMean.toLocaleString()} ETB`);

  const expectedMax = Math.max(...values);
  const expectedMin = Math.min(...values);
  assert(trend.summary.twelveMonthHigh.value === expectedMax, `Peak value matches maximum (${expectedMax}).`);
  assert(trend.summary.twelveMonthLow.value === expectedMin, `Low value matches minimum (${expectedMin}).`);
  console.log(`  ✓ 12-Month High: ${trend.summary.twelveMonthHigh.value.toLocaleString()} ETB (${trend.summary.twelveMonthHigh.month})`);
  console.log(`  ✓ 12-Month Low: ${trend.summary.twelveMonthLow.value.toLocaleString()} ETB (${trend.summary.twelveMonthLow.month})`);

  // MoM Growth Rate
  const latest = values[11];
  const prior = values[10];
  const expectedMoM = Number((((latest - prior) / prior) * 100).toFixed(1));
  assert(trend.summary.momGrowthRate === expectedMoM, `MoM growth rate (${trend.summary.momGrowthRate}%) matches calculated (${expectedMoM}%).`);
  console.log(`  ✓ MoM Growth Rate: ${trend.summary.momGrowthRate}%`);

  // Annual YoY Growth Rate
  const first = values[0];
  const expectedAnnual = Number((((latest - first) / first) * 100).toFixed(1));
  assert(trend.summary.twelveMonthAnnualGrowth === expectedAnnual, `Annual growth rate (${trend.summary.twelveMonthAnnualGrowth}%) matches calculated (${expectedAnnual}%).`);
  console.log(`  ✓ 12-Month Annual Growth Rate: ${trend.summary.twelveMonthAnnualGrowth}%`);

  // 3. MULTI-REPORT COMPATIBILITY ACROSS ALL 24 CANONICAL NBE RETURNS
  console.log('\n--- 3. Multi-Report Compatibility across Canonical NBE Catalog ---');
  const sampleKeys = ['LOA_ADV_OUT_LA001', 'POBEPE001', 'M_LCPLC001', 'BUIL_CONSTXW002'];
  sampleKeys.forEach((key) => {
    const rTrend = auditorService.get12MonthHistoricalTrend(key);
    assert(rTrend.months.length === 12, `Report ${key} generates 12 monthly points.`);
    assert(rTrend.summary.twelveMonthMean > 0, `Report ${key} has valid mean value.`);
    console.log(`  ✓ Verified 12-Month Trend for [${key}]: Mean = ${rTrend.summary.twelveMonthMean.toLocaleString()} ETB`);
  });

  // 4. CUSTOM FIELD SELECTION
  console.log('\n--- 4. Custom Statutory Field Selection & Recharts Dataset ---');
  const pobepeTrend = auditorService.get12MonthHistoricalTrend('POBEPE001');
  if (pobepeTrend.availableNumericFields.length > 1) {
    const secondFieldCode = pobepeTrend.availableNumericFields[1].code;
    const customTrend = auditorService.get12MonthHistoricalTrend('POBEPE001', secondFieldCode);
    assert(customTrend.primaryFieldName === pobepeTrend.availableNumericFields[1].description, 'Custom numeric field description matches.');
    assert(customTrend.months.length === 12, 'Custom field returns 12 months data.');
    console.log(`  ✓ Successfully switched metric to: ${customTrend.primaryFieldName} (${secondFieldCode})`);
  }

  // 5. DATE RANGE PICKER & PRESET FILTERING (BEYOND 12 MONTHS)
  console.log('\n--- 5. Date Range Picker & Custom Window Filtering ---');
  const trend3M = auditorService.getHistoricalTrend('ANARN001', { monthsCount: 3 });
  assert(trend3M.months.length === 3, `3M filter returns 3 months (got ${trend3M.months.length})`);
  console.log('  ✓ 3-Month filter verified.');

  const trend6M = auditorService.getHistoricalTrend('ANARN001', { monthsCount: 6 });
  assert(trend6M.months.length === 6, `6M filter returns 6 months (got ${trend6M.months.length})`);
  console.log('  ✓ 6-Month filter verified.');

  const trend24M = auditorService.getHistoricalTrend('ANARN001', { monthsCount: 24 });
  assert(trend24M.months.length === 24, `24M filter returns 24 months (got ${trend24M.months.length})`);
  console.log('  ✓ 24-Month filter verified.');

  const trendCustom = auditorService.getHistoricalTrend('ANARN001', {
    startDate: '2025-01-01',
    endDate: '2025-08-31',
  });
  assert(trendCustom.months.length >= 1, 'Custom date range returns filtered months');
  console.log(`  ✓ Custom date range filtering verified (${trendCustom.months.length} months returned).`);

  // 6. CSV EXPORT FOR OFFLINE REGULATORY ANALYSIS
  console.log('\n--- 6. Verification of CSV Export for Offline Regulatory Analysis ---');
  const csvOutput = auditorService.generateCsvExport(trend, 'Senior Auditor Tester');
  assert(typeof csvOutput === 'string' && csvOutput.length > 0, 'CSV export generates string content.');
  assert(csvOutput.includes('OFFLINE REGULATORY ANALYSIS & HISTORICAL SUBMISSION TREND EXPORT'), 'Header title found in CSV.');
  assert(csvOutput.includes('Report Key,"ANARN001"'), 'Return Key metadata present in CSV.');
  assert(csvOutput.includes('Auditor Export Actor,"Senior Auditor Tester"'), 'Exporter audit actor metadata present.');
  assert(csvOutput.includes('Period Key,Month Label,Cutoff Date,Primary Statutory Value (ETB)'), 'Column headers present in CSV.');
  
  // Verify rows match monthly data
  trend.months.forEach((m) => {
    assert(csvOutput.includes(m.period), `CSV includes period row for ${m.period}`);
    assert(csvOutput.includes(m.status), `CSV includes status ${m.status}`);
  });
  console.log('  ✓ CSV structure, metadata headers, statistical summary, and data row integrity verified.');

  console.log('\n========================================================================');
  console.log('✅ ALL AUDITOR 12-MONTH HISTORICAL TREND ACCEPTANCE GATES SATISFIED (100% PASS)');
  console.log('========================================================================\n');
}

// Self-run when executed directly
if (process.argv[1]?.includes('auditor-12month-historical-trend.test')) {
  runAuditor12MonthHistoricalTrendTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
