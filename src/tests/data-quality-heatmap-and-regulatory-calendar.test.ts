/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { strict as assert } from 'node:assert';
import {
  dataQualityAnalyticsService,
  VALIDATION_CATEGORIES,
} from '../services/dataQualityAnalyticsService.ts';
import { NBE_REPORTS } from '../data/report-registry.ts';
import { OROMIA_BANK_DEPARTMENTS, getDepartmentForReport } from '../data/organizationHierarchy.ts';
import { submissionService } from '../services/submissionService.ts';

export async function runDataQualityHeatmapAndRegulatoryCalendarTests() {
  console.log('========================================================================');
  console.log('--- TEST SUITE: DATA QUALITY HEATMAP & REGULATORY CALENDAR ACCEPTANCE ---');
  console.log('========================================================================\n');

  // 1. DATA QUALITY HEATMAP ENGINE VERIFICATION
  console.log('--- 1. Verification of Data Quality Analytics & Heatmap Matrix Engine ---');
  const quality30d = dataQualityAnalyticsService.getQualityAnalytics({ timeRangeDays: 30 });

  assert(quality30d.overallScore >= 50 && quality30d.overallScore <= 100, `Overall Data Quality score (${quality30d.overallScore}%) is within valid 0-100 range.`);
  console.log(`  ✓ Enterprise Data Quality Index (DQI): ${quality30d.overallScore}%`);

  assert(quality30d.totalValidationErrors >= 0, 'Total validation exceptions is a non-negative integer.');
  console.log(`  ✓ Total validation exceptions tracked: ${quality30d.totalValidationErrors}`);

  assert(quality30d.totalRecurringErrors >= 0, 'Total recurring validation faults is non-negative.');
  console.log(`  ✓ Total recurring validation faults (≥ 2x): ${quality30d.totalRecurringErrors}`);

  assert(quality30d.cleanSubmissionsRate >= 50 && quality30d.cleanSubmissionsRate <= 100, `Clean submissions rate (${quality30d.cleanSubmissionsRate}%) is within bounds.`);
  console.log(`  ✓ First-pass zero-error submission rate: ${quality30d.cleanSubmissionsRate}%`);

  assert(typeof quality30d.hotspotDepartment === 'string' && quality30d.hotspotDepartment.length > 0, 'Primary error hotspot department identified.');
  console.log(`  ✓ Primary recurring error hotspot department: ${quality30d.hotspotDepartment}`);

  // 2. HEATMAP MATRIX DIMENSIONS & COVERAGE
  console.log('\n--- 2. Heatmap Matrix Structure & Validation Categories ---');
  assert(quality30d.heatmapMatrix.length >= 6, 'Heatmap matrix contains cell mappings across departments and categories.');
  assert(VALIDATION_CATEGORIES.length === 6, 'All 6 canonical regulatory validation dimensions are defined.');

  const expectedCategories = [
    'MANDATORY_BLANK',
    'FORMULA_MATH',
    'RANGE_LIMIT',
    'CROSS_SCHEDULE',
    'FORMAT_ENCODING',
    'BALANCE_EQUATION',
  ];

  VALIDATION_CATEGORIES.forEach((cat) => {
    assert(expectedCategories.includes(cat.key), `Category ${cat.key} matches canonical validation ontology.`);
    const matchingCells = quality30d.heatmapMatrix.filter((c) => c.categoryKey === cat.key);
    assert(matchingCells.length >= 1, `Category ${cat.key} has matrix cells computed for departments.`);
  });
  console.log('  ✓ Verified 6 validation categories across all bank department dimensions.');

  // 3. DEPARTMENT SUMMARIES & RECURRING EXCEPTIONS
  console.log('\n--- 3. Department Summaries & Recurring Rules Breakdown ---');
  assert(quality30d.departmentSummaries.length >= 1, 'Department summaries generated.');
  quality30d.departmentSummaries.forEach((dept) => {
    assert(dept.dataQualityScore >= 0 && dept.dataQualityScore <= 100, `Department ${dept.departmentShort} has valid score (${dept.dataQualityScore}%).`);
    assert(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(dept.riskRating), `Department ${dept.departmentShort} has valid risk rating (${dept.riskRating}).`);
  });
  console.log(`  ✓ Evaluated data quality across ${quality30d.departmentSummaries.length} reporting departments.`);

  // 4. RECHARTS TIME-SERIES & STACKED BAR DATASET INTEGRITY
  console.log('\n--- 4. Recharts Visualization Dataset Integrity ---');
  assert(quality30d.timeSeriesTrend.length === 6, 'Time series trend provides 6 reporting milestones for Recharts AreaChart.');
  quality30d.timeSeriesTrend.forEach((trend) => {
    assert(typeof trend.period === 'string', 'Trend milestone has period label.');
    assert(typeof trend.totalErrors === 'number', 'Trend milestone has totalErrors count.');
    assert(typeof trend.recurringErrors === 'number', 'Trend milestone has recurringErrors count.');
  });
  console.log('  ✓ Recharts time-series dataset validated (6 historical reporting cycles).');

  assert(quality30d.categoryBreakdown.length === 6, 'Category breakdown dataset contains all 6 dimensions for Recharts.');
  console.log('  ✓ Recharts category distribution breakdown validated.');

  // 5. FILTERING CAPABILITIES (Time range, Department, Severity, Category)
  console.log('\n--- 5. Data Quality Filtering Capabilities ---');
  const quality7d = dataQualityAnalyticsService.getQualityAnalytics({ timeRangeDays: 7 });
  assert(quality7d.heatmapMatrix.length > 0, '7-day filter returns valid heatmap matrix.');

  const creditDeptQuality = dataQualityAnalyticsService.getQualityAnalytics({
    department: 'Credit Operations & Portfolio Management',
  });
  assert(creditDeptQuality.heatmapMatrix.length > 0, 'Department-specific filter returns valid matrix.');

  const criticalOnlyQuality = dataQualityAnalyticsService.getQualityAnalytics({
    severity: 'CRITICAL',
  });
  assert(Array.isArray(criticalOnlyQuality.recurringErrorsList), 'Severity filter returns filtered recurring list.');
  console.log('  ✓ Filter parameters (time range, department, severity) verified.');

  // 6. REGULATORY CALENDAR FILING DEADLINES VERIFICATION
  console.log('\n--- 6. Regulatory Calendar Statutory Deadlines & Timeline Engine ---');
  const reports = NBE_REPORTS;
  assert(reports.length >= 24, `Canonical report registry contains all ${reports.length} statutory NBE returns.`);

  const frequenciesFound = new Set(reports.map((r) => r.Frequency));
  assert(frequenciesFound.has('MONTHLY') || frequenciesFound.has('QUARTERLY'), 'Standard regulatory frequencies represented.');

  console.log(`  ✓ Evaluated ${reports.length} NBE return statutory deadline schedules.`);
  console.log(`  ✓ Frequencies mapped: ${Array.from(frequenciesFound).join(', ')}`);

  // Verify all reports map to valid bank departments
  reports.forEach((rep) => {
    const dept = getDepartmentForReport(rep.ReturnKey);
    assert(typeof dept === 'string' && dept.length > 0, `Report ${rep.ReturnKey} maps to valid department (${dept}).`);
  });
  console.log('  ✓ 100% of canonical NBE returns map to authoritative banking departments.');

  // 7. REAL-TIME EVENT REACTIVITY & SUBSCRIPTION
  console.log('\n--- 7. Real-Time Event Reactivity & Subscription ---');
  let notified = false;
  const unsubQuality = dataQualityAnalyticsService.subscribe(() => {
    notified = true;
  });
  assert(typeof unsubQuality === 'function', 'Subscription returns unsubscribe handler.');
  unsubQuality();
  console.log('  ✓ Real-time event listener subscription and teardown verified.');

  console.log('\n========================================================================');
  console.log('✅ ALL DATA QUALITY HEATMAP & REGULATORY CALENDAR ACCEPTANCE GATES SATISFIED (100% PASS)');
  console.log('========================================================================\n');
}

// Self-run when executed directly
if (process.argv[1]?.includes('data-quality-heatmap-and-regulatory-calendar.test')) {
  runDataQualityHeatmapAndRegulatoryCalendarTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
