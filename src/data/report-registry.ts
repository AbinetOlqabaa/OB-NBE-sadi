/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReportMetadata } from '../types/regulatory.ts';
import { getDepartmentForReport } from './organizationHierarchy.ts';
import { departmentService } from '../services/departmentService.ts';

export const NBE_REPORTS: ReportMetadata[] = [
  {
    ReturnKey: "POBEPE001",
    Code: "POBEPE001",
    Title: "Provision on Off-Balance Sheet Exposure",
    Category: "Classification & Provisioning",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly return detailing provision calculations on off-balance sheet guarantees, letters of credit, and commitments.",
    ReturnItemsList: [
      { Code: "153_00001", Value: "", _description: "1. Guarantee (sum1.1-1.2)_Amount (A)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "153_00002", Value: "", _description: "1. Guarantee (sum1.1-1.2)_Provisioning Rate (B)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00003", Value: "", _description: "1. Guarantee (sum1.1-1.2)_NPL's Amount (C)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00004", Value: "", _description: "1. Guarantee (sum1.1-1.2)_Additional Provisioning Rate (2%)* (D)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00005", Value: "", _description: "1. Guarantee (sum1.1-1.2)_Amount Under litigation (E)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00006", Value: "", _description: "1. Guarantee (sum1.1-1.2)_Additional Provisioning rate (5%)**(F)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00007", Value: "", _description: "1. Guarantee (sum1.1-1.2)_Required Provisions (G)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00008", Value: "", _description: "1. Guarantee (sum1.1-1.2)_Accumulated provision held in the Previous Period (H)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00009", Value: "", _description: "1. Guarantee (sum1.1-1.2)_Excess/Shortfall in Provisions (I)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00010", Value: "", _description: "1.1 With no counter guarantee_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00011", Value: "", _description: "1.1 With no counter guarantee_Provisioning rate (B)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00012", Value: "", _description: "1.1 With no counter guarantee_NPL's amount (C)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00016", Value: "", _description: "1.1 With no counter guarantee_Required Provisions (G)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00017", Value: "", _description: "1.1 With no counter guarantee_Accumulated provision held in the Previous Period (H)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00018", Value: "", _description: "1.1 With no counter guarantee_Excess/Shortfall in Provisions (I)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00019", Value: "", _description: "1.2 With counter guarantee by foreign bank with A rating_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00020", Value: "", _description: "1.2 With counter guarantee by foreign bank with A rating_Provisioning rate (B)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00025", Value: "", _description: "1.2 With counter guarantee by foreign bank with A rating_Required Provisions (G)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00026", Value: "", _description: "1.2 With counter guarantee by foreign bank with A rating_Accumulated provision held (H)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00027", Value: "", _description: "1.2 With counter guarantee by foreign bank with A rating_Excess/Shortfall (I)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00028", Value: "", _description: "2 Commitment to provide Loan and Advance_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00029", Value: "", _description: "2 Commitment to provide Loan and Advance_Provisioning rate (B)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00034", Value: "", _description: "2 Commitment to provide Loan and Advance_Required provisions (G)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00035", Value: "", _description: "2 Commitment to provide Loan and Advance_Accumulated provision held (H)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00036", Value: "", _description: "2 Commitment to provide Loan and Advance_Excess/Shortfall (I)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00037", Value: "", _description: "3 Letter of Credit_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00038", Value: "", _description: "3 Letter of Credit_Provisioning rate (B)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00043", Value: "", _description: "3 Letter of Credit_Required Provisions (G)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00044", Value: "", _description: "3 Letter of Credit_Accumulated provision held (H)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00045", Value: "", _description: "3 Letter of Credit_Excess/Shortfall in Provisions (I)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00046", Value: "", _description: "4 Others_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00047", Value: "", _description: "4 Others_Provisioning rate (B)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00052", Value: "", _description: "4 Others_Required Provisions (G)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00053", Value: "", _description: "4 Others_Accumulated provision held (H)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00054", Value: "", _description: "4 Others_Excess/Shortfall in Provisions (I)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00055", Value: "", _description: "5 Total Off Balance Sheet Item (Sum 1-4)_Amount (A)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "153_00056", Value: "", _description: "5 Total Off Balance Sheet Item (Sum 1-4)_Provisioning rate (B)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00057", Value: "", _description: "5 Total Off Balance Sheet Item (Sum 1-4)_NPL's Amount (C)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00061", Value: "", _description: "5 Total Off Balance Sheet Item (Sum 1-4)_ Required Provisions (G)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00062", Value: "", _description: "5 Total Off Balance Sheet Item (Sum 1-4)_Accumulated provision held (H)", _dataType: "NUMERIC", _required: false },
      { Code: "153_00063", Value: "", _description: "5 Total Off Balance Sheet Item (Sum 1-4)_ Excess/Shortfall in Provisions (I)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "153_00064", Value: "", _description: "Total_Accumulated provision held", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [],
    Formulas: [
      { targetCode: "153_00001", expression: "153_00010 + 153_00019", description: "Guarantee Amount = 1.1 + 1.2", dependencies: ["153_00010", "153_00019"] },
      { targetCode: "153_00055", expression: "153_00001 + 153_00028 + 153_00037 + 153_00046", description: "Total Off Balance = Sum(1-4)", dependencies: ["153_00001", "153_00028", "153_00037", "153_00046"] },
      { targetCode: "153_00009", expression: "153_00008 - 153_00007", description: "Guarantee Excess/Shortfall = Held - Required", dependencies: ["153_00008", "153_00007"] },
      { targetCode: "153_00063", expression: "153_00062 - 153_00061", description: "Total Excess/Shortfall = Held - Required", dependencies: ["153_00062", "153_00061"] }
    ],
    ValidationRules: [
      {
        id: "pobepe-amounts-nonneg",
        name: "Non-Negative Balances",
        description: "All loan guarantee and provision figures must be zero or positive",
        severity: "ERROR",
        check: (v) => Object.values(v).every((val) => typeof val !== "number" || val >= 0)
      }
    ],
    SourceFilename: "POBEPE001.txt",
    SourceHash: "sha256-pobepe001-canonical"
  },
  {
    ReturnKey: "ARLAL001",
    Code: "ARLAL001",
    Title: "Quarterly Return on Restructured Loans and Advances",
    Category: "Restructuring",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly tracking of restructured and renegotiated facilities and total loan volume adjustments.",
    ReturnItemsList: [
      { Code: "150_00001", Value: "", _description: "Restructured Loans at end of previous quarter_Number", _dataType: "NUMERIC", _required: false },
      { Code: "150_00002", Value: "", _description: "Restructured Loans at end of previous quarter_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "150_00003", Value: "", _description: "Restructured Loans during current quarter_Number", _dataType: "NUMERIC", _required: false },
      { Code: "150_00004", Value: "", _description: "Restructured Loans during current quarter_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "150_00005", Value: "", _description: "Total Restructured Loans and Advances_Number", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "150_00006", Value: "", _description: "Total Restructured Loans and Advances_Amount", _dataType: "NUMERIC", _required: false, isTotal: true }
    ],
    DynamicItemsList: [],
    Formulas: [
      { targetCode: "150_00005", expression: "150_00001 + 150_00003", description: "Total Count = Previous + Current", dependencies: ["150_00001", "150_00003"] },
      { targetCode: "150_00006", expression: "150_00002 + 150_00004", description: "Total Volume = Previous + Current", dependencies: ["150_00002", "150_00004"] }
    ],
    ValidationRules: [
      {
        id: "arlal-reconciled",
        name: "Quarterly Additions Reconciled",
        description: "Total restructured facilities must match opening balance plus additions",
        severity: "ERROR",
        check: (v) => {
          const prev = Number(v["150_00002"]) || 0;
          const curr = Number(v["150_00004"]) || 0;
          const tot = Number(v["150_00006"]) || 0;
          return Math.abs(tot - (prev + curr)) < 0.01;
        }
      }
    ],
    SourceFilename: "ARLAL001.txt",
    SourceHash: "sha256-arlal001-canonical"
  },
  {
    ReturnKey: "ANARN001",
    Code: "ANARN001",
    Title: "Loans Re-Categorized from Non-Accrual to Accrual Status",
    Category: "Classification & Provisioning",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly report on non-accrual loans restored to performing accrual status.",
    ReturnItemsList: [
      { Code: "149_00001", Value: "", _description: "Re-Categorized at end of previous quarter_Number", _dataType: "NUMERIC", _required: false },
      { Code: "149_00002", Value: "", _description: "Re-Categorized at end of previous quarter_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "149_00003", Value: "", _description: "Re-Categorized during current quarter_Number", _dataType: "NUMERIC", _required: false },
      { Code: "149_00004", Value: "", _description: "Re-Categorized during current quarter_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "149_00005", Value: "", _description: "Total Re-Categorized Loans_Number", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "149_00006", Value: "", _description: "Total Re-Categorized Loans_Amount", _dataType: "NUMERIC", _required: false, isTotal: true }
    ],
    DynamicItemsList: [],
    Formulas: [
      { targetCode: "149_00005", expression: "149_00001 + 149_00003", description: "Total Count = Previous + Current", dependencies: ["149_00001", "149_00003"] },
      { targetCode: "149_00006", expression: "149_00002 + 149_00004", description: "Total Volume = Previous + Current", dependencies: ["149_00002", "149_00004"] }
    ],
    ValidationRules: [
      {
        id: "anarn-sum-check",
        name: "Accrual Restoration Verification",
        description: "Total amount re-categorized must equal sum of previous and current additions",
        severity: "ERROR",
        check: (v) => {
          const prev = Number(v["149_00002"]) || 0;
          const curr = Number(v["149_00004"]) || 0;
          const tot = Number(v["149_00006"]) || 0;
          return Math.abs(tot - (prev + curr)) < 0.01;
        }
      }
    ],
    SourceFilename: "ANARN001.txt",
    SourceHash: "sha256-anarn001-canonical"
  },
  {
    ReturnKey: "DigitalLendingDL001",
    Code: "DL001",
    Title: "Quarterly Digital Lending Operations",
    Category: "Credit & Lending",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly volume, disbursement, and collection metrics for automated digital lending channels.",
    ReturnItemsList: [
      { Code: "161_00001", Value: "", _description: "Total Digital Lending Disbursement", _dataType: "NUMERIC", _required: false },
      { Code: "161_00002", Value: "", _description: "Total Digital Lending Collection", _dataType: "NUMERIC", _required: false },
      { Code: "161_00003", Value: "", _description: "Total Digital Lending Outstanding Balance", _dataType: "NUMERIC", _required: false },
      { Code: "161_00004", Value: "", _description: "Total # of Digital Borrower Accounts", _dataType: "NUMERIC", _required: false },
      { Code: "161_00005", Value: "", _description: "Total # of Digital Borrowers (Unique)", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [],
    Formulas: [],
    ValidationRules: [
      {
        id: "dl-accounts-ge-borrowers",
        name: "Borrower Account Integrity",
        description: "Number of accounts must be greater than or equal to number of unique borrowers",
        severity: "WARNING",
        check: (v) => {
          const accounts = Number(v["161_00004"]) || 0;
          const borrowers = Number(v["161_00005"]) || 0;
          return accounts >= borrowers;
        }
      }
    ],
    SourceFilename: "DigitalLendingDL001.txt",
    SourceHash: "sha256-dl001-canonical"
  },
  {
    ReturnKey: "NPL&PRO_NL001",
    Code: "NL001",
    Title: "Non-Performing Loans and Provisions Schedule",
    Category: "Classification & Provisioning",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "NBE Schedule of Substandard (20%), Doubtful (50%), and Loss (100%) loans and specific provisions required.",
    ReturnItemsList: [
      { Code: "9_00001", Value: "", _description: "1-Total non-performing loans (sum 2-4)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "9_00002", Value: "", _description: "2-Total substandard loans", _dataType: "NUMERIC", _required: false },
      { Code: "9_00003", Value: "", _description: "2,1- Realizable security", _dataType: "NUMERIC", _required: false },
      { Code: "9_00004", Value: "", _description: "2,2-Net substandard loans (2-2.1)", _dataType: "NUMERIC", _required: false },
      { Code: "9_00005", Value: "", _description: "2,3-Specific provisions required (20% of 2.2)", _dataType: "NUMERIC", _required: false },
      { Code: "9_00006", Value: "", _description: "2,4-Specific provisions held", _dataType: "NUMERIC", _required: false },
      { Code: "9_00007", Value: "", _description: "2,5-Excess/shortfall (2.4-2.3)", _dataType: "NUMERIC", _required: false },
      { Code: "9_00008", Value: "", _description: "2,6-Number of classified loans", _dataType: "NUMERIC", _required: false },
      { Code: "9_00009", Value: "", _description: "3-Total doubtful loans", _dataType: "NUMERIC", _required: false },
      { Code: "9_00010", Value: "", _description: "3,1-Realizable security", _dataType: "NUMERIC", _required: false },
      { Code: "9_00011", Value: "", _description: "3,2-Net doubtful loans (3-3.1)", _dataType: "NUMERIC", _required: false },
      { Code: "9_00012", Value: "", _description: "3,3-Specific provisions required (50% of 3.2)", _dataType: "NUMERIC", _required: false },
      { Code: "9_00013", Value: "", _description: "3,4-Specific provisions held", _dataType: "NUMERIC", _required: false },
      { Code: "9_00014", Value: "", _description: "3,5-Excess/shortfall (3.4 – 3.3)", _dataType: "NUMERIC", _required: false },
      { Code: "9_00015", Value: "", _description: "3,6-Number of classified loans", _dataType: "NUMERIC", _required: false },
      { Code: "9_00016", Value: "", _description: "4-Total loss loans", _dataType: "NUMERIC", _required: false },
      { Code: "9_00017", Value: "", _description: "4,1-Realizable security", _dataType: "NUMERIC", _required: false },
      { Code: "9_00018", Value: "", _description: "4,2-Net loss loans (4-4.1)", _dataType: "NUMERIC", _required: false },
      { Code: "9_00019", Value: "", _description: "4,3-Specific provisions required (100% of 4.2)", _dataType: "NUMERIC", _required: false },
      { Code: "9_00020", Value: "", _description: "4,4-Specific provisions held", _dataType: "NUMERIC", _required: false },
      { Code: "9_00021", Value: "", _description: "4,5-Excess/shortfall (4.4-4.3)", _dataType: "NUMERIC", _required: false },
      { Code: "9_00022", Value: "", _description: "4,6-Number of classified loans", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [],
    Formulas: [
      { targetCode: "9_00004", expression: "9_00002 - 9_00003", description: "Net Substandard = Substandard - Security", dependencies: ["9_00002", "9_00003"] },
      { targetCode: "9_00005", expression: "(9_00002 - 9_00003) * 0.20", description: "Substandard Required Provision = 20% Net", dependencies: ["9_00002", "9_00003"] },
      { targetCode: "9_00007", expression: "9_00006 - 9_00005", description: "Substandard Excess/Shortfall = Held - Required", dependencies: ["9_00006", "9_00005"] },
      { targetCode: "9_00011", expression: "9_00009 - 9_00010", description: "Net Doubtful = Doubtful - Security", dependencies: ["9_00009", "9_00010"] },
      { targetCode: "9_00012", expression: "(9_00009 - 9_00010) * 0.50", description: "Doubtful Required Provision = 50% Net", dependencies: ["9_00009", "9_00010"] },
      { targetCode: "9_00014", expression: "9_00013 - 9_00012", description: "Doubtful Excess/Shortfall = Held - Required", dependencies: ["9_00013", "9_00012"] },
      { targetCode: "9_00018", expression: "9_00016 - 9_00017", description: "Net Loss = Loss - Security", dependencies: ["9_00016", "9_00017"] },
      { targetCode: "9_00019", expression: "(9_00016 - 9_00017) * 1.00", description: "Loss Required Provision = 100% Net", dependencies: ["9_00016", "9_00017"] },
      { targetCode: "9_00021", expression: "9_00020 - 9_00019", description: "Loss Excess/Shortfall = Held - Required", dependencies: ["9_00020", "9_00019"] },
      { targetCode: "9_00001", expression: "9_00002 + 9_00009 + 9_00016", description: "Total NPL = Substandard + Doubtful + Loss", dependencies: ["9_00002", "9_00009", "9_00016"] }
    ],
    ValidationRules: [
      {
        id: "nl001-specific-provisions",
        name: "Statutory Specific Provision Rates",
        description: "Provisioning must accurately calculate Substandard at 20%, Doubtful at 50%, and Loss at 100% of net exposure",
        severity: "ERROR",
        check: (v) => {
          const subNet = Math.max(0, (Number(v["9_00002"]) || 0) - (Number(v["9_00003"]) || 0));
          const subReq = Number(v["9_00005"]) || 0;
          return Math.abs(subReq - subNet * 0.20) < 0.05;
        }
      }
    ],
    SourceFilename: "NPL&PRO_NL001.txt",
    SourceHash: "sha256-nl001-canonical"
  },
  {
    ReturnKey: "M_LCPLC001",
    Code: "LC001",
    Title: "Monthly Loan Classification and Provisioning",
    Category: "Classification & Provisioning",
    Frequency: "MONTHLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-07-01T00:00:00",
    EndDate: "2026-07-31T00:00:00",
    Description: "Comprehensive monthly portfolio classification across Pass (1%), Special Mention (3%), Substandard (20%), Doubtful (50%), and Loss (100%).",
    ReturnItemsList: [
      { Code: "122_00001", Value: "", _description: "Pass (Sum 1.1-1.4)_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00002", Value: "", _description: "Pass (Sum 1.1-1.4)_Deductible collateral_Cash/cash substitute_(B)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00003", Value: "", _description: "Pass (Sum 1.1-1.4)_Deductible collateral_Net recoverable value_(C)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00004", Value: "", _description: "Pass (Sum 1.1-1.4)_Deductible collateral_Total _(D=B+C)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "122_00005", Value: "", _description: "Pass (Sum 1.1-1.4)_Deductible collateral_Net loans and advances_(E=A-D)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "122_00006", Value: "", _description: "Pass (Sum 1.1-1.4)_Provisioning rate_(F)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00007", Value: "", _description: "Pass (Sum 1.1-1.4)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00008", Value: "", _description: "Pass (Sum 1.1-1.4)_Accumulated provision held_(H)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00009", Value: "", _description: "Pass (Sum 1.1-1.4)_Excess/shortfall in provisions_(I=H-G)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00046", Value: "", _description: "Special mention (Sum 2.1-2.4)_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00049", Value: "", _description: "Special mention (Sum 2.1-2.4)_Deductible collateral_Total _(D=B+C)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00050", Value: "", _description: "Special mention (Sum 2.1-2.4)_Deductible collateral_Net loans and advances_(E=A-D)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00052", Value: "", _description: "Special mention (Sum 2.1-2.4)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00091", Value: "", _description: "Substandard (3.1+3.2)_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00094", Value: "", _description: "Substandard (3.1+3.2)_Deductible collateral_Total _(D=B+C)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00095", Value: "", _description: "Substandard (3.1+3.2)_Deductible collateral_Net loans and advances_(E=A-D)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00097", Value: "", _description: "Substandard (3.1+3.2)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00190", Value: "", _description: "Doubtful (Sum 4.1-4.4)_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00193", Value: "", _description: "Doubtful (Sum 4.1-4.4)_Deductible collateral_Total _(D=B+C)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00194", Value: "", _description: "Doubtful (Sum 4.1-4.4)_Deductible collateral_Net loans and advances_(E=A-D)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00196", Value: "", _description: "Doubtful (Sum 4.1-4.4)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00235", Value: "", _description: "Loss loans (Sum 5.1-5.4)_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00238", Value: "", _description: "Loss loans (Sum 5.1-5.4)_Deductible collateral_Total _(D=B+C)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00239", Value: "", _description: "Loss loans (Sum 5.1-5.4)_Deductible collateral_Net loans and advances_(E=A-D)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00241", Value: "", _description: "Loss loans (Sum 5.1-5.4)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00280", Value: "", _description: "Total (Sum 1-5)_Amount (A)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "122_00283", Value: "", _description: "Total (Sum 1-5)_Deductible collateral_Total _(D=B+C)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00284", Value: "", _description: "Total (Sum 1-5)_Deductible collateral_Net loans and advances_(E=A-D)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "122_00286", Value: "", _description: "Total (Sum 1-5)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "122_00288", Value: "", _description: "Total (Sum 1-5)_Excess/shortfall in provisions_(I=H-G)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "122_00289", Value: "", _description: "Total Non Performing (Sum 3-5)_Amount (A)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "122_00295", Value: "", _description: "Total Non Performing (Sum 3-5)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false },
      { Code: "122_00298", Value: "", _description: "NPLs to Total Loans Ratio(7/6)_Amount (A)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "122_00307", Value: "", _description: "Total_Accumulated provision held", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [],
    Formulas: [
      { targetCode: "122_00004", expression: "122_00002 + 122_00003", description: "Pass D = B + C", dependencies: ["122_00002", "122_00003"] },
      { targetCode: "122_00005", expression: "122_00001 - 122_00004", description: "Pass E = A - D", dependencies: ["122_00001", "122_00004"] },
      { targetCode: "122_00007", expression: "122_00005 * 0.01", description: "Pass Required Provision = 1% of Net", dependencies: ["122_00005"] },
      { targetCode: "122_00009", expression: "122_00008 - 122_00007", description: "Pass Excess/Shortfall = Held - Required", dependencies: ["122_00008", "122_00007"] },
      { targetCode: "122_00052", expression: "122_00050 * 0.03", description: "Special Mention Required Provision = 3% of Net", dependencies: ["122_00050"] },
      { targetCode: "122_00097", expression: "122_00095 * 0.20", description: "Substandard Required Provision = 20% of Net", dependencies: ["122_00095"] },
      { targetCode: "122_00196", expression: "122_00194 * 0.50", description: "Doubtful Required Provision = 50% of Net", dependencies: ["122_00194"] },
      { targetCode: "122_00241", expression: "122_00239 * 1.00", description: "Loss Required Provision = 100% of Net", dependencies: ["122_00241"] },
      { targetCode: "122_00280", expression: "122_00001 + 122_00046 + 122_00091 + 122_00190 + 122_00235", description: "Total Loans = Pass + SM + Substandard + Doubtful + Loss", dependencies: ["122_00001", "122_00046", "122_00091", "122_00190", "122_00235"] },
      { targetCode: "122_00289", expression: "122_00091 + 122_00190 + 122_00235", description: "Total NPL = Substandard + Doubtful + Loss", dependencies: ["122_00091", "122_00190", "122_00235"] },
      { targetCode: "122_00298", expression: "((122_00091 + 122_00190 + 122_00235) / (122_00280 || 1)) * 100", description: "NPL to Total Loans Ratio %", dependencies: ["122_00091", "122_00190", "122_00235", "122_00280"] }
    ],
    ValidationRules: [
      {
        id: "lc001-npl-limit",
        name: "NPL Target Threshold",
        description: "NPL Ratio should not breach 5% regulatory ceiling",
        severity: "WARNING",
        check: (v) => {
          const ratio = Number(v["122_00298"]) || 0;
          return ratio <= 5.0;
        }
      }
    ],
    SourceFilename: "M_LCPLC001.txt",
    SourceHash: "sha256-m-lcplc001-canonical"
  },
  {
    ReturnKey: "LOAN_CLA&PROV_LP001",
    Code: "LP001",
    Title: "Quarterly Loan Classification and Provisioning",
    Category: "Classification & Provisioning",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly statutory audit schedule of classified loans, provisioning requirements, and excess/shortfall calculations.",
    ReturnItemsList: [
      { Code: "21_00001", Value: "", _description: "Pass (Sum 1.1-1.4)_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00002", Value: "", _description: "Pass (Sum 1.1-1.4)_Deductible collateral_Cash/cash substitute_(B)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00003", Value: "", _description: "Pass (Sum 1.1-1.4)_Deductible collateral_Net recoverable value_(C)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00004", Value: "", _description: "Pass (Sum 1.1-1.4)_Deductible collateral_Total _(D=B+C)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "21_00005", Value: "", _description: "Pass (Sum 1.1-1.4)_Deductible collateral_Net loans and advances_(E=A-D)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "21_00006", Value: "", _description: "Pass (Sum 1.1-1.4)_Provisioning rate_(F)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00007", Value: "", _description: "Pass (Sum 1.1-1.4)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00008", Value: "", _description: "Pass (Sum 1.1-1.4)_Accumulated provision held_(H)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00009", Value: "", _description: "Pass (Sum 1.1-1.4)_Excess/shortfall in provisions_(I=H-G)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00046", Value: "", _description: "Special mention (Sum 2.1-2.4)_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00049", Value: "", _description: "Special mention (Sum 2.1-2.4)_Deductible collateral_Total _(D=B+C)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00050", Value: "", _description: "Special mention (Sum 2.1-2.4)_Deductible collateral_Net loans and advances_(E=A-D)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00052", Value: "", _description: "Special mention (Sum 2.1-2.4)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00091", Value: "", _description: "Substandard (3.1+3.2)_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00094", Value: "", _description: "Substandard (3.1+3.2)_Deductible collateral_Total _(D=B+C)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00095", Value: "", _description: "Substandard (3.1+3.2)_Deductible collateral_Net loans and advances_(E=A-D)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00097", Value: "", _description: "Substandard (3.1+3.2)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00190", Value: "", _description: "Doubtful (Sum 4.1-4.4)_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00193", Value: "", _description: "Doubtful (Sum 4.1-4.4)_Deductible collateral_Total _(D=B+C)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00194", Value: "", _description: "Doubtful (Sum 4.1-4.4)_Deductible collateral_Net loans and advances_(E=A-D)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00196", Value: "", _description: "Doubtful (Sum 4.1-4.4)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00235", Value: "", _description: "Loss loans (Sum 5.1-5.4)_Amount (A)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00238", Value: "", _description: "Loss loans (Sum 5.1-5.4)_Deductible collateral_Total _(D=B+C)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00239", Value: "", _description: "Loss loans (Sum 5.1-5.4)_Deductible collateral_Net loans and advances_(E=A-D)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00241", Value: "", _description: "Loss loans (Sum 5.1-5.4)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00280", Value: "", _description: "Total (Sum 1-5)_Amount (A)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "21_00283", Value: "", _description: "Total (Sum 1-5)_Deductible collateral_Total _(D=B+C)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00284", Value: "", _description: "Total (Sum 1-5)_Deductible collateral_Net loans and advances_(E=A-D)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "21_00286", Value: "", _description: "Total (Sum 1-5)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "21_00288", Value: "", _description: "Total (Sum 1-5)_Excess/shortfall in provisions_(I=H-G)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "21_00289", Value: "", _description: "Total Non Performing (Sum 3-5)_Amount (A)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "21_00295", Value: "", _description: "Total Non Performing (Sum 3-5)_Required provision_(G=ExF)", _dataType: "NUMERIC", _required: false },
      { Code: "21_00298", Value: "", _description: "NPLs to Total Loans Ratio(7/6)_Amount (A)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "21_00307", Value: "", _description: "Total_Accumulated provision held ", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [],
    Formulas: [
      { targetCode: "21_00004", expression: "21_00002 + 21_00003", description: "Pass D = B + C", dependencies: ["21_00002", "21_00003"] },
      { targetCode: "21_00005", expression: "21_00001 - 21_00004", description: "Pass E = A - D", dependencies: ["21_00001", "21_00004"] },
      { targetCode: "21_00007", expression: "21_00005 * 0.01", description: "Pass Required Provision = 1%", dependencies: ["21_00005"] },
      { targetCode: "21_00009", expression: "21_00008 - 21_00007", description: "Pass Excess/Shortfall = Held - Required", dependencies: ["21_00008", "21_00007"] },
      { targetCode: "21_00052", expression: "21_00050 * 0.03", description: "Special Mention Required Provision = 3%", dependencies: ["21_00050"] },
      { targetCode: "21_00097", expression: "21_00095 * 0.20", description: "Substandard Required Provision = 20%", dependencies: ["21_00095"] },
      { targetCode: "21_00196", expression: "21_00194 * 0.50", description: "Doubtful Required Provision = 50%", dependencies: ["21_00194"] },
      { targetCode: "21_00241", expression: "21_00239 * 1.00", description: "Loss Required Provision = 100%", dependencies: ["21_00241"] },
      { targetCode: "21_00280", expression: "21_00001 + 21_00046 + 21_00091 + 21_00190 + 21_00235", description: "Total Loans = Sum(Pass to Loss)", dependencies: ["21_00001", "21_00046", "21_00091", "21_00190", "21_00235"] },
      { targetCode: "21_00289", expression: "21_00091 + 21_00190 + 21_00235", description: "Total NPL = Substandard + Doubtful + Loss", dependencies: ["21_00091", "21_00190", "21_00235"] },
      { targetCode: "21_00298", expression: "((21_00091 + 21_00190 + 21_00235) / (21_00280 || 1)) * 100", description: "Quarterly NPL Ratio %", dependencies: ["21_00091", "21_00190", "21_00235", "21_00280"] }
    ],
    ValidationRules: [
      {
        id: "lp001-audit-check",
        name: "Provisions Compliance",
        description: "Provision amounts must match exact regulatory scale",
        severity: "ERROR",
        check: (v) => {
          const lossNet = Math.max(0, (Number(v["21_00235"]) || 0) - (Number(v["21_00238"]) || 0));
          const lossReq = Number(v["21_00241"]) || 0;
          return Math.abs(lossReq - lossNet) < 0.05;
        }
      }
    ],
    SourceFilename: "LOAN_CLA&PROV_LP001.txt",
    SourceHash: "sha256-lp001-canonical"
  },
  {
    ReturnKey: "TOP_20_BOR_TB001",
    Code: "TB001",
    Title: "Top 20 Borrowers Exposure Return",
    Category: "Exposures & Concentration",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly return tracking individual and aggregate exposure for the 20 largest bank borrowers.",
    ReturnItemsList: [
      ...Array.from({ length: 20 }, (_, i) => ({
        Code: `14_000${(i + 1).toString().padStart(2, '0')}`,
        Value: "",
        _description: `Name of Borrower_${i + 1}`,
        _dataType: "TEXT" as const,
        _required: false
      })),
      { Code: "14_00020", Value: "", _description: "Sub total top ten(10) borrowers_Approved loan", _dataType: "NUMERIC", _required: false },
      { Code: "14_00021", Value: "", _description: "Sub total top ten(10) borrowers_Outstanding balance", _dataType: "NUMERIC", _required: false },
      { Code: "14_00022", Value: "", _description: "Sub total top ten(10) borrowers_Off balance sheet", _dataType: "NUMERIC", _required: false },
      { Code: "14_00023", Value: "", _description: "Sub total top ten(10) borrowers_Total outstanding exposure", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "14_00024", Value: "", _description: "Grand total top twenty (20) borrowers_Approved loan", _dataType: "NUMERIC", _required: false },
      { Code: "14_00025", Value: "", _description: "Grand total top twenty (20) borrowers_Outstanding balance", _dataType: "NUMERIC", _required: false },
      { Code: "14_00026", Value: "", _description: "Grand total top twenty (20) borrowers_Off balance sheet", _dataType: "NUMERIC", _required: false },
      { Code: "14_00027", Value: "", _description: "Grand total top twenty (20) borrowers_Total outstanding exposure", _dataType: "NUMERIC", _required: false, isTotal: true }
    ],
    DynamicItemsList: [
      {
        Area: 188,
        _areaName: "Top 20 Borrowers Roster",
        DynamicItems: [
          { Code: "1.1", Value: "", _description: "S.No.", _dataType: "TEXT", _required: true },
          { Code: "1.2", Value: "", _description: "Name of Borrower", _dataType: "TEXT", _required: true },
          { Code: "1.3", Value: "", _description: "Collateral Value", _dataType: "NUMERIC", _required: false },
          { Code: "1.4", Value: "", _description: "Bank's Capital (Net of Retained Earnings)", _dataType: "NUMERIC", _required: false },
          { Code: "1.5", Value: "", _description: "Approved Loan Limit", _dataType: "NUMERIC", _required: false },
          { Code: "1.6", Value: "", _description: "On-Balance Outstanding", _dataType: "NUMERIC", _required: false },
          { Code: "1.7", Value: "", _description: "Off-Balance Sheet Exposure", _dataType: "NUMERIC", _required: false },
          { Code: "1.8", Value: "", _description: "Total Outstanding Exposure (1.6 + 1.7)", _dataType: "NUMERIC", _required: false },
          { Code: "1.9", Value: "", _description: "% of Capital (1.8 / 1.4 * 100)", _dataType: "NUMERIC", _required: false },
          { Code: "1.10", Value: "", _description: "Status", _dataType: "TEXT", _required: false }
        ]
      }
    ],
    Formulas: [
      { targetCode: "14_00023", expression: "14_00021 + 14_00022", description: "Top 10 Total = Outstanding + Off-balance", dependencies: ["14_00021", "14_00022"] },
      { targetCode: "14_00027", expression: "14_00025 + 14_00026", description: "Top 20 Total = Outstanding + Off-balance", dependencies: ["14_00025", "14_00026"] }
    ],
    ValidationRules: [
      {
        id: "tb-single-borrower-25pct",
        name: "Single Borrower Limit Compliance",
        description: "Exposure for any single customer should not exceed 25% of bank total capital",
        severity: "WARNING",
        check: (v, dyn) => {
          const rows = dyn?.[188] || [];
          return rows.every((r) => {
            const pct = Number(r["1.9"]) || 0;
            return pct <= 25.0;
          });
        }
      }
    ],
    SourceFilename: "TOP_20_BOR_TB001.txt",
    SourceHash: "sha256-tb001-canonical"
  },
  {
    ReturnKey: "TOP_20_NPLs_TN001",
    Code: "TN001",
    Title: "Top 20 Non-Performing Loans Return",
    Category: "Exposures & Concentration",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly schedule of the 20 largest non-performing loan exposures and related provisioning.",
    ReturnItemsList: [
      { Code: "10_00001", Value: "", _description: "Sub total top ten (10) NPLs_Loans Outstanding", _dataType: "NUMERIC", _required: false },
      { Code: "10_00002", Value: "", _description: "Sub total top ten (10) NPLs_Provision Held", _dataType: "NUMERIC", _required: false },
      { Code: "10_00003", Value: "", _description: "Grand total top twenty (20) NPLs_Loans Approved", _dataType: "NUMERIC", _required: false },
      { Code: "10_00004", Value: "", _description: "Sub total top ten (10) NPLs_Collateral value", _dataType: "NUMERIC", _required: false },
      { Code: "10_00005", Value: "", _description: "Sub total top ten (10) NPLs_Loans Approved", _dataType: "NUMERIC", _required: false },
      { Code: "10_00006", Value: "", _description: "Grand total top twenty (20) NPLs_Loans Outstanding", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "10_00007", Value: "", _description: "Grand total top twenty (20) NPLs_Collateral value", _dataType: "NUMERIC", _required: false },
      { Code: "10_00008", Value: "", _description: "Grand total top twenty (20) NPLs_Provision held", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [
      {
        Area: 171,
        _areaName: "Top 20 NPLs Schedule",
        DynamicItems: [
          { Code: "1.1", Value: "", _description: "S.No.", _dataType: "TEXT", _required: true },
          { Code: "1.2", Value: "", _description: "Name of Borrower", _dataType: "TEXT", _required: true },
          { Code: "1.3", Value: "", _description: "Loans Approved", _dataType: "NUMERIC", _required: false },
          { Code: "1.4", Value: "", _description: "Loans Outstanding", _dataType: "NUMERIC", _required: true },
          { Code: "1.5", Value: "", _description: "Collateral Value", _dataType: "NUMERIC", _required: false },
          { Code: "1.6", Value: "", _description: "Provision held", _dataType: "NUMERIC", _required: false },
          { Code: "1.7", Value: "", _description: "Loan Status", _dataType: "TEXT", _required: true }
        ]
      }
    ],
    Formulas: [],
    ValidationRules: [
      {
        id: "tn-outstanding-positive",
        name: "NPL Outstanding Balance Positive",
        description: "Loans outstanding must be positive",
        severity: "ERROR",
        check: (v) => (Number(v["10_00006"]) || 0) >= 0
      }
    ],
    SourceFilename: "TOP_20_NPLs_TN001.txt",
    SourceHash: "sha256-tn001-canonical"
  },
  {
    ReturnKey: "BOR_TEN_PER_LB002",
    Code: "LB002",
    Title: "Large Exposures Exceeding 10% Capital (Monthly)",
    Category: "Exposures & Concentration",
    Frequency: "MONTHLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-07-01T00:00:00",
    EndDate: "2026-07-31T00:00:00",
    Description: "Monthly regulatory return on all single or group counterparty exposures exceeding 10% of total capital.",
    ReturnItemsList: [
      ...Array.from({ length: 20 }, (_, i) => ({
        Code: `LB002_${(i + 1).toString().padStart(5, '0')}`,
        Value: "",
        _description: `Name of Counterparty_${20 - i}`,
        _dataType: "NUMERIC" as const,
        _required: true
      })),
      { Code: "LB002_00061", Value: "", _description: "Aggregate _Total Outstanding Balance", _dataType: "NUMERIC", _required: true, isTotal: true }
    ],
    DynamicItemsList: [
      {
        Area: 226,
        _areaName: "Monthly Return on Large Exposures List of Counterparties exceeding 10% Capital",
        DynamicItems: [
          { Code: "1.1", Value: "", _description: "Name of Counterparty*", _dataType: "TEXT", _required: true },
          { Code: "1.2", Value: "", _description: "Type of Exposure", _dataType: "TEXT", _required: true },
          { Code: "1.3", Value: "", _description: "Sector of Exposure", _dataType: "TEXT", _required: true },
          { Code: "1.4", Value: "", _description: "Approved Limit/Facility", _dataType: "NUMERIC", _required: true },
          { Code: "1.5", Value: "", _description: "Exposure Amount (on-balance) A", _dataType: "NUMERIC", _required: false },
          { Code: "1.6", Value: "", _description: "Off-balance Sheet Exposure B", _dataType: "NUMERIC", _required: false },
          { Code: "1.7", Value: "", _description: "Total Outstanding Balance C=A+B", _dataType: "NUMERIC", _required: true },
          { Code: "1.8", Value: "", _description: "Maturity Date", _dataType: "DATE", _required: true },
          { Code: "1.9", Value: "", _description: "Capital", _dataType: "NUMERIC", _required: true },
          { Code: "1.10", Value: "", _description: "Exposure as Percent of Total Capital", _dataType: "NUMERIC", _required: true },
          { Code: "1.11", Value: "", _description: "Status (classification)", _dataType: "TEXT", _required: true },
          { Code: "1.12", Value: "", _description: "Collateral Type", _dataType: "TEXT", _required: true },
          { Code: "1.13", Value: "", _description: "Collateral Estimated Value", _dataType: "NUMERIC", _required: false }
        ]
      }
    ],
    Formulas: [],
    ValidationRules: [
      {
        id: "lb002-cap-check",
        name: "10% Capital Floor Validation",
        description: "Reported counterparties must meet the 10% threshold",
        severity: "WARNING",
        check: (v, dyn) => {
          const rows = dyn?.[226] || [];
          return rows.length === 0 || rows.every((r) => (Number(r["1.10"]) || 0) >= 10);
        }
      }
    ],
    SourceFilename: "BOR_TEN_PER_LB002.txt",
    SourceHash: "sha256-lb002-canonical"
  },
  {
    ReturnKey: "BSD_LOAN_PART13002",
    Code: "BSD13002",
    Title: "Related Party Transactions & Exposures Return (Monthly)",
    Category: "Exposures & Concentration",
    Frequency: "MONTHLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-07-01T00:00:00",
    EndDate: "2026-07-31T00:00:00",
    Description: "Monthly regulatory disclosure of all transactions, loans, and off-balance sheet exposures with bank related parties.",
    ReturnItemsList: [
      ...Array.from({ length: 20 }, (_, i) => ({
        Code: `13002_${(i + 1).toString().padStart(5, '0')}`,
        Value: "",
        _description: `Name of Counterparty_${20 - i}`,
        _dataType: "NUMERIC" as const,
        _required: true
      })),
      { Code: "13002_00141", Value: "", _description: "Aggregate _Capital", _dataType: "NUMERIC", _required: true },
      { Code: "13002_00142", Value: "", _description: "Aggregate _Total Outstanding Balance", _dataType: "NUMERIC", _required: true, isTotal: true }
    ],
    DynamicItemsList: [
      {
        Area: 225,
        _areaName: "Monthly Returns on Related Party Transactions List of Related Party Exposures",
        DynamicItems: [
          { Code: "1.1", Value: "", _description: "Name of Counterparty*", _dataType: "TEXT", _required: true },
          { Code: "1.2", Value: "", _description: "Nature of Counterparty (shareholder, director, subsidiary)", _dataType: "TEXT", _required: true },
          { Code: "1.3", Value: "", _description: "Type of Exposure", _dataType: "TEXT", _required: true },
          { Code: "1.4", Value: "", _description: "Sector of Exposure", _dataType: "TEXT", _required: true },
          { Code: "1.5", Value: "", _description: "Approved Limit/Facility", _dataType: "NUMERIC", _required: true },
          { Code: "1.6", Value: "", _description: "Exposure Amount A", _dataType: "NUMERIC", _required: false },
          { Code: "1.7", Value: "", _description: "Off-balance Sheet Exposure B", _dataType: "NUMERIC", _required: false },
          { Code: "1.8", Value: "", _description: "Total Outstanding Balance C=A+B", _dataType: "NUMERIC", _required: true },
          { Code: "1.9", Value: "", _description: "Maturity Date", _dataType: "DATE", _required: true },
          { Code: "1.10", Value: "", _description: "Capital", _dataType: "NUMERIC", _required: true },
          { Code: "1.11", Value: "", _description: "Exposure as % of Capital", _dataType: "NUMERIC", _required: true },
          { Code: "1.12", Value: "", _description: "Status (classification)", _dataType: "TEXT", _required: true },
          { Code: "1.13", Value: "", _description: "Collateral Type", _dataType: "TEXT", _required: true },
          { Code: "1.14", Value: "", _description: "Collateral Estimated Value", _dataType: "NUMERIC", _required: false }
        ]
      }
    ],
    Formulas: [],
    ValidationRules: [
      {
        id: "bsd13002-cap-limit",
        name: "Related Party Aggregate Limit",
        description: "Aggregate related party exposures must remain within regulatory thresholds",
        severity: "ERROR",
        check: (v) => {
          const tot = Number(v["13002_00142"]) || 0;
          const cap = Number(v["13002_00141"]) || 1;
          return (tot / cap) <= 0.35;
        }
      }
    ],
    SourceFilename: "BSD_LOAN_PART13002.txt",
    SourceHash: "sha256-bsd13002-canonical"
  },
  {
    ReturnKey: "INS_LOAN_QR002",
    Code: "QR002",
    Title: "Quarterly Insider Loans Return",
    Category: "Exposures & Concentration",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly breakdown of credit facilities extended to directors, executive officers, and bank staff.",
    ReturnItemsList: [
      { Code: "158_00001", Value: "", _description: "Sub total (loans to Directors)_Outstanding Balance", _dataType: "NUMERIC", _required: false },
      { Code: "158_00002", Value: "", _description: "Sub total (loans to Directors)_Security Value", _dataType: "NUMERIC", _required: false },
      { Code: "158_00003", Value: "", _description: "Sub total (mid- level management and above)_Outstanding Balance", _dataType: "NUMERIC", _required: false },
      { Code: "158_00004", Value: "", _description: "Sub total (mid- level management and above)_Security Value", _dataType: "NUMERIC", _required: false },
      { Code: "158_00005", Value: "", _description: "Loans to other staffs_Outstanding Balance", _dataType: "NUMERIC", _required: false },
      { Code: "158_00006", Value: "", _description: "Loans to other staffs_Security Value", _dataType: "NUMERIC", _required: false },
      { Code: "158_00007", Value: "", _description: "No. of staff_Security Value", _dataType: "NUMERIC", _required: false },
      { Code: "158_00010", Value: "", _description: "Grand Total_Outstanding Balance", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "158_00011", Value: "", _description: "Grand Total_Security Value", _dataType: "NUMERIC", _required: false, isTotal: true }
    ],
    DynamicItemsList: [
      {
        Area: 198,
        _areaName: "Loans to Directors",
        DynamicItems: [
          { Code: "1.1", Value: "", _description: "Director's Name", _dataType: "TEXT", _required: true },
          { Code: "1.2", Value: "", _description: "Facility Type", _dataType: "TEXT", _required: false },
          { Code: "1.3", Value: "", _description: "Outstanding Balance", _dataType: "NUMERIC", _required: false },
          { Code: "1.4", Value: "", _description: "Security Value", _dataType: "NUMERIC", _required: false },
          { Code: "1.5", Value: "", _description: "Security Type", _dataType: "TEXT", _required: false },
          { Code: "1.6", Value: "", _description: "Loan Status", _dataType: "TEXT", _required: false }
        ]
      },
      {
        Area: 199,
        _areaName: "Loans to Executive Management",
        DynamicItems: [
          { Code: "1.1", Value: "", _description: "Executive Name", _dataType: "TEXT", _required: true },
          { Code: "1.2", Value: "", _description: "Facility Type", _dataType: "TEXT", _required: false },
          { Code: "1.3", Value: "", _description: "Outstanding Balance", _dataType: "NUMERIC", _required: false },
          { Code: "1.4", Value: "", _description: "Security Value", _dataType: "NUMERIC", _required: false },
          { Code: "1.5", Value: "", _description: "Security Type", _dataType: "TEXT", _required: false },
          { Code: "1.6", Value: "", _description: "Loan Status", _dataType: "TEXT", _required: false }
        ]
      }
    ],
    Formulas: [
      { targetCode: "158_00010", expression: "158_00001 + 158_00003 + 158_00005", description: "Grand Total Outstanding = Directors + Management + Staff", dependencies: ["158_00001", "158_00003", "158_00005"] },
      { targetCode: "158_00011", expression: "158_00002 + 158_00004 + 158_00006", description: "Grand Total Security = Directors + Management + Staff", dependencies: ["158_00002", "158_00004", "158_00006"] }
    ],
    ValidationRules: [
      {
        id: "qr002-total-reconciled",
        name: "Grand Total Reconciled",
        description: "Grand total must match sum of director, manager, and staff balances",
        severity: "ERROR",
        check: (v) => {
          const d = Number(v["158_00001"]) || 0;
          const m = Number(v["158_00003"]) || 0;
          const s = Number(v["158_00005"]) || 0;
          const tot = Number(v["158_00010"]) || 0;
          return Math.abs(tot - (d + m + s)) < 0.05;
        }
      }
    ],
    SourceFilename: "INS_LOAN_QR002.txt",
    SourceHash: "sha256-qr002-canonical"
  },
  {
    ReturnKey: "BUIL_CONSTXW002",
    Code: "XW002",
    Title: "Building & Construction Sector Loans (Quarterly)",
    Category: "Sector Breakdown",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly portfolio risk exposure to residential, commercial, and real estate construction sectors.",
    ReturnItemsList: [
      { Code: "157_00001", Value: "", _description: "Real_Estate_Sub Total_Outstanding Balance", _dataType: "NUMERIC", _required: false },
      { Code: "157_00002", Value: "", _description: "Real_Estate_Sub Total_Collateral Value", _dataType: "NUMERIC", _required: false },
      { Code: "157_00003", Value: "", _description: "Real_Estate_Sub Total_Provision Held", _dataType: "NUMERIC", _required: false },
      { Code: "157_00004", Value: "", _description: "Commercial Building_Sub Total_Outstanding Balance", _dataType: "NUMERIC", _required: false },
      { Code: "157_00005", Value: "", _description: "Commercial Building_Sub Total_Collateral Value", _dataType: "NUMERIC", _required: false },
      { Code: "157_00006", Value: "", _description: "Commercial Building_Sub Total_Provision Held", _dataType: "NUMERIC", _required: false },
      { Code: "157_00007", Value: "", _description: "Residential building(total)_Outstanding Balance", _dataType: "NUMERIC", _required: false },
      { Code: "157_00008", Value: "", _description: "Residential building(total)_Collateral Value", _dataType: "NUMERIC", _required: false },
      { Code: "157_00009", Value: "", _description: "Residential building(total)_Provision Held", _dataType: "NUMERIC", _required: false },
      { Code: "157_00010", Value: "", _description: "Sub Grand total(1+2+3)_Outstanding Balance", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "157_00011", Value: "", _description: "Sub Grand total(1+2+3)_Collateral Value", _dataType: "NUMERIC", _required: false },
      { Code: "157_00012", Value: "", _description: "Sub Grand total(1+2+3)_Provision held", _dataType: "NUMERIC", _required: false },
      { Code: "157_00013", Value: "", _description: "Other construction sector(total)_Outstanding Balance", _dataType: "NUMERIC", _required: false },
      { Code: "157_00014", Value: "", _description: "Other construction sector(total)_Collateral Value", _dataType: "NUMERIC", _required: false },
      { Code: "157_00015", Value: "", _description: "Other construction sector(total)_Provision Held", _dataType: "NUMERIC", _required: false },
      { Code: "157_00016", Value: "", _description: "Total construction loans(4+5)_Outstanding Balance", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "157_00017", Value: "", _description: "Total construction loans(4+5)_Collateral Value", _dataType: "NUMERIC", _required: false },
      { Code: "157_00018", Value: "", _description: "Total construction loans(4+5)_Provision Held", _dataType: "NUMERIC", _required: false },
      { Code: "157_00019", Value: "", _description: "Total loans & advance and Bonds_Outstanding Balance", _dataType: "NUMERIC", _required: false },
      { Code: "157_00020", Value: "", _description: "Total loans & advance and Bonds_Collateral Value", _dataType: "NUMERIC", _required: false },
      { Code: "157_00021", Value: "", _description: "Total loans & advance and Bonds_Provision Held", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [
      {
        Area: 196,
        _areaName: "Commercial Construction Projects",
        DynamicItems: [
          { Code: "1.1", Value: "", _description: "Name of borrower", _dataType: "TEXT", _required: true },
          { Code: "1.2", Value: "", _description: "Loan Type", _dataType: "TEXT", _required: false },
          { Code: "1.3", Value: "", _description: "Outstanding balance", _dataType: "NUMERIC", _required: false },
          { Code: "1.4", Value: "", _description: "Loan status", _dataType: "TEXT", _required: false },
          { Code: "1.5", Value: "", _description: "Collateral Type", _dataType: "TEXT", _required: false },
          { Code: "1.6", Value: "", _description: "Collateral Value", _dataType: "NUMERIC", _required: false },
          { Code: "1.7", Value: "", _description: "Provision held", _dataType: "NUMERIC", _required: false }
        ]
      }
    ],
    Formulas: [
      { targetCode: "157_00010", expression: "157_00001 + 157_00004 + 157_00007", description: "Sub Grand Total = Real Estate + Commercial + Residential", dependencies: ["157_00001", "157_00004", "157_00007"] },
      { targetCode: "157_00016", expression: "157_00010 + 157_00013", description: "Total Construction Loans = Sub Grand Total + Other Construction", dependencies: ["157_00010", "157_00013"] }
    ],
    ValidationRules: [
      {
        id: "xw002-totals-match",
        name: "Construction Loan Reconciliation",
        description: "Total construction loans must equal sub-totals",
        severity: "ERROR",
        check: (v) => {
          const sub = Number(v["157_00010"]) || 0;
          const other = Number(v["157_00013"]) || 0;
          const tot = Number(v["157_00016"]) || 0;
          return Math.abs(tot - (sub + other)) < 0.05;
        }
      }
    ],
    SourceFilename: "BUIL_CONSTXW002.txt",
    SourceHash: "sha256-xw002-canonical"
  },
  {
    ReturnKey: "BD_L&A_BD001",
    Code: "BD001",
    Title: "Loans & Advances Breakdown by Sector & Maturity (Monthly)",
    Category: "Sector Breakdown",
    Frequency: "MONTHLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-07-01T00:00:00",
    EndDate: "2026-07-31T00:00:00",
    Description: "Monthly breakdown of short, medium, and long-term credit across all Ethiopian economic sectors.",
    ReturnItemsList: [
      { Code: "2_00001", Value: "", _description: "1-TOTAL LOANS & ADVANCES (sum 2-4)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "2_00002", Value: "", _description: "2-SHORT TERM (sum 2.1-2.13)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "2_00003", Value: "", _description: "2,1- Agriculture", _dataType: "NUMERIC", _required: false },
      { Code: "2_00004", Value: "", _description: "2,2- Manufacturing", _dataType: "NUMERIC", _required: false },
      { Code: "2_00005", Value: "", _description: "2,3- Domestic trade", _dataType: "NUMERIC", _required: false },
      { Code: "2_00006", Value: "", _description: "2,4- International trade (sum 2.4.1-2.4.2)", _dataType: "NUMERIC", _required: false },
      { Code: "2_00011", Value: "", _description: "2,7- Building & construction (sum 2.7.1-2.7.4)", _dataType: "NUMERIC", _required: false },
      { Code: "2_00022", Value: "", _description: "3-MEDIUM TERM (sum 3.1-3.13)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "2_00023", Value: "", _description: "3,1- Agriculture", _dataType: "NUMERIC", _required: false },
      { Code: "2_00024", Value: "", _description: "3,2- Manufacturing", _dataType: "NUMERIC", _required: false },
      { Code: "2_00042", Value: "", _description: "4-LONG TERM (sum 4.1-4.13)", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "2_00043", Value: "", _description: "4,1-Agriculture", _dataType: "NUMERIC", _required: false },
      { Code: "2_00044", Value: "", _description: "4,2-Manufacturing", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [],
    Formulas: [
      { targetCode: "2_00001", expression: "2_00002 + 2_00022 + 2_00042", description: "Total Loans & Advances = Short + Medium + Long Term", dependencies: ["2_00002", "2_00022", "2_00042"] }
    ],
    ValidationRules: [
      {
        id: "bd-maturity-reconciliation",
        name: "Maturity Totals Reconciliation",
        description: "Total loans must equal sum of short, medium, and long term balances",
        severity: "ERROR",
        check: (v) => {
          const s = Number(v["2_00002"]) || 0;
          const m = Number(v["2_00022"]) || 0;
          const l = Number(v["2_00042"]) || 0;
          const tot = Number(v["2_00001"]) || 0;
          return Math.abs(tot - (s + m + l)) < 0.05;
        }
      }
    ],
    SourceFilename: "BD_L&A_BD001.txt",
    SourceHash: "sha256-bd001-canonical"
  },
  {
    ReturnKey: "COL_SOL_18M_LL001",
    Code: "LL001",
    Title: "Foreclosed Collateral Properties Sold within 18 Months",
    Category: "Assets & Collateral",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly tracking of foreclosed property auctions, disposal expenses, and net recovered amounts.",
    ReturnItemsList: [
      { Code: "94_00001", Value: "", _description: "Total Outstanding balance_Interest", _dataType: "NUMERIC", _required: false },
      { Code: "94_00002", Value: "", _description: "Total Collateral_Sales value", _dataType: "NUMERIC", _required: false },
      { Code: "94_00003", Value: "", _description: "Total Collateral_Expenses related to Disposal", _dataType: "NUMERIC", _required: false },
      { Code: "94_00004", Value: "", _description: "Total Collateral_Net realized value", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "94_00005", Value: "", _description: "Total Outstanding foreclosed balance_Principal", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [
      {
        Area: 187,
        _areaName: "Foreclosed Properties Auctioned",
        DynamicItems: [
          { Code: "1.1", Value: "", _description: "Name of Borrower", _dataType: "TEXT", _required: true },
          { Code: "1.2", Value: "", _description: "Outstanding Principal [A]", _dataType: "NUMERIC", _required: false },
          { Code: "1.3", Value: "", _description: "Outstanding Interest", _dataType: "NUMERIC", _required: false },
          { Code: "1.4", Value: "", _description: "Type of property/collateral [B]", _dataType: "TEXT", _required: false },
          { Code: "1.5", Value: "", _description: "Estimated Value at Loan Extension [C]", _dataType: "NUMERIC", _required: false },
          { Code: "1.6", Value: "", _description: "Date of foreclosure & sold [D]", _dataType: "DATE", _required: false },
          { Code: "1.7", Value: "", _description: "Sales value [E]", _dataType: "NUMERIC", _required: false },
          { Code: "1.8", Value: "", _description: "Expenses related to Disposal [F]", _dataType: "NUMERIC", _required: false },
          { Code: "1.9", Value: "", _description: "Net realized value [G = E - F]", _dataType: "NUMERIC", _required: false }
        ]
      }
    ],
    Formulas: [
      { targetCode: "94_00004", expression: "94_00002 - 94_00003", description: "Net Realized Value = Sales Value - Expenses", dependencies: ["94_00002", "94_00003"] }
    ],
    ValidationRules: [
      {
        id: "ll001-net-positive",
        name: "Realized Net Value Positive",
        description: "Net realized value must be greater than or equal to zero",
        severity: "ERROR",
        check: (v) => (Number(v["94_00004"]) || 0) >= 0
      }
    ],
    SourceFilename: "COL_SOL_18M_LL001.txt",
    SourceHash: "sha256-ll001-canonical"
  },
  {
    ReturnKey: "COL_ACQ_18M_OL001",
    Code: "OL001",
    Title: "Collateral Acquired through Foreclosure within 18 Months",
    Category: "Assets & Collateral",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly inventory of collateral assets acquired through foreclosure that remain unsold.",
    ReturnItemsList: [
      { Code: "95_00001", Value: "", _description: "Total Outstanding acquired balance_Principal", _dataType: "NUMERIC", _required: false },
      { Code: "95_00002", Value: "", _description: "Total Outstanding balance_Interest", _dataType: "NUMERIC", _required: false },
      { Code: "95_00003", Value: "", _description: "Asked / Reserve Price", _dataType: "NUMERIC", _required: false },
      { Code: "95_00004", Value: "", _description: "Highest offered bid amount", _dataType: "NUMERIC", _required: false },
      { Code: "95_00005", Value: "", _description: "Average Market Value", _dataType: "NUMERIC", _required: false },
      { Code: "95_00006", Value: "", _description: "Expenses related to the acquisition", _dataType: "NUMERIC", _required: false },
      { Code: "95_00007", Value: "", _description: "Net Market Value", _dataType: "NUMERIC", _required: false, isTotal: true }
    ],
    DynamicItemsList: [
      {
        Area: 172,
        _areaName: "Acquired Properties Inventory",
        DynamicItems: [
          { Code: "1.1", Value: "", _description: "Name of Borrower", _dataType: "TEXT", _required: true },
          { Code: "1.2", Value: "", _description: "Outstanding Principal [A]", _dataType: "NUMERIC", _required: false },
          { Code: "1.3", Value: "", _description: "Outstanding Interest", _dataType: "NUMERIC", _required: false },
          { Code: "1.4", Value: "", _description: "Type of Collateral", _dataType: "TEXT", _required: false },
          { Code: "1.5", Value: "", _description: "Asked / Reserve Price [B]", _dataType: "NUMERIC", _required: false },
          { Code: "1.6", Value: "", _description: "Highest Bid Amount [C]", _dataType: "NUMERIC", _required: false },
          { Code: "1.7", Value: "", _description: "Average Market Value (D = (B+C)/2)", _dataType: "NUMERIC", _required: false },
          { Code: "1.8", Value: "", _description: "Date acquired", _dataType: "DATE", _required: false },
          { Code: "1.9", Value: "", _description: "Date re-evaluated", _dataType: "DATE", _required: false },
          { Code: "1.10", Value: "", _description: "Expenses related to acquisition [E]", _dataType: "NUMERIC", _required: false },
          { Code: "1.11", Value: "", _description: "Net Market Value (F = D - E)", _dataType: "NUMERIC", _required: false }
        ]
      }
    ],
    Formulas: [
      { targetCode: "95_00005", expression: "(95_00003 + 95_00004) / 2", description: "Average Market Value = (Reserve + Highest Bid) / 2", dependencies: ["95_00003", "95_00004"] },
      { targetCode: "95_00007", expression: "95_00005 - 95_00006", description: "Net Market Value = Average Market Value - Expenses", dependencies: ["95_00005", "95_00006"] }
    ],
    ValidationRules: [
      {
        id: "ol001-net-val",
        name: "Acquired Property Valuation Integrity",
        description: "Net market value must not exceed average market value",
        severity: "ERROR",
        check: (v) => {
          const avg = Number(v["95_00005"]) || 0;
          const net = Number(v["95_00007"]) || 0;
          return net <= avg;
        }
      }
    ],
    SourceFilename: "COL_ACQ_18M_OL001.txt",
    SourceHash: "sha256-ol001-canonical"
  },
  {
    ReturnKey: "RLAFCRC001",
    Code: "RC001",
    Title: "Restructured Loans After Concessions (Quarterly)",
    Category: "Restructuring",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly tracking of major restructured loans with concessions, collateral valuation, and capital exposure.",
    ReturnItemsList: [
      { Code: "152_00001", Value: "", _description: "Original Amount of Loans and Advance", _dataType: "NUMERIC", _required: false },
      { Code: "152_00002", Value: "", _description: "Amount of Loans and Advance after Latest Restructuring", _dataType: "NUMERIC", _required: false },
      { Code: "152_00003", Value: "", _description: "Value of Collateral", _dataType: "NUMERIC", _required: false },
      { Code: "152_00004", Value: "", _description: "Loan and Advance as a percentage of Bank's Total Capital", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [
      {
        Area: 195,
        _areaName: "Counterparties with Concessions",
        DynamicItems: [
          { Code: "1.1", Value: "", _description: "Name of the Counterparty/Borrower*", _dataType: "TEXT", _required: true }
        ]
      }
    ],
    Formulas: [],
    ValidationRules: [
      {
        id: "rc001-restructured-amount",
        name: "Restructured Loan Amount Verification",
        description: "Post-restructuring loan balance must be positive",
        severity: "ERROR",
        check: (v) => (Number(v["152_00002"]) || 0) > 0
      }
    ],
    SourceFilename: "RLAFCRC001.txt",
    SourceHash: "sha256-rc001-canonical"
  },
  {
    ReturnKey: "LOA_ADV_OUT_LA001",
    Code: "LA001",
    Title: "Loans & Advances Disbursement, Collection and Outstanding Outturn (Monthly)",
    Category: "Credit & Lending",
    Frequency: "MONTHLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-07-01T00:00:00",
    EndDate: "2026-07-31T00:00:00",
    Description: "Monthly tracking of loan disbursements, collections, and outstanding loan stock across all Ethiopian banking sectors.",
    ReturnItemsList: [
      { Code: "67_00001", Value: "", _description: "Agriculture_Public Enterprise_Disbursement", _dataType: "NUMERIC", _required: false },
      { Code: "67_00002", Value: "", _description: "Agriculture_Public Enterprise_Collection", _dataType: "NUMERIC", _required: false },
      { Code: "67_00003", Value: "", _description: "Agriculture_Public Enterprise_Outstanding", _dataType: "NUMERIC", _required: false },
      { Code: "67_00010", Value: "", _description: "Agriculture_Total_Disbursement", _dataType: "NUMERIC", _required: false },
      { Code: "67_00011", Value: "", _description: "Agriculture_Total_Collection", _dataType: "NUMERIC", _required: false },
      { Code: "67_00012", Value: "", _description: "Agriculture_Total_Outstanding", _dataType: "NUMERIC", _required: false },
      { Code: "67_00022", Value: "", _description: "Manufacturing_Total_Disbursement", _dataType: "NUMERIC", _required: false },
      { Code: "67_00023", Value: "", _description: "Manufacturing_Total_Collection", _dataType: "NUMERIC", _required: false },
      { Code: "67_00024", Value: "", _description: "Manufacturing_Total_Outstanding", _dataType: "NUMERIC", _required: false },
      { Code: "67_00034", Value: "", _description: "Domestic Trade_Total_Disbursement", _dataType: "NUMERIC", _required: false },
      { Code: "67_00035", Value: "", _description: "Domestic Trade_Total_Collection", _dataType: "NUMERIC", _required: false },
      { Code: "67_00036", Value: "", _description: "Domestic Trade_Total_Outstanding", _dataType: "NUMERIC", _required: false },
      { Code: "67_00178", Value: "", _description: "Total_Total_Disbursement", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "67_00179", Value: "", _description: "Total_Total_Collection", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "67_00180", Value: "", _description: "Total_Total_Outstanding", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "67_00286", Value: "", _description: "Grand Total_Disbursement", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "67_00287", Value: "", _description: "Grand Total_Collection", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "67_00288", Value: "", _description: "Grand Total_Outstanding", _dataType: "NUMERIC", _required: false, isTotal: true }
    ],
    DynamicItemsList: [],
    Formulas: [
      { targetCode: "67_00286", expression: "67_00010 + 67_00022 + 67_00034", description: "Disbursement Sum Check", dependencies: ["67_00010", "67_00022", "67_00034"] }
    ],
    ValidationRules: [
      {
        id: "la001-nonneg",
        name: "Collection and Disbursement Positive",
        description: "All collections and disbursements must be non-negative",
        severity: "ERROR",
        check: (v) => Object.values(v).every((x) => typeof x !== "number" || x >= 0)
      }
    ],
    SourceFilename: "LOA_ADV_OUT_LA001.txt",
    SourceHash: "sha256-la001-canonical"
  },
  {
    ReturnKey: "NPL_ECPOMNE001",
    Code: "NE001",
    Title: "NPL by Economic Sector & Top 6 Branches",
    Category: "Sector Breakdown",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly analysis of non-performing loans categorized by economic sector and the top 6 contributing branches.",
    ReturnItemsList: [
      { Code: "92_00001", Value: "", _description: "Agriculture_Substandard Term loan", _dataType: "NUMERIC", _required: false },
      { Code: "92_00007", Value: "", _description: "Agriculture_Total", _dataType: "NUMERIC", _required: false },
      { Code: "92_00008", Value: "", _description: "Manufacturing_Substandard Term loan", _dataType: "NUMERIC", _required: false },
      { Code: "92_00014", Value: "", _description: "Manufacturing_Total", _dataType: "NUMERIC", _required: false },
      { Code: "92_00015", Value: "", _description: "Domestic Trade & Service_Substandard Term loan", _dataType: "NUMERIC", _required: false },
      { Code: "92_00021", Value: "", _description: "Domestic Trade & Service_Total", _dataType: "NUMERIC", _required: false },
      { Code: "92_00112", Value: "", _description: "Total (Economic Sector)_Total", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "92_00119", Value: "", _description: "Total (Branch)_Total", _dataType: "NUMERIC", _required: false, isTotal: true }
    ],
    DynamicItemsList: [
      {
        Area: 179,
        _areaName: "Top 6 Branches by NPL Volume",
        DynamicItems: [
          { Code: "1.1", Value: "", _description: "Branch Name", _dataType: "TEXT", _required: true },
          { Code: "1.2", Value: "", _description: "Substandard Term Loan", _dataType: "NUMERIC", _required: false },
          { Code: "1.3", Value: "", _description: "Substandard O/D", _dataType: "NUMERIC", _required: false },
          { Code: "1.4", Value: "", _description: "Doubtful Term Loan", _dataType: "NUMERIC", _required: false },
          { Code: "1.5", Value: "", _description: "Doubtful O/D", _dataType: "NUMERIC", _required: false },
          { Code: "1.6", Value: "", _description: "Loss Term Loan", _dataType: "NUMERIC", _required: false },
          { Code: "1.7", Value: "", _description: "Loss O/D", _dataType: "NUMERIC", _required: false },
          { Code: "1.8", Value: "", _description: "Total Branch NPL", _dataType: "NUMERIC", _required: false }
        ]
      }
    ],
    Formulas: [
      { targetCode: "92_00112", expression: "92_00007 + 92_00014 + 92_00021", description: "Sector Total NPL = Sum of Sectors", dependencies: ["92_00007", "92_00014", "92_00021"] }
    ],
    ValidationRules: [
      {
        id: "ne001-branch-positive",
        name: "Branch NPL Values Positive",
        description: "Branch NPL totals must be non-negative",
        severity: "ERROR",
        check: (v) => (Number(v["92_00119"]) || 0) >= 0
      }
    ],
    SourceFilename: "NPL_ECPOMNE001.txt",
    SourceHash: "sha256-ne001-canonical"
  },
  {
    ReturnKey: "LOA_PORT_EP001",
    Code: "EP001",
    Title: "Loan Portfolio by Facility Type & Maturity (Monthly)",
    Category: "Credit & Lending",
    Frequency: "MONTHLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-07-01T00:00:00",
    EndDate: "2026-07-31T00:00:00",
    Description: "Monthly regulatory distribution of overdrafts, merchandise loans, import/export bills, and term loan facilities.",
    ReturnItemsList: [
      { Code: "34_00001", Value: "", _description: "Advance on import bills_Disbursement in the month_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "34_00003", Value: "", _description: "Advance on import bills_Outstanding Loans and Advances_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "34_00006", Value: "", _description: "Pre-shipment export loans_Disbursement in the month_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "34_00008", Value: "", _description: "Pre-shipment export loans_Outstanding Loans and Advances_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "34_00011", Value: "", _description: "Overdraft facilities_Disbursement in the month_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "34_00013", Value: "", _description: "Overdraft facilities_Outstanding Loans and Advances_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "34_00016", Value: "", _description: "Merchandise _Disbursement in the Month_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "34_00018", Value: "", _description: "Merchandise_Outstanding Loans and Advances_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "34_00019", Value: "", _description: "Term Loans_Disbursement in the Month_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "34_00045", Value: "", _description: "Term Loans_Outstanding Loans and Advance_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "34_00026", Value: "", _description: "Total(sum 1.1-1.5)_Disbursement in the Month_Amount", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "34_00028", Value: "", _description: "Total(sum 1.1-1.5)_Outstanding Loans and Advances_Amount", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "34_00041", Value: "", _description: "Total(sum 2.1-2.2)_Disbursement in the month_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "34_00043", Value: "", _description: "Total(sum 2.1-2.2)_Outstanding Loans and Advances_Amount", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [],
    Formulas: [
      { targetCode: "34_00026", expression: "34_00001 + 34_00006 + 34_00011 + 34_00016 + 34_00019", description: "Total Disbursement = Sum(Facilities)", dependencies: ["34_00001", "34_00006", "34_00011", "34_00016", "34_00019"] },
      { targetCode: "34_00028", expression: "34_00003 + 34_00008 + 34_00013 + 34_00018 + 34_00045", description: "Total Outstanding = Sum(Facilities)", dependencies: ["34_00003", "34_00008", "34_00013", "34_00018", "34_00045"] }
    ],
    ValidationRules: [
      {
        id: "ep001-total-reconciled",
        name: "Portfolio Total Reconciled",
        description: "Total portfolio must equal sum of constituent facilities",
        severity: "ERROR",
        check: (v) => {
          const tot = Number(v["34_00028"]) || 0;
          const a = Number(v["34_00003"]) || 0;
          const b = Number(v["34_00008"]) || 0;
          const c = Number(v["34_00013"]) || 0;
          const d = Number(v["34_00018"]) || 0;
          const e = Number(v["34_00045"]) || 0;
          return Math.abs(tot - (a + b + c + d + e)) < 0.05;
        }
      }
    ],
    SourceFilename: "LOA_PORT_EP001.txt",
    SourceHash: "sha256-ep001-canonical"
  },
  {
    ReturnKey: "LOAN_RAN & REGRL002",
    Code: "RL002",
    Title: "Loan Portfolio by Size Range and Region (Monthly - RL002)",
    Category: "Credit & Lending",
    Frequency: "MONTHLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-07-01T00:00:00",
    EndDate: "2026-07-31T00:00:00",
    Description: "Monthly breakdown of loan amounts, borrower counts, and account counts across Ethiopian regions and size tiers.",
    ReturnItemsList: [
      { Code: "RL002_48782", Value: "", _description: "Addis Ababa_<= 100,000_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "RL002_48783", Value: "", _description: "Addis Ababa_ <= 100,000_# of Borrowers", _dataType: "NUMERIC", _required: false },
      { Code: "RL002_48784", Value: "", _description: "Addis Ababa_<= 100,000_ # of Accounts  ", _dataType: "NUMERIC", _required: false },
      { Code: "RL002_48803", Value: "", _description: "Addis Ababa_Total_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "RL002_48804", Value: "", _description: "Addis Ababa_  Total_# of Borrowers", _dataType: "NUMERIC", _required: false },
      { Code: "RL002_48805", Value: "", _description: "Addis Ababa_Total_ # of Accounts  ", _dataType: "NUMERIC", _required: false },
      { Code: "RL002_50819", Value: "", _description: "Total Amount_Total_Amount", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "RL002_50820", Value: "", _description: "Total Amount_  Total_# of Borrowers", _dataType: "NUMERIC", _required: false },
      { Code: "RL002_50821", Value: "", _description: "Total Amount_Total_ # of Accounts  ", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [],
    Formulas: [],
    ValidationRules: [
      {
        id: "rl002-accounts-check",
        name: "Account to Borrower Concordance",
        description: "Number of accounts must be at least equal to number of borrowers",
        severity: "ERROR",
        check: (v) => (Number(v["RL002_50821"]) || 0) >= (Number(v["RL002_50820"]) || 0)
      }
    ],
    SourceFilename: "LOAN_RAN & REGRL002.txt",
    SourceHash: "sha256-rl002-canonical"
  },
  {
    ReturnKey: "LOAN_RAN&REG_RA002",
    Code: "RA002",
    Title: "Loan Portfolio by Size Range and Region (Quarterly - RA002)",
    Category: "Credit & Lending",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly breakdown of loan amounts, borrower counts, and account counts across Ethiopian regions and size tiers.",
    ReturnItemsList: [
      { Code: "RA002_40622", Value: "", _description: "Addis Ababa_<= 100,000_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "RA002_40623", Value: "", _description: "Addis Ababa_ <= 100,000_# of Borrowers", _dataType: "NUMERIC", _required: false },
      { Code: "RA002_40643", Value: "", _description: "Addis Ababa_Total_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "RA002_42659", Value: "", _description: "Total Amount_Total_Amount", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "RA002_42660", Value: "", _description: "Total Amount_  Total_# of Borrowers", _dataType: "NUMERIC", _required: false },
      { Code: "RA002_42661", Value: "", _description: "Total Amount_Total_ # of Accounts  ", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [],
    Formulas: [],
    ValidationRules: [
      {
        id: "ra002-total-positive",
        name: "Grand Total Positive",
        description: "Grand total loan volume must be greater than zero",
        severity: "ERROR",
        check: (v) => (Number(v["RA002_42659"]) || 0) >= 0
      }
    ],
    SourceFilename: "LOAN_RAN&REG_RA002.txt",
    SourceHash: "sha256-ra002-canonical"
  },
  {
    ReturnKey: "LOAN_SEC&REG_SE002",
    Code: "SE002",
    Title: "Loans by Economic Sector & Region (Quarterly - SE002)",
    Category: "Sector Breakdown",
    Frequency: "QUARTERLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-04-01T00:00:00",
    EndDate: "2026-06-30T00:00:00",
    Description: "Quarterly cross-tabulation of credit distribution by economic sector and administrative region.",
    ReturnItemsList: [
      { Code: "SE002_39092", Value: "", _description: "Addis Ababa_Public Enterprise_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "SE002_39095", Value: "", _description: "Addis Ababa_Private & Coop._Amount", _dataType: "NUMERIC", _required: false },
      { Code: "SE002_39107", Value: "", _description: "Addis Ababa_Total_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "SE002_40619", Value: "", _description: "Total Amount_Total_Amount", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "SE002_40620", Value: "", _description: "Total Amount_Total_  # of Borrowers", _dataType: "NUMERIC", _required: false },
      { Code: "SE002_40621", Value: "", _description: "Total Amount_ Total_# of Accounts  ", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [],
    Formulas: [],
    ValidationRules: [
      {
        id: "se002-non-negative",
        name: "Non-Negative Balances",
        description: "All sector loan volumes must be non-negative",
        severity: "ERROR",
        check: (v) => (Number(v["SE002_40619"]) || 0) >= 0
      }
    ],
    SourceFilename: "LOAN_SEC&REG_SE002.txt",
    SourceHash: "sha256-se002-canonical"
  },
  {
    ReturnKey: "LOAN_SEC & REGRS002",
    Code: "RS002",
    Title: "Loans by Economic Sector & Region (Monthly - RS002)",
    Category: "Sector Breakdown",
    Frequency: "MONTHLY",
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: "2026-07-01T00:00:00",
    EndDate: "2026-07-31T00:00:00",
    Description: "Monthly cross-tabulation of credit distribution by economic sector and administrative region.",
    ReturnItemsList: [
      { Code: "RS002_50822", Value: "", _description: "Addis Ababa_Public Enterprise_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "RS002_50825", Value: "", _description: "Addis Ababa_Private & Coop._Amount", _dataType: "NUMERIC", _required: false },
      { Code: "RS002_50837", Value: "", _description: "Addis Ababa_Total_Amount", _dataType: "NUMERIC", _required: false },
      { Code: "RS002_52349", Value: "", _description: "Total Amount_Total_Amount", _dataType: "NUMERIC", _required: false, isTotal: true },
      { Code: "RS002_52350", Value: "", _description: "Total Amount_Total_  # of Borrowers", _dataType: "NUMERIC", _required: false },
      { Code: "RS002_52351", Value: "", _description: "Total Amount_ Total_# of Accounts  ", _dataType: "NUMERIC", _required: false }
    ],
    DynamicItemsList: [],
    Formulas: [],
    ValidationRules: [
      {
        id: "rs002-non-negative",
        name: "Monthly Sector Reconciled",
        description: "Monthly sector amounts must be non-negative",
        severity: "ERROR",
        check: (v) => (Number(v["RS002_52349"]) || 0) >= 0
      }
    ],
    SourceFilename: "LOAN_SEC & REGRS002.txt",
    SourceHash: "sha256-rs002-canonical"
  }
];

// Ensure all 24 reports have their canonical department and departments array assigned
NBE_REPORTS.forEach((r) => {
  if (!r.department) {
    r.department = getDepartmentForReport(r.ReturnKey);
  }
  if (!r.departments) {
    r.departments = [r.department];
  }
});

const REPORTS_STORAGE_KEY = 'ob_report_templates_registry';
const REPORTS_CHANGE_EVENT = 'ob:reports:changed';
type ReportChangeListener = (reports: ReportMetadata[]) => void;
const reportListeners: Set<ReportChangeListener> = new Set();

let dynamicReportsList: ReportMetadata[] = [];

function initDynamicReports(): void {
  if (typeof window === 'undefined') {
    dynamicReportsList = JSON.parse(JSON.stringify(NBE_REPORTS));
    return;
  }

  try {
    const stored = localStorage.getItem(REPORTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        dynamicReportsList = parsed;
        return;
      }
    }
  } catch (e) {
    console.warn('[ReportRegistry] Failed to read stored reports:', e);
  }

  // Initial seeding: clone canonical NBE_REPORTS
  dynamicReportsList = JSON.parse(JSON.stringify(NBE_REPORTS));
  // Enrich with departments from departmentService
  dynamicReportsList.forEach((r) => {
    try {
      const depts = departmentService.getDepartmentsForReport(r.ReturnKey);
      if (depts && depts.length > 0) {
        r.departments = depts;
        r.department = depts[0];
      }
    } catch {}
  });

  saveDynamicReports();
}

function saveDynamicReports(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(dynamicReportsList));
      window.dispatchEvent(new CustomEvent(REPORTS_CHANGE_EVENT, { detail: dynamicReportsList }));
    } catch (e) {
      console.warn('[ReportRegistry] Failed to persist reports:', e);
    }
  }
  reportListeners.forEach((fn) => {
    try {
      fn(dynamicReportsList);
    } catch {}
  });
}

initDynamicReports();

export function subscribeReports(listener: ReportChangeListener): () => void {
  reportListeners.add(listener);
  return () => reportListeners.delete(listener);
}

export function getAllReports(): ReportMetadata[] {
  if (dynamicReportsList.length === 0) {
    initDynamicReports();
  }
  return JSON.parse(JSON.stringify(dynamicReportsList));
}

export function getReportByKey(key: string): ReportMetadata | undefined {
  if (dynamicReportsList.length === 0) {
    initDynamicReports();
  }
  const norm = key.trim().toUpperCase();
  return dynamicReportsList.find((r) => r.ReturnKey.toUpperCase() === norm || r.Code.toUpperCase() === norm);
}

export const getReportDefinition = getReportByKey;

export function getReportsByCategory(category: string): ReportMetadata[] {
  return getAllReports().filter((r) => r.Category === category);
}

export function getReportsByDepartment(department: string): ReportMetadata[] {
  const norm = department.trim().toLowerCase();
  return getAllReports().filter((r) => {
    if (r.department && r.department.toLowerCase() === norm) return true;
    if (Array.isArray(r.departments) && r.departments.some((d) => d.toLowerCase() === norm)) return true;
    return false;
  });
}

export function getReportsByFrequency(frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL"): ReportMetadata[] {
  return getAllReports().filter((r) => r.Frequency === frequency);
}

/**
 * Adds a new regulatory report type demanded by NBE or configured by the bank
 */
export function addReportType(
  data: {
    ReturnKey: string;
    Code?: string;
    Title: string;
    Category: "Credit & Lending" | "Classification & Provisioning" | "Exposures & Concentration" | "Assets & Collateral" | "Restructuring" | "Sector Breakdown";
    Frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL";
    Description: string;
    departments?: string[];
    department?: string;
    initialFieldsCount?: number;
  },
  adminName = 'Administrator'
): { success: boolean; report?: ReportMetadata; message?: string } {
  const key = data.ReturnKey.trim().toUpperCase();
  if (!key) {
    return { success: false, message: 'Return Key is required.' };
  }

  if (getReportByKey(key)) {
    return { success: false, message: `Report with return key "${key}" already exists.` };
  }

  const primaryDept = data.department || (data.departments && data.departments[0]) || 'Credit Operations & Portfolio Management';
  const linkedDepts = data.departments && data.departments.length > 0 ? Array.from(new Set(data.departments)) : [primaryDept];

  const initialItemsCount = data.initialFieldsCount && data.initialFieldsCount > 0 ? data.initialFieldsCount : 4;
  const returnItems = [];
  for (let i = 1; i <= initialItemsCount; i++) {
    const itemCode = `${key}_${String(i).padStart(5, '0')}`;
    returnItems.push({
      Code: itemCode,
      Value: "",
      _description: `Schedule ${i}: Core Balance & Exposure Value`,
      _dataType: "NUMERIC" as const,
      _required: i === 1,
      isTotal: i === initialItemsCount,
    });
  }

  const newReport: ReportMetadata = {
    ReturnKey: key,
    Code: data.Code?.trim().toUpperCase() || key,
    Title: data.Title.trim(),
    Category: data.Category,
    Frequency: data.Frequency,
    InstCode: "0000013",
    FinYear: 2026,
    StartDate: data.Frequency === 'MONTHLY' ? "2026-07-01T00:00:00" : "2026-04-01T00:00:00",
    EndDate: data.Frequency === 'MONTHLY' ? "2026-07-31T00:00:00" : "2026-06-30T00:00:00",
    Description: data.Description.trim(),
    department: primaryDept,
    departments: linkedDepts,
    ReturnItemsList: returnItems,
    DynamicItemsList: [],
    Formulas: [],
    ValidationRules: [
      {
        id: `${key.toLowerCase()}-positive-balances`,
        name: "Positive Balances Rule",
        description: "Report amounts must be positive numbers",
        severity: "ERROR",
        check: (v) => Object.values(v).every((val) => typeof val !== "number" || val >= 0),
      },
    ],
    SourceFilename: `${key}.json`,
    SourceHash: `sha256-custom-${Date.now()}`,
    isCustom: true,
  };

  dynamicReportsList.push(newReport);
  saveDynamicReports();

  // Synchronize department linkages in departmentService & log Version 1
  try {
    departmentService.setReportDepartments(newReport.ReturnKey, linkedDepts);
    departmentService.recordReportVersion(
      newReport.ReturnKey,
      'CREATED',
      adminName,
      `Registered new regulatory return template "${newReport.Title}"`,
      newReport
    );
  } catch {}

  return { success: true, report: newReport, message: `Report "${newReport.Title}" (${newReport.ReturnKey}) created successfully.` };
}

/**
 * Updates an existing regulatory report template
 */
export function updateReportType(
  key: string,
  updates: {
    Title?: string;
    Category?: "Credit & Lending" | "Classification & Provisioning" | "Exposures & Concentration" | "Assets & Collateral" | "Restructuring" | "Sector Breakdown";
    Frequency?: "MONTHLY" | "QUARTERLY" | "ANNUAL";
    Description?: string;
    departments?: string[];
    department?: string;
  },
  adminName = 'Administrator'
): { success: boolean; report?: ReportMetadata; message?: string } {
  const norm = key.trim().toUpperCase();
  const report = dynamicReportsList.find((r) => r.ReturnKey.toUpperCase() === norm);
  if (!report) {
    return { success: false, message: 'Report not found.' };
  }

  const prevSnapshot = { ...report };

  if (updates.Title) report.Title = updates.Title.trim();
  if (updates.Category) report.Category = updates.Category;
  if (updates.Frequency) report.Frequency = updates.Frequency;
  if (updates.Description !== undefined) report.Description = updates.Description.trim();

  if (updates.departments && updates.departments.length > 0) {
    report.departments = Array.from(new Set(updates.departments));
    report.department = report.departments[0];
    try {
      departmentService.setReportDepartments(report.ReturnKey, report.departments);
    } catch {}
  } else if (updates.department) {
    report.department = updates.department;
    if (!report.departments) report.departments = [];
    if (!report.departments.includes(updates.department)) {
      report.departments.push(updates.department);
    }
    try {
      departmentService.setReportDepartments(report.ReturnKey, report.departments);
    } catch {}
  }

  saveDynamicReports();

  try {
    departmentService.recordReportVersion(
      report.ReturnKey,
      prevSnapshot.Title !== report.Title ? 'RENAMED' : 'METADATA_CHANGED',
      adminName,
      prevSnapshot.Title !== report.Title
        ? `Renamed report template from "${prevSnapshot.Title}" to "${report.Title}"`
        : `Updated report template metadata and linkages`,
      report,
      prevSnapshot
    );
  } catch {}

  return { success: true, report, message: `Report "${report.Title}" updated successfully.` };
}

/**
 * Removes or archives a report type
 */
export function removeReportType(key: string, adminName = 'Administrator'): { success: boolean; message?: string } {
  const norm = key.trim().toUpperCase();
  const index = dynamicReportsList.findIndex((r) => r.ReturnKey.toUpperCase() === norm);
  if (index === -1) {
    return { success: false, message: 'Report not found.' };
  }

  const removed = dynamicReportsList.splice(index, 1)[0];
  saveDynamicReports();

  // Clear linkages in departmentService and record decommissioned version
  try {
    departmentService.setReportDepartments(removed.ReturnKey, []);
    departmentService.recordReportVersion(
      removed.ReturnKey,
      'DECOMMISSIONED',
      adminName,
      `Decommissioned report return template "${removed.Title}" from active catalogue`,
      removed
    );
  } catch {}

  return { success: true, message: `Report "${removed.Title}" (${removed.ReturnKey}) removed from active catalogue.` };
}

export function resetReportsToDefault(): void {
  dynamicReportsList = JSON.parse(JSON.stringify(NBE_REPORTS));
  saveDynamicReports();
}

/**
 * Renames all occurrences of an old department name across active report templates
 */
export function renameDepartmentInReports(oldName: string, newName: string): number {
  let count = 0;
  const oldNorm = oldName.trim().toLowerCase();
  for (const r of dynamicReportsList) {
    let changed = false;
    if (r.department && r.department.trim().toLowerCase() === oldNorm) {
      r.department = newName;
      changed = true;
    }
    if (Array.isArray(r.departments)) {
      if (r.departments.some((d) => d.trim().toLowerCase() === oldNorm)) {
        r.departments = r.departments.map((d) => (d.trim().toLowerCase() === oldNorm ? newName : d));
        changed = true;
      }
    }
    if (changed) count++;
  }
  if (count > 0) {
    saveDynamicReports();
  }
  return count;
}

/**
 * Reassigns department linkages when a department is removed from bank structure
 */
export function reassignDepartmentInReports(removedDept: string, fallbackDept: string): number {
  let count = 0;
  const remNorm = removedDept.trim().toLowerCase();
  for (const r of dynamicReportsList) {
    let changed = false;
    if (r.department && r.department.trim().toLowerCase() === remNorm) {
      r.department = fallbackDept;
      changed = true;
    }
    if (Array.isArray(r.departments)) {
      if (r.departments.some((d) => d.trim().toLowerCase() === remNorm)) {
        r.departments = r.departments.filter((d) => d.trim().toLowerCase() !== remNorm);
        if (r.departments.length === 0) {
          r.departments = [fallbackDept];
        }
        changed = true;
      }
    }
    if (changed) count++;
  }
  if (count > 0) {
    saveDynamicReports();
  }
  return count;
}

/**
 * Synchronizes an SSOT report definition/version directly into the active report catalog
 */
export function syncSSOTReportToRegistry(report: ReportMetadata): void {
  if (dynamicReportsList.length === 0) {
    initDynamicReports();
  }
  const norm = report.ReturnKey.trim().toUpperCase();
  const index = dynamicReportsList.findIndex((r) => r.ReturnKey.toUpperCase() === norm);
  if (index >= 0) {
    dynamicReportsList[index] = { ...dynamicReportsList[index], ...report };
  } else {
    dynamicReportsList.push(report);
  }
  saveDynamicReports();
}

/**
 * Marks an SSOT report as retired/decommissioned in the active registry
 */
export function retireSSOTReportInRegistry(returnKey: string): void {
  if (dynamicReportsList.length === 0) {
    initDynamicReports();
  }
  const norm = returnKey.trim().toUpperCase();
  const index = dynamicReportsList.findIndex((r) => r.ReturnKey.toUpperCase() === norm);
  if (index >= 0) {
    dynamicReportsList[index] = {
      ...dynamicReportsList[index],
      Description: `[RETIRED] ${dynamicReportsList[index].Description}`,
    };
    saveDynamicReports();
  }
}
