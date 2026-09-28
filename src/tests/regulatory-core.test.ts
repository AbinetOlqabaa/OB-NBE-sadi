/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAllReports, getReportByKey } from '../data/report-registry.ts';
import { FormulaEngine } from '../utils/formulaEngine.ts';
import { ValidationEngine } from '../utils/validationEngine.ts';
import { ExcelService } from '../utils/excelService.ts';
import { OROMIA_BANK_DEPARTMENTS, getDepartmentForReport, getReportsForDepartment } from '../data/organizationHierarchy.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[Regulatory Core Assertion Failed]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export function runRegulatoryCoreTests() {
  console.log('\n======================================================');
  console.log('--- 1. REGULATORY REPORT REGISTRY & CATALOG TESTS ---');
  console.log('======================================================');

  const allReports = getAllReports();
  assert(allReports.length === 24, `All 24 canonical NBE returns are loaded (found: ${allReports.length})`);

  // Verify all 24 reports have ReturnKey, Code, Title, InstCode, and FinYear
  for (const r of allReports) {
    assert(Boolean(r.ReturnKey), `Report has valid ReturnKey: ${r.ReturnKey}`);
    assert(r.InstCode === '0000013', `Report ${r.ReturnKey} has Oromia Bank institution code 0000013`);
    assert(r.FinYear === 2026, `Report ${r.ReturnKey} finYear is 2026`);
    assert(r.ReturnItemsList && Array.isArray(r.ReturnItemsList), `Report ${r.ReturnKey} has ReturnItemsList`);
    assert(r.DynamicItemsList !== undefined, `Report ${r.ReturnKey} has DynamicItemsList defined`);
  }

  // Verify key reports exist
  const lcplc = getReportByKey('M_LCPLC001');
  assert(Boolean(lcplc), 'M_LCPLC001 (Monthly Loan Classification & Provisioning) exists');
  assert(lcplc?.Frequency === 'MONTHLY', 'M_LCPLC001 frequency is MONTHLY');

  const pobepe = getReportByKey('POBEPE001');
  assert(Boolean(pobepe), 'POBEPE001 (Off-Balance Sheet Provisioning) exists');
  assert(pobepe?.Frequency === 'QUARTERLY', 'POBEPE001 frequency is QUARTERLY');

  const dl = getReportByKey('DigitalLendingDL001');
  assert(Boolean(dl), 'DigitalLendingDL001 (Digital Lending Activity Return) exists');

  const borTen = getReportByKey('BOR_TEN_PER_LB002');
  assert(Boolean(borTen), 'BOR_TEN_PER_LB002 (Large Exposures > 10% Capital) exists');

  console.log('\n--- 2. FORMULA ENGINE AST & SAFE MATH PARSER TESTS ---');
  // FormulaEngine evaluates without eval()
  const valMap: Record<string, number> = {
    '153_00010': 1000000,
    '153_00011': 0.05,
    '153_00016': 50000,
    '153_00017': 45000,
  };

  // Test basic arithmetic: D = B + C
  const addResult = FormulaEngine.evaluate('153_00016 + 153_00017', valMap);
  assert(addResult.success && addResult.value === 95000, 'Evaluates addition formula (50,000 + 45,000 = 95,000)');

  // Test multiplication: G = E * F
  const multResult = FormulaEngine.evaluate('153_00010 * 153_00011', valMap);
  assert(multResult.success && multResult.value === 50000, 'Evaluates percentage multiplication (1,000,000 * 0.05 = 50,000)');

  // Test subtraction: E = A - D
  const subResult = FormulaEngine.evaluate('153_00016 - 153_00017', valMap);
  assert(subResult.success && subResult.value === 5000, 'Evaluates subtraction (50,000 - 45,000 = 5,000)');

  // Test complex formula with precedence
  const compResult = FormulaEngine.evaluate('(153_00016 - 153_00017) * 2 + 1000', valMap);
  assert(compResult.success && compResult.value === 11000, 'Evaluates compound expression with parentheses');

  // Test division by zero safety
  const divZero = FormulaEngine.evaluate('153_00010 / 0', valMap);
  assert(divZero.success && divZero.value === 0, 'Safe division by zero returns 0 without crashing');

  console.log('\n--- 3. VALIDATION ENGINE MULTI-TIER CONSTRAINT TESTS ---');
  // Test report validation with missing required fields
  const mockReport = getReportByKey('M_LCPLC001')!;
  const testReportWithRequired = {
    ...mockReport,
    ReturnItemsList: [
      {
        ...mockReport.ReturnItemsList[0],
        _required: true,
      },
      ...mockReport.ReturnItemsList.slice(1),
    ],
  };
  const incompleteValues: Record<string, string | number> = {};
  const valSummary1 = ValidationEngine.validateReport(testReportWithRequired, incompleteValues, {});
  assert(!valSummary1.isValid, 'Validation correctly flags missing required fields');
  assert(valSummary1.errorsCount > 0, `Detected ${valSummary1.errorsCount} required field errors on empty submission`);

  // Non-numeric value validation for numeric fields
  const badTypeValues: Record<string, string | number> = {
    [mockReport.ReturnItemsList[0].Code]: 'not_a_number',
  };
  const valSummaryBadType = ValidationEngine.validateReport(mockReport, badTypeValues, {});
  assert(!valSummaryBadType.isValid, 'Validation flags invalid non-numeric value on NUMERIC field');
  assert(valSummaryBadType.fieldErrors.some((e) => e.message.includes('valid numeric')), 'Proper numeric type error generated');

  // Fill required fields with valid values
  const filledValues: Record<string, string | number> = {};
  for (const item of mockReport.ReturnItemsList) {
    filledValues[item.Code] = 1000;
  }
  const valSummary2 = ValidationEngine.validateReport(mockReport, filledValues, {});
  assert(valSummary2.isValid, 'Validation passes cleanly when all fields are populated correctly');

  console.log('\n--- 4. EXCEL IMPORT & EXPORT TESTS ---');
  // Test export to XLSX buffer
  const sampleValues = { ...filledValues };
  const xlsxBuffer = ExcelService.exportToBinary(mockReport, sampleValues, {});
  assert(xlsxBuffer instanceof Uint8Array && xlsxBuffer.length > 1000, `ExcelService exports valid XLSX binary buffer (${xlsxBuffer.length} bytes)`);

  console.log('✓ All Regulatory Core tests completed successfully.');
}
