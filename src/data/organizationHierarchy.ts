/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DepartmentDefinition {
  id: string;
  name: string;
  shortCode: string;
  division: string;
  description: string;
  primaryResponsibilities: string[];
  reportKeys: string[];
}

/**
 * Canonical Oromia Bank Organizational Hierarchy & Departmental SSOT
 * Maps all 24 NBE Regulatory Reports to their authoritative business departments.
 */
export const OROMIA_BANK_DEPARTMENTS: DepartmentDefinition[] = [
  {
    id: 'dept_credit_ops',
    name: 'Credit Operations & Portfolio Management',
    shortCode: 'COPM',
    division: 'Credit Business & Operations Division',
    description:
      'Responsible for credit disbursements, ongoing credit facility tracking, maturity profiling, size range and economic sector distributions.',
    primaryResponsibilities: [
      'Disbursement & collection tracking',
      'Facility maturity and term loan schedules',
      'Regional and size-range exposure tracking',
      'Economic sector credit distribution',
      'Building & construction loan monitoring',
    ],
    reportKeys: [
      'LOA_ADV_OUT_LA001',      // Loans & Advances Disbursement, Collection & Outstanding Outturn (Monthly)
      'LOA_PORT_EP001',         // Loan Portfolio by Facility Type & Maturity (Monthly)
      'LOAN_RAN___REGRL002',    // Loan Portfolio by Size Range & Region (Monthly - RL002)
      'LOAN_RAN_REG_RA002',     // Loan Portfolio by Size Range & Region (Quarterly - RA002)
      'LOAN_SEC___REGRS002',    // Loans by Economic Sector & Region (Monthly - RS002)
      'LOAN_SEC_REG_SE002',     // Loans by Economic Sector & Region (Quarterly - SE002)
      'BD_L_A_BD001',           // Breakdown of Loans & Advances by Economic Sector & Maturity (Monthly)
      'BUIL_CONSTXW002',        // Building & Construction Sector Lending Return (Quarterly)
    ],
  },
  {
    id: 'dept_asset_recovery',
    name: 'Specialized Asset Recovery & Workout',
    shortCode: 'SARW',
    division: 'Credit Business & Operations Division',
    description:
      'Responsible for distressed debt recovery, foreclosure processes, restructured loans, non-accrual reclassifications, and non-performing loan management.',
    primaryResponsibilities: [
      'Foreclosed property acquisition and auction monitoring (18 months rule)',
      'Restructured credit facilities and concession oversight',
      'Non-accrual to accrual status recategorizations',
      'Top 20 non-performing loans portfolio management',
      'Branch and sector-level NPL concentration analysis',
    ],
    reportKeys: [
      'COL_ACQ_18M_OL001',      // Collateral Acquired through Foreclosure within 18 Months (Quarterly)
      'COL_SOL_18M_LL001',      // Foreclosed Collateral Properties Sold within 18 Months (Quarterly)
      'ARLAL001',               // Restructured Loans and Advances (Quarterly Return)
      'RLAFCRC001',             // Restructured Loans After Concessions / Restructuring (Quarterly)
      'ANARN001',               // Loans Re-Categorized from Non-Accrual to Accrual Status (Quarterly)
      'TOP_20_NPLs_TN001',      // Top 20 Non-Performing Loans Return (Quarterly)
      'NPL_ECPOMNE001',         // NPL by Economic Sector and Top 6 Branches (Quarterly)
    ],
  },
  {
    id: 'dept_credit_risk',
    name: 'Credit Risk & Prudential Reporting',
    shortCode: 'CRPR',
    division: 'Enterprise Risk & Governance Division',
    description:
      'Responsible for NBE statutory loan classification, provision calculations (Pass, Special Mention, Substandard, Doubtful, Loss), single-borrower large exposures (>10% capital), insider credits, and related-party limits.',
    primaryResponsibilities: [
      'Monthly and quarterly loan classification and provisioning',
      'Single-borrower concentration limits (>10% capital)',
      'Top 20 borrower group exposure oversight',
      'Related-party and affiliate transactions audit',
      'Insider lending compliance (Board, Execs, Officers)',
    ],
    reportKeys: [
      'M_LCPLC001',             // Monthly Loans and Advances Classification and Provisioning (Monthly)
      'LOAN_CLA_PROV_LP001',    // Quarterly Loans and Advances Classification and Provisioning (Quarterly)
      'NPL_PRO_NL001',          // Non-Performing Loans and Provisions Schedule (Quarterly)
      'BOR_TEN_PER_LB002',      // Large Exposures Exceeding 10% Capital (Monthly)
      'TOP_20_BOR_TB001',       // Top 20 Borrowers Exposure Return (Quarterly)
      'BSD_LOAN_PART13002',     // Related Party Exposures & Transactions (Monthly)
      'INS_LOAN_QR002',         // Insider Loans and Credit Facilities Return (Quarterly)
    ],
  },
  {
    id: 'dept_trade_services',
    name: 'Trade Services & International Banking',
    shortCode: 'TSIB',
    division: 'International Banking & Treasury Division',
    description:
      'Responsible for off-balance sheet contingent liabilities, commercial letters of credit (LC), trade performance guarantees, bid bonds, and foreign counter-guarantees.',
    primaryResponsibilities: [
      'Off-balance sheet contingent provision calculations',
      'Letters of credit commitments and liability registers',
      'Performance and financial guarantees monitoring',
      'Foreign correspondent bank counter-guarantees',
    ],
    reportKeys: [
      'POBEPE001',              // Provision on Off-Balance Sheet Exposure (Quarterly)
    ],
  },
  {
    id: 'dept_digital_banking',
    name: 'Digital Banking & Fintech Operations',
    shortCode: 'DBFO',
    division: 'Digital Transformation & Retail Division',
    description:
      'Responsible for automated digital micro-lending, instant mobile credit lines, digital agent lending, and digital credit risk velocity analytics.',
    primaryResponsibilities: [
      'Quarterly digital micro-loan disbursement and portfolio analytics',
      'Digital credit default rates and scoring performance',
      'Fintech partner and payment channel lending reconciliation',
    ],
    reportKeys: [
      'DigitalLendingDL001',     // Quarterly Digital Lending Activity Return (Quarterly)
    ],
  },
  {
    id: 'dept_internal_audit',
    name: 'Internal Audit & Regulatory Control',
    shortCode: 'IARC',
    division: 'Independent Assurance & Supervisory Directorate',
    description:
      'Responsible for independent inspection, continuous supervisory 4-eyes audit, validation of regulatory reporting accuracy, and compliance verification across all returns.',
    primaryResponsibilities: [
      'Independent four-eyes verification of submitted returns',
      'Traceability and audit trail inspection',
      'Regulatory compliance certification under NBE directives',
    ],
    reportKeys: [],
  },
  {
    id: 'dept_finance_treasury',
    name: 'Finance, Treasury & ALM',
    shortCode: 'FTALM',
    division: 'Finance & Accounts Division',
    description:
      'Responsible for financial statement reconciliation, statutory reserve requirements, asset-liability management, liquidity ratios, and capital adequacy.',
    primaryResponsibilities: [
      'Statutory reserve calculation and verification',
      'General ledger reconciliation with regulatory returns',
      'Treasury exposure and liquidity gap reporting',
    ],
    reportKeys: [],
  },
  {
    id: 'dept_compliance_governance',
    name: 'Compliance & Legal Governance',
    shortCode: 'CLG',
    division: 'Legal & Regulatory Compliance Directorate',
    description:
      'Responsible for central regulatory liaison with the National Bank of Ethiopia (NBE), compliance policy oversight, sanctions screening, and governance.',
    primaryResponsibilities: [
      'NBE circulars interpretation and directive enforcement',
      'System-wide regulatory governance and user access oversight',
      'Central reporting calendar management',
    ],
    reportKeys: [],
  },
];

/**
 * Maps a reportKey to its canonical department name.
 */
export function getDepartmentForReport(reportKey: string): string {
  const normKey = reportKey.trim().toUpperCase();
  for (const dept of OROMIA_BANK_DEPARTMENTS) {
    if (dept.reportKeys.some((k) => k.toUpperCase() === normKey)) {
      return dept.name;
    }
  }
  // Fallback defaults based on naming conventions
  if (normKey.includes('COL_') || normKey.includes('ARLAL') || normKey.includes('RLAFCRC') || normKey.includes('ANARN') || normKey.includes('NPL_EC')) {
    return 'Specialized Asset Recovery & Workout';
  }
  if (normKey.includes('LCPLC') || normKey.includes('CLA_PROV') || normKey.includes('BOR_TEN') || normKey.includes('INS_LOAN') || normKey.includes('BSD_LOAN') || normKey.includes('TOP_20_BOR')) {
    return 'Credit Risk & Prudential Reporting';
  }
  if (normKey.includes('POBEPE')) {
    return 'Trade Services & International Banking';
  }
  if (normKey.includes('DIGITALLENDING')) {
    return 'Digital Banking & Fintech Operations';
  }
  return 'Credit Operations & Portfolio Management';
}

/**
 * Returns all report keys mapped to a specific department.
 */
export function getReportsForDepartment(departmentName: string): string[] {
  const dept = OROMIA_BANK_DEPARTMENTS.find(
    (d) => d.name.toLowerCase() === departmentName.trim().toLowerCase()
  );
  return dept ? [...dept.reportKeys] : [];
}

/**
 * Returns all active operational department names.
 */
export function getAllDepartmentNames(): string[] {
  return OROMIA_BANK_DEPARTMENTS.map((d) => d.name);
}

// Export DEPARTMENTS alias for backward and cross-component compatibility
export const DEPARTMENTS = OROMIA_BANK_DEPARTMENTS;
