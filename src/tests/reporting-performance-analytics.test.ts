/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import { reportingAnalyticsService } from '../services/reportingAnalyticsService.ts';
import { submissionService } from '../services/submissionService.ts';
import { userService } from '../services/userService.ts';

console.log('--- RUNNING REPORTING PERFORMANCE ANALYTICS ACCEPTANCE TEST SUITE ---');

export async function runReportingPerformanceAnalyticsTests() {
  console.log('\n--- 1. Verification of Default 30-Day Analytics Dataset & KPIs ---');
  const analytics30d = reportingAnalyticsService.getAnalytics({ timeRangeDays: 30 });
  const kpis = analytics30d.kpis;

  assert(kpis.totalSubmissions30d > 0, 'Total 30-day submissions count must be greater than zero.');
  console.log(`  ✓ Total 30-day statutory returns: ${kpis.totalSubmissions30d}`);

  assert(typeof kpis.avgTurnaroundHours === 'number' && kpis.avgTurnaroundHours >= 0, 'Average turnaround hours is a valid non-negative number.');
  console.log(`  ✓ Average 4-eyes review turnaround: ${kpis.avgTurnaroundHours} hours (Target SLA: 24.0h)`);

  assert(kpis.slaComplianceRate >= 0 && kpis.slaComplianceRate <= 100, 'SLA compliance rate is a percentage between 0 and 100.');
  console.log(`  ✓ Statutory SLA compliance rate: ${kpis.slaComplianceRate}%`);

  assert(kpis.firstPassRate >= 0 && kpis.firstPassRate <= 100, 'First-pass acceptance rate is a percentage between 0 and 100.');
  console.log(`  ✓ First-pass verification rate: ${kpis.firstPassRate}%`);

  assert(kpis.nbeTransmissionRate >= 0 && kpis.nbeTransmissionRate <= 100, 'NBE direct transmission rate is a percentage between 0 and 100.');
  console.log(`  ✓ NBE transmission delivery rate: ${kpis.nbeTransmissionRate}%`);

  assert(kpis.totalDepartmentsReporting >= 1, 'Multiple bank departments are represented in the reporting ledger.');
  console.log(`  ✓ Reporting bank departments count: ${kpis.totalDepartmentsReporting}`);

  // Acceptance Rate Trend Indicators compared to previous reporting period
  assert(typeof kpis.submissionAcceptanceRate === 'number' && kpis.submissionAcceptanceRate >= 0, 'Submission acceptance rate is valid.');
  assert(typeof kpis.priorSubmissionAcceptanceRate === 'number' && kpis.priorSubmissionAcceptanceRate >= 0, 'Prior submission acceptance rate is valid.');
  assert(typeof kpis.acceptanceRateTrendPercentage === 'number', 'Acceptance rate trend percentage is a valid number.');
  console.log(`  ✓ Submission Acceptance Rate: ${kpis.submissionAcceptanceRate}% (Trend vs Prior Period: ${kpis.acceptanceRateTrendPercentage >= 0 ? '+' : ''}${kpis.acceptanceRateTrendPercentage}%, Prior: ${kpis.priorSubmissionAcceptanceRate}%)`);

  // Average Turnaround Time Trend Indicators compared to previous reporting period
  assert(typeof kpis.priorAvgTurnaroundHours === 'number' && kpis.priorAvgTurnaroundHours >= 0, 'Prior avg turnaround hours is valid.');
  assert(typeof kpis.turnaroundTrendPercentage === 'number', 'Turnaround time trend percentage is a valid number.');
  console.log(`  ✓ Average Turnaround Time: ${kpis.avgTurnaroundHours}h (Trend vs Prior Period: ${kpis.turnaroundTrendPercentage > 0 ? '+' : ''}${kpis.turnaroundTrendPercentage}%, Prior: ${kpis.priorAvgTurnaroundHours}h)`);

  console.log('\n--- 2. Chronological 30-Day Daily Volume Trend Verification ---');
  const dailyTrends = analytics30d.dailyTrends;
  assert.strictEqual(dailyTrends.length, 30, 'Daily trends array must contain exactly 30 chronological day buckets for a 30-day window.');

  // Verify daily buckets are chronologically ordered
  for (let i = 1; i < dailyTrends.length; i++) {
    const prevDate = new Date(dailyTrends[i - 1].date).getTime();
    const currDate = new Date(dailyTrends[i].date).getTime();
    assert(currDate > prevDate, `Daily timeline is strictly chronological: ${dailyTrends[i - 1].date} < ${dailyTrends[i].date}`);
  }
  console.log(`  ✓ 30-day timeline verified from ${dailyTrends[0].date} to ${dailyTrends[29].date}`);

  const totalCreatedSum = dailyTrends.reduce((acc, d) => acc + d.created, 0);
  assert(totalCreatedSum > 0, 'Sum of created submissions across 30 days is positive.');
  console.log(`  ✓ Cumulative created volume in 30 days: ${totalCreatedSum}`);

  console.log('\n--- 3. Department Performance & SLA Breakdown ---');
  const depts = analytics30d.departmentPerformance;
  assert(depts.length >= 1, 'Department performance breakdown must contain reporting departments.');

  let totalDeptSubmissions = 0;
  for (const dept of depts) {
    assert(dept.department.length > 0, 'Department name must be non-empty.');
    assert(dept.totalSubmissions > 0, 'Department has recorded returns.');
    assert(dept.avgTurnaroundHours >= 0, 'Department turnaround hours is non-negative.');
    assert(dept.complianceRate >= 0 && dept.complianceRate <= 100, 'Department compliance rate is valid.');
    totalDeptSubmissions += dept.totalSubmissions;
  }
  assert.strictEqual(totalDeptSubmissions, kpis.totalSubmissions30d, 'Sum of department submissions matches total 30-day submissions.');
  console.log(`  ✓ Department performance verified across ${depts.length} distinct banking divisions.`);

  console.log('\n--- 4. Regulatory Pipeline Status Distribution ---');
  const statusDist = analytics30d.statusDistribution;
  assert(statusDist.length >= 1, 'Status distribution must have active categories.');
  const totalPercentage = statusDist.reduce((acc, s) => acc + s.percentage, 0);
  assert(Math.abs(totalPercentage - 100) < 1.0, `Total status distribution percentage sums to ~100% (got ${totalPercentage}%).`);
  console.log(`  ✓ Status distribution verified across ${statusDist.length} statutory workflow states.`);

  console.log('\n--- 5. Review Turnaround Time Buckets ---');
  const buckets = analytics30d.approvalBuckets;
  assert.strictEqual(buckets.length, 5, 'Must contain 5 distinct turnaround buckets (<2h, 2-6h, 6-12h, 12-24h, >24h).');
  const bucketSum = buckets.reduce((acc, b) => acc + b.count, 0);
  assert(bucketSum > 0, 'Turnaround buckets contain reviewed submission counts.');
  console.log(`  ✓ Turnaround buckets correctly categorized ${bucketSum} reviewed submissions.`);

  console.log('\n--- 6. Time Range Filtering (7D, 14D, 30D, 90D) ---');
  const analytics7d = reportingAnalyticsService.getAnalytics({ timeRangeDays: 7 });
  const analytics14d = reportingAnalyticsService.getAnalytics({ timeRangeDays: 14 });
  const analytics90d = reportingAnalyticsService.getAnalytics({ timeRangeDays: 90 });

  assert.strictEqual(analytics7d.dailyTrends.length, 7, '7-day filter yields 7 daily points.');
  assert.strictEqual(analytics14d.dailyTrends.length, 14, '14-day filter yields 14 daily points.');
  assert.strictEqual(analytics90d.dailyTrends.length, 90, '90-day filter yields 90 daily points.');
  assert(analytics7d.kpis.totalSubmissions30d <= analytics30d.kpis.totalSubmissions30d, '7-day volume is <= 30-day volume.');
  assert(analytics30d.kpis.totalSubmissions30d <= analytics90d.kpis.totalSubmissions30d, '30-day volume is <= 90-day volume.');
  console.log(`  ✓ Time range filtering validated (7D: ${analytics7d.kpis.totalSubmissions30d}, 14D: ${analytics14d.kpis.totalSubmissions30d}, 30D: ${analytics30d.kpis.totalSubmissions30d}, 90D: ${analytics90d.kpis.totalSubmissions30d}).`);

  console.log('\n--- 7. Department-Specific Filtering ---');
  const targetDept = 'Credit Operations & Portfolio Management';
  const deptAnalytics = reportingAnalyticsService.getAnalytics({
    timeRangeDays: 30,
    department: targetDept,
  });
  assert(deptAnalytics.kpis.totalSubmissions30d > 0, 'Target department returns found.');
  assert(deptAnalytics.departmentPerformance.every((d) => d.department === targetDept), 'Filtered results contain only target department.');
  console.log(`  ✓ Department filter strictly isolates ${targetDept} (${deptAnalytics.kpis.totalSubmissions30d} returns).`);

  console.log('\n--- 8. Frequency Filtering (Daily, Monthly, Quarterly) ---');
  const monthlyAnalytics = reportingAnalyticsService.getAnalytics({
    timeRangeDays: 30,
    frequency: 'MONTHLY',
  });
  assert(monthlyAnalytics.kpis.totalSubmissions30d > 0, 'Monthly returns successfully filtered.');
  console.log(`  ✓ Frequency filter successfully resolved ${monthlyAnalytics.kpis.totalSubmissions30d} monthly returns.`);

  console.log('\n--- 9. Structured CSV Compliance Export ---');
  const csvOutput = reportingAnalyticsService.generateCsvExport(analytics30d);
  assert(typeof csvOutput === 'string' && csvOutput.length > 100, 'CSV export string is non-empty.');
  assert(csvOutput.includes('EXECUTIVE SUMMARY METRICS'), 'CSV contains Executive Summary section.');
  assert(csvOutput.includes('DEPARTMENT PERFORMANCE'), 'CSV contains Department Performance section.');
  assert(csvOutput.includes('30-DAY DAILY VOLUME'), 'CSV contains 30-Day Daily Volume section.');
  console.log(`  ✓ Structured CSV compliance export generated (${csvOutput.length} characters).`);

  console.log('\n--- 10. Real-Time Reactivity & Event Subscription ---');
  const tracker = { eventReceived: false };
  const unsubscribe = reportingAnalyticsService.subscribe(() => {
    tracker.eventReceived = true;
  });

  // Create a quick test draft to verify live reactivity
  const makerUser = userService.getByEmail('abebe.kebede@oromiabank.com') || {
    id: 'usr_maker_1',
    name: 'Abebe Kebede',
    email: 'abebe.kebede@oromiabank.com',
    role: 'MAKER',
    department: 'Credit Operations & Portfolio Management',
    institutionCode: '0000013',
  };

  const newDraft = submissionService.createSubmission(
    'LOA_ADV_OUT_LA001',
    makerUser as any
  );

  assert(Boolean(newDraft && newDraft.id), 'New submission draft created successfully.');
  assert(tracker.eventReceived === true, 'Analytics service subscriber received live update event on submission change.');
  console.log('  ✓ Real-time event propagation verified when submission ledger mutates.');

  // Clean up test draft
  submissionService.deleteSubmission(newDraft.id, makerUser as any);
  unsubscribe();
  console.log('  ✓ Real-time test draft cleaned up.');

  console.log('\n--- 11. Zero-Division & Edge Case Resilience ---');
  // Test query for a non-existent department to ensure no NaN or runtime exceptions
  const emptyDeptAnalytics = reportingAnalyticsService.getAnalytics({
    timeRangeDays: 30,
    department: 'NonExistentDepartment_XYZ',
  });
  assert.strictEqual(emptyDeptAnalytics.kpis.totalSubmissions30d, 0, 'Zero returns for non-existent department.');
  assert.strictEqual(emptyDeptAnalytics.kpis.avgTurnaroundHours, 0, 'Average turnaround is safely 0 for 0 submissions.');
  assert.strictEqual(emptyDeptAnalytics.kpis.slaComplianceRate, 100, 'SLA compliance safely defaults to 100% when no items overdue.');
  assert.strictEqual(emptyDeptAnalytics.kpis.firstPassRate, 100, 'First-pass rate safely defaults to 100% on empty set.');
  assert(!Number.isNaN(emptyDeptAnalytics.kpis.growthVsPriorPeriod), 'Growth is not NaN.');
  console.log('  ✓ Zero-division protection and boundary state validation passed cleanly.');

  console.log('\n--- 12. Turnaround 24h Statutory SLA Boundary Enforcement ---');
  assert(kpis.avgTurnaroundHours <= 24.0, `Average review time (${kpis.avgTurnaroundHours}h) meets statutory requirement (<= 24h).`);
  assert(kpis.medianTurnaroundHours <= 24.0, `Median review time (${kpis.medianTurnaroundHours}h) meets statutory requirement (<= 24h).`);
  assert(kpis.fastestApprovalHours >= 0, 'Fastest approval turnaround is non-negative.');
  console.log(`  ✓ 24-hour statutory dual-control SLA satisfied (Avg: ${kpis.avgTurnaroundHours}h, Median: ${kpis.medianTurnaroundHours}h).`);

  console.log('\n--- 13. Complete JSON Dataset Export Structure ---');
  const jsonExportStr = JSON.stringify(analytics30d, null, 2);
  const parsedExport = JSON.parse(jsonExportStr);
  assert(parsedExport.kpis && typeof parsedExport.kpis.totalSubmissions30d === 'number', 'Parsed JSON retains valid KPIs.');
  assert(Array.isArray(parsedExport.dailyTrends) && parsedExport.dailyTrends.length === 30, 'Parsed JSON retains 30 daily trend points.');
  assert(Array.isArray(parsedExport.departmentPerformance), 'Parsed JSON retains department performance array.');
  assert(Array.isArray(parsedExport.statusDistribution), 'Parsed JSON retains status distribution array.');
  console.log(`  ✓ JSON export schema verified (${jsonExportStr.length} bytes serialized).`);

  console.log('\n========================================================================');
  console.log('✅ ALL REPORTING PERFORMANCE ANALYTICS ACCEPTANCE GATES SATISFIED (100% PASS)');
  console.log('========================================================================');
}

// Execute standalone if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runReportingPerformanceAnalyticsTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
