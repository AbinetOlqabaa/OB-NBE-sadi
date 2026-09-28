import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// The 24 report JSON definitions supplied in the prompt
const reportAssetsRaw: { filename: string; jsonStr: string }[] = [
  {
    filename: "POBEPE001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "POBEPE001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "153_00001", "Value": "", "_description": "1. Guarantee (sum1.1-1.2)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00002", "Value": "", "_description": "1. Guarantee (sum1.1-1.2)_Provisioning Rate (B)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00003", "Value": "", "_description": "1. Guarantee (sum1.1-1.2)_NPL's Amount (C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00004", "Value": "", "_description": "1. Guarantee (sum1.1-1.2)_Additional Provisioning Rate (2%)* (D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00005", "Value": "", "_description": "1. Guarantee (sum1.1-1.2)_Amount Under litigation (E)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00006", "Value": "", "_description": "1. Guarantee (sum1.1-1.2)_Additional Provisioning rate (5%)**(F)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00007", "Value": "", "_description": "1. Guarantee (sum1.1-1.2)_Required Provisions (G)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00008", "Value": "", "_description": "1. Guarantee (sum1.1-1.2)_Accumulated provision held in the Previous Period (H)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00009", "Value": "", "_description": "1. Guarantee (sum1.1-1.2)_Excess/Shortfall in Provisions (I)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00010", "Value": "", "_description": "1.1 With no counter guarantee_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00011", "Value": "", "_description": "1.1 With no counter guarantee_Provisioning rate (B)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00012", "Value": "", "_description": "1.1 With no counter guarantee_NPL's amount (C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00013", "Value": "", "_description": "1.1 With no counter guarantee_Additional Provisioning Rate (2%)*(D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00014", "Value": "", "_description": "1.1 With no counter guarantee_Amount Under litigation (E)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00015", "Value": "", "_description": "1.1 With no counter guarantee_Additional Provisioning rate (5%)** (F)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00016", "Value": "", "_description": "1.1 With no counter guarantee_Required Provisions (G)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00017", "Value": "", "_description": "1.1 With no counter guarantee_Accumulated provision held in the Previous Period (H)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00018", "Value": "", "_description": "1.1 With no counter guarantee_Excess/Shortfall in Provisions (I)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00019", "Value": "", "_description": "1.2 With counter guarantee by foreign bank or insurance company with an A rating _Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00020", "Value": "", "_description": "1.2 With counter guarantee by foreign bank or insurance company with an A rating _Provisioning rate (B)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00021", "Value": "", "_description": "1.2 With counter guarantee by foreign bank or insurance company with an A rating _NPL's amount (C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00022", "Value": "", "_description": "1.2 With counter guarantee by foreign bank or insurance company with an A rating _Additional Provisioning Rate (2%)* (D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00023", "Value": "", "_description": "1.2 With counter guarantee by foreign bank or insurance company with an A rating _Amount Under litigation (E)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00024", "Value": "", "_description": "1.2 With counter guarantee by foreign bank or insurance company with an A rating _Additional Provisioning rate (5%)** (F)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00025", "Value": "", "_description": "1.2 With counter guarantee by foreign bank or insurance company with an A rating _Required Provisions (G)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00026", "Value": "", "_description": "1.2 With counter guarantee by foreign bank or insurance company with an A rating _Accumulated provision held in the Previous Period (H)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00027", "Value": "", "_description": "1.2 With counter guarantee by foreign bank or insurance company with an A rating _Excess/Shortfall in Provisions (I)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00028", "Value": "", "_description": "2 Commitment to provide Loan and Advance_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00029", "Value": "", "_description": "2 Commitment to provide Loan and Advance_Provisioning rate (B)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00030", "Value": "", "_description": "2 Commitment to provide Loan and Advance_NPL's Amount (C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00031", "Value": "", "_description": "2 Commitment to provide Loan and Advance_ Additional provisioning rate (2%)* (D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00032", "Value": "", "_description": "2 Commitment to provide Loan and Advance_Amount under litigation (5%) (E)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00033", "Value": "", "_description": "2 Commitment to provide Loan and Advance_Additional provisioning rate (5%) ** (F)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00034", "Value": "", "_description": "2 Commitment to provide Loan and Advance_Required provisions (G)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00035", "Value": "", "_description": "2 Commitment to provide Loan and Advance_Accumulated provision held in the Previous Period (H)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00036", "Value": "", "_description": "2 Commitment to provide Loan and Advance_Excess/Shortfall in Provisions (I)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00037", "Value": "", "_description": "3 Letter of Credit_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00038", "Value": "", "_description": "3 Letter of Credit_Provisioning rate (B)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00039", "Value": "", "_description": "3 Letter of Credit_NPL's amount (C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00040", "Value": "", "_description": "3 Letter of Credit_Additional provisioning rate (2%)* (D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00041", "Value": "", "_description": "3 Letter of Credit_Amount under litigation (E)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00042", "Value": "", "_description": "3 Letter of Credit_Additional Provisioning rate (5%)** (F)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00043", "Value": "", "_description": "3 Letter of Credit_Required Provisions (G)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00044", "Value": "", "_description": "3 Letter of Credit_Accumulated provision held in the Previous Period (H)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00045", "Value": "", "_description": "3 Letter of Credit_Excess/Shortfall in Provisions (I)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00046", "Value": "", "_description": "4 Others_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00047", "Value": "", "_description": "4 Others_Provisioning rate (B)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00048", "Value": "", "_description": "4 Others_NPL's amount (C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00049", "Value": "", "_description": "4 Others_Additional provisioning rate (2%)* (D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00050", "Value": "", "_description": "4 Others_Amount under litigation (E)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00051", "Value": "", "_description": "4 Others_Additional Provisioning rate (5%)** (F)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00052", "Value": "", "_description": "4 Others_Required Provisions (G)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00053", "Value": "", "_description": "4 Others_Accumulated provision held in the Previous Period (H)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00054", "Value": "", "_description": "4 Others_Excess/Shortfall in Provisions (I)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00055", "Value": "", "_description": "5 Total Off Balance Sheet Item (Sum 1-4)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00056", "Value": "", "_description": "5 Total Off Balance Sheet Item (Sum 1-4)_Provisioning rate (B)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00057", "Value": "", "_description": "5 Total Off Balance Sheet Item (Sum 1-4)_NPL's Amount (C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00058", "Value": "", "_description": "5 Total Off Balance Sheet Item (Sum 1-4)_Additional Provisioning Rate (2%)* (D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00059", "Value": "", "_description": "5 Total Off Balance Sheet Item (Sum 1-4)_Amount Under litigation (E)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00060", "Value": "", "_description": "5 Total Off Balance Sheet Item (Sum 1-4)_Additional Provisioning rate (5%)** (F)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00061", "Value": "", "_description": "5 Total Off Balance Sheet Item (Sum 1-4)_ Required Provisions (G)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00062", "Value": "", "_description": "5 Total Off Balance Sheet Item (Sum 1-4)_Accumulated provision held in the Previous Period (H)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00063", "Value": "", "_description": "5 Total Off Balance Sheet Item (Sum 1-4)_ Excess/Shortfall in Provisions (I)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "153_00064", "Value": "", "_description": "Total_Accumulated provision held", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "ARLAL001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "ARLAL001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "150_00001", "Value": "", "_description": "Restructured Loans and Advance at the end of the previous quarter_Number* of Restructured of Loan and Advances", "_dataType": "NUMERIC", "_required": false },
        { "Code": "150_00002", "Value": "", "_description": "Restructured Loans and Advance at the end of the previous quarter_Amount of Restructured Loan and Advance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "150_00003", "Value": "", "_description": "Restructured Loans and Advances during the quarter_Number* of Restructured of Loan and Advances", "_dataType": "NUMERIC", "_required": false },
        { "Code": "150_00004", "Value": "", "_description": "Restructured Loans and Advances during the quarter_Amount of Restructured Loan and Advance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "150_00005", "Value": "", "_description": "Total Restructured Loans and Advances_Number* of Restructured of Loan and Advances", "_dataType": "NUMERIC", "_required": false },
        { "Code": "150_00006", "Value": "", "_description": "Total Restructured Loans and Advances_Amount of Restructured Loan and Advance", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "ANARN001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "ANARN001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "149_00001", "Value": "", "_description": "Loans and Advance Re-Categorized from Non-Accrual To Accrual Status at the end of the previous quarter_Number* of  Loans and Advances Re-Categorized from Non-Accrual To Accrual Status", "_dataType": "NUMERIC", "_required": false },
        { "Code": "149_00002", "Value": "", "_description": "Loans and Advance Re-Categorized from Non-Accrual To Accrual Status at the end of the previous quarter_Amount of  Loans and Advance Re-Categorized from Non-Accrual To Accrual Status", "_dataType": "NUMERIC", "_required": false },
        { "Code": "149_00003", "Value": "", "_description": "Loans and Advance Re-Categorized from Non-Accrual To Accrual Status during the quarter_Number* of  Loans and Advances Re-Categorized from Non-Accrual To Accrual Status", "_dataType": "NUMERIC", "_required": false },
        { "Code": "149_00004", "Value": "", "_description": "Loans and Advance Re-Categorized from Non-Accrual To Accrual Status during the quarter_Amount of  Loans and Advance Re-Categorized from Non-Accrual To Accrual Status", "_dataType": "NUMERIC", "_required": false },
        { "Code": "149_00005", "Value": "", "_description": "Total  Loans and Advances Re-Categorized from Non-Accrual To Accrual Status_Number* of  Loans and Advances Re-Categorized from Non-Accrual To Accrual Status", "_dataType": "NUMERIC", "_required": false },
        { "Code": "149_00006", "Value": "", "_description": "Total  Loans and Advances Re-Categorized from Non-Accrual To Accrual Status_Amount of  Loans and Advance Re-Categorized from Non-Accrual To Accrual Status", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "DigitalLendingDL001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "DigitalLendingDL001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "161_00001", "Value": "", "_description": "Total_ Disbursement", "_dataType": "NUMERIC", "_required": false },
        { "Code": "161_00002", "Value": "", "_description": "Total_ Collection", "_dataType": "NUMERIC", "_required": false },
        { "Code": "161_00003", "Value": "", "_description": "Total_ Outstanding", "_dataType": "NUMERIC", "_required": false },
        { "Code": "161_00004", "Value": "", "_description": "Total_ # of Borrowers accounts", "_dataType": "NUMERIC", "_required": false },
        { "Code": "161_00005", "Value": "", "_description": "Total_ # of Borrowers", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "NPL&PRO_NL001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "NPL&PRO_NL001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "9_00001", "Value": "", "_description": "1-Total non-performing loans (sum 2-4)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00002", "Value": "", "_description": "2-Total substandard loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00003", "Value": "", "_description": "2,1- Realizable security", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00004", "Value": "", "_description": "2,2-Net substandard loans (2-2.1)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00005", "Value": "", "_description": "2,3-Specific provisions required (20% of 2.2)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00006", "Value": "", "_description": "2,4-Specific provisions held", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00007", "Value": "", "_description": "2,5-Excess/shortfall (2.4-2.3)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00008", "Value": "", "_description": "2,6-Number of classified loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00009", "Value": "", "_description": "3-Total doubtful loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00010", "Value": "", "_description": "3,1-Realizable security", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00011", "Value": "", "_description": "3,2-Net doubtful loans (3-3.1)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00012", "Value": "", "_description": "3,3-Specific provisions required (50% of 3.2)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00013", "Value": "", "_description": "3,4-Specific provisions held", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00014", "Value": "", "_description": "3,5-Excess/shortfall (3.4 – 3.3)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00015", "Value": "", "_description": "3,6-Number of classified loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00016", "Value": "", "_description": "4-Total loss loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00017", "Value": "", "_description": "4,1-Realizable security", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00018", "Value": "", "_description": "4,2-Net loss loans (4-4.1)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00019", "Value": "", "_description": "4,3-Specific provisions required (100% of 4.2)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00020", "Value": "", "_description": "4,4-Specific provisions held", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00021", "Value": "", "_description": "4,5-Excess/shortfall (4.4-4.3)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "9_00022", "Value": "", "_description": "4,6-Number of classified loans", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "RLAFCRC001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "RLAFCRC001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "152_00001", "Value": "", "_description": "Original Amount of Loans and Advance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "152_00002", "Value": "", "_description": "Amount of Loans and Advance after Latest Restructuring", "_dataType": "NUMERIC", "_required": false },
        { "Code": "152_00003", "Value": "", "_description": "Value of Collateral", "_dataType": "NUMERIC", "_required": false },
        { "Code": "152_00004", "Value": "", "_description": "Loan and Advance as a percentage of Bank's Total Capital", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": [
        {
          "Area": 195,
          "_areaName": "Restructured Loans",
          "DynamicItems": [
            { "Code": "1.1", "Value": "", "_description": "Name of the Counterparty/Borrower*", "_dataType": "TEXT", "_required": true }
          ]
        }
      ]
    }, null, 2)
  },
  {
    filename: "COL_SOL_18M_LL001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "COL_SOL_18M_LL001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "94_00001", "Value": "", "_description": "Total Outstanding balance_Interest", "_dataType": "NUMERIC", "_required": false },
        { "Code": "94_00002", "Value": "", "_description": "Total Collateral_Sales value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "94_00003", "Value": "", "_description": "Total Collateral_Expenses related to Disposal", "_dataType": "NUMERIC", "_required": false },
        { "Code": "94_00004", "Value": "", "_description": "Total Collateral_Net realized value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "94_00005", "Value": "", "_description": "Total Outstanding foreclosed balance_Principal", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": [
        {
          "Area": 187,
          "_areaName": "Foreclosed Properties",
          "DynamicItems": [
            { "Code": "1.1", "Value": "", "_description": "Name of Borrower", "_dataType": "TEXT", "_required": true },
            { "Code": "1.2", "Value": "", "_description": "Outstanding Balance[A] Principal", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.3", "Value": "", "_description": "Outstanding Balance[A] Interest", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.4", "Value": "", "_description": "Type of property/collateral [B]", "_dataType": "TEXT", "_required": false },
            { "Code": "1.5", "Value": "", "_description": "Estimated Value at the time of loan extension [C]", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.6", "Value": "", "_description": "Date of foreclosure & sold[D]", "_dataType": "TEXT", "_required": false },
            { "Code": "1.7", "Value": "", "_description": "Sales value[E]", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.8", "Value": "", "_description": "Expenses related to Disposal*[F]", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.9", "Value": "", "_description": "Net realized value [G=E-F]", "_dataType": "NUMERIC", "_required": false }
          ]
        }
      ]
    }, null, 2)
  },
  {
    filename: "COL_ACQ_18M_OL001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "COL_ACQ_18M_OL001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "95_00001", "Value": "", "_description": "Total Outstanding acquired balance_Principal", "_dataType": "NUMERIC", "_required": false },
        { "Code": "95_00002", "Value": "", "_description": "Total Outstanding balance_Interest", "_dataType": "NUMERIC", "_required": false },
        { "Code": "95_00003", "Value": "", "_description": "Asked /reserve Price", "_dataType": "NUMERIC", "_required": false },
        { "Code": "95_00004", "Value": "", "_description": "Highest offered bid amount ", "_dataType": "NUMERIC", "_required": false },
        { "Code": "95_00005", "Value": "", "_description": "Average Market Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "95_00006", "Value": "", "_description": "Expenses related to the acquisition", "_dataType": "NUMERIC", "_required": false },
        { "Code": "95_00007", "Value": "", "_description": "Net Market Value", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": [
        {
          "Area": 172,
          "_areaName": "Acquired Properties",
          "DynamicItems": [
            { "Code": "1.1", "Value": "", "_description": "Name of Borrower", "_dataType": "TEXT", "_required": true },
            { "Code": "1.2", "Value": "", "_description": "Outstanding Balance[A] Principal", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.3", "Value": "", "_description": "Outstanding Balance[A] Interest", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.4", "Value": "", "_description": "Type of Collateral", "_dataType": "TEXT", "_required": false },
            { "Code": "1.5", "Value": "", "_description": "Asked /reserve Price[B]", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.6", "Value": "", "_description": "Highest offered bid amount[C]", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.7", "Value": "", "_description": "Average Market Value (D=B+C/2)", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.8", "Value": "", "_description": "date acquired", "_dataType": "TEXT", "_required": false },
            { "Code": "1.9", "Value": "", "_description": "Date re-evaluated", "_dataType": "TEXT", "_required": false },
            { "Code": "1.10", "Value": "", "_description": "Expenses related to the acquisition [E]", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.11", "Value": "", "_description": "Net Market Value(F=D-E)", "_dataType": "NUMERIC", "_required": false }
          ]
        }
      ]
    }, null, 2)
  },
  {
    filename: "TOP_20_BOR_TB001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "TOP_20_BOR_TB001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        ...Array.from({ length: 20 }, (_, i) => ({
          Code: `14_000${(i + 1).toString().padStart(2, '0')}`,
          Value: "",
          _description: i === 19 ? "Name of Borrower_2" : (i >= 1 ? `Name of Borrower_${i + 2 > 20 ? 20 : i + 2}` : `Name of Borrower_1`),
          _dataType: "TEXT",
          _required: false
        })),
        { Code: "14_00020", Value: "", _description: "Sub total top ten(10) borrowers_Approved loan", _dataType: "NUMERIC", _required: false },
        { Code: "14_00021", Value: "", _description: "Sub total top ten(10) borrowers_Outstanding balance", _dataType: "NUMERIC", _required: false },
        { Code: "14_00022", Value: "", _description: "Sub total top ten(10) borrowers_Off balance sheet", _dataType: "NUMERIC", _required: false },
        { Code: "14_00023", Value: "", _description: "Sub total top ten(10) borrowers_Total outstanding exposure", _dataType: "NUMERIC", _required: false },
        { Code: "14_00024", Value: "", _description: "Grand total top twenty (20) borrowers_Approved loan", _dataType: "NUMERIC", _required: false },
        { Code: "14_00025", Value: "", _description: "Grand total top twenty (20) borrowers_Outstanding balance", _dataType: "NUMERIC", _required: false },
        { Code: "14_00026", Value: "", _description: "Grand total top twenty (20) borrowers_Off balance sheet", _dataType: "NUMERIC", _required: false },
        { Code: "14_00027", Value: "", _description: "Grand total top twenty (20) borrowers_Total outstanding exposure", _dataType: "NUMERIC", _required: false }
      ],
      "DynamicItemsList": [
        {
          "Area": 188,
          "_areaName": "Top 20 Borrowers Roster",
          "DynamicItems": [
            { "Code": "1.1", "Value": "", "_description": "S.No.", "_dataType": "TEXT", "_required": true },
            { "Code": "1.2", "Value": "", "_description": "Name of Borrower", "_dataType": "TEXT", "_required": false },
            { "Code": "1.3", "Value": "", "_description": "Collateral Value ", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.4", "Value": "", "_description": "Bank's Capital (excluding retained earnings & Provisional profit/loss)", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.5", "Value": "", "_description": "Outstanding Exposure_On balance sheet_Approved loan", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.6", "Value": "", "_description": "Outstanding Exposure_On balance sheet_Outstanding balance ", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.7", "Value": "", "_description": "Outstanding Exposure_Off balance sheet", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.8", "Value": "", "_description": "Total outstanding exposure", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.9", "Value": "", "_description": "% of Capital ", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.10", "Value": "", "_description": "Status ", "_dataType": "TEXT", "_required": false }
          ]
        }
      ]
    }, null, 2)
  },
  {
    filename: "TOP_20_NPLs_TN001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "TOP_20_NPLs_TN001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "10_00001", "Value": "", "_description": "Sub total top ten (10) NPLs_Loans Outstanding", "_dataType": "NUMERIC", "_required": false },
        { "Code": "10_00002", "Value": "", "_description": "Sub total top ten (10) NPLs_Provision Held", "_dataType": "NUMERIC", "_required": false },
        { "Code": "10_00003", "Value": "", "_description": "Grand total top twenty (20) NPLs_Loans Approved", "_dataType": "NUMERIC", "_required": false },
        { "Code": "10_00004", "Value": "", "_description": "Sub total top ten (10) NPLs_Collateral value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "10_00005", "Value": "", "_description": "Sub total top ten (10) NPLs_Loans Approved", "_dataType": "NUMERIC", "_required": false },
        { "Code": "10_00006", "Value": "", "_description": "Grand total top twenty (20) NPLs_Loans Outstanding", "_dataType": "NUMERIC", "_required": false },
        { "Code": "10_00007", "Value": "", "_description": "Grand total top twenty (20) NPLs_Collateral value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "10_00008", "Value": "", "_description": "Grand total top twenty (20) NPLs_Provision held", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": [
        {
          "Area": 171,
          "_areaName": "Top 20 NPLs Dynamic List",
          "DynamicItems": [
            { "Code": "1.1", "Value": "", "_description": "S.No.", "_dataType": "TEXT", "_required": true },
            { "Code": "1.2", "Value": "", "_description": "Name of Borrower", "_dataType": "TEXT", "_required": false },
            { "Code": "1.3", "Value": "", "_description": "Loans Approved", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.4", "Value": "", "_description": "Loans Outstanding", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.5", "Value": "", "_description": "Collateral Value ", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.6", "Value": "", "_description": "Provision held", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.7", "Value": "", "_description": "Loan Status", "_dataType": "TEXT", "_required": false }
          ]
        }
      ]
    }, null, 2)
  },
  {
    filename: "BUIL_CONSTXW002.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "BUIL_CONSTXW002",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "157_00001", "Value": "", "_description": "Real_Estate_Sub Total_Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00002", "Value": "", "_description": "Real_Estate_Sub Total_Collateral Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00003", "Value": "", "_description": "Real_Estate_Sub Total_Provision Held", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00004", "Value": "", "_description": "Commercial Building_Sub Total_Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00005", "Value": "", "_description": "Commercial Building_Sub Total_Collateral Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00006", "Value": "", "_description": "Commercial Building_Sub Total_Provision Held", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00007", "Value": "", "_description": "Residential building(total)_Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00008", "Value": "", "_description": "Residential building(total)_Collateral Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00009", "Value": "", "_description": "Residential building(total)_Provision Held", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00010", "Value": "", "_description": "Sub Grand total(1+2+3)_Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00011", "Value": "", "_description": "Sub Grand total(1+2+3)_Collateral Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00012", "Value": "", "_description": "Sub Grand total(1+2+3)_Provision held", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00013", "Value": "", "_description": "Other construction sector(total)_Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00014", "Value": "", "_description": "Other construction sector(total)_Collateral Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00015", "Value": "", "_description": "Other construction sector(total)_Provision Held", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00016", "Value": "", "_description": "Total construction loans(4+5)_Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00017", "Value": "", "_description": "Total construction loans(4+5)_Collateral Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00018", "Value": "", "_description": "Total construction loans(4+5)_Provision Held", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00019", "Value": "", "_description": "Total loans & advance and Bonds_Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00020", "Value": "", "_description": "Total loans & advance and Bonds_Collateral Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "157_00021", "Value": "", "_description": "Total loans & advance and Bonds_Provision Held", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": [
        {
          "Area": 196,
          "_areaName": "Commercial Building Projects",
          "DynamicItems": [
            { "Code": "1.1", "Value": "", "_description": "Name of borrower", "_dataType": "TEXT", "_required": true },
            { "Code": "1.2", "Value": "", "_description": "Loan Type", "_dataType": "TEXT", "_required": false },
            { "Code": "1.3", "Value": "", "_description": "Outstanding balance", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.4", "Value": "", "_description": "Loan status", "_dataType": "TEXT", "_required": false },
            { "Code": "1.5", "Value": "", "_description": "Collateral Type", "_dataType": "TEXT", "_required": false },
            { "Code": "1.6", "Value": "", "_description": "Collateral Value", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.7", "Value": "", "_description": "Provision held", "_dataType": "NUMERIC", "_required": false }
          ]
        },
        {
          "Area": 197,
          "_areaName": "Residential & Real Estate Projects",
          "DynamicItems": [
            { "Code": "1.1", "Value": "", "_description": "Name of borrower", "_dataType": "TEXT", "_required": true },
            { "Code": "1.2", "Value": "", "_description": "Loan Type", "_dataType": "TEXT", "_required": false },
            { "Code": "1.3", "Value": "", "_description": "Outstanding balance", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.4", "Value": "", "_description": "Loan status", "_dataType": "TEXT", "_required": false },
            { "Code": "1.5", "Value": "", "_description": "Collateral Type", "_dataType": "TEXT", "_required": false },
            { "Code": "1.6", "Value": "", "_description": "Collateral Value", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.7", "Value": "", "_description": "Provision held", "_dataType": "NUMERIC", "_required": false }
          ]
        }
      ]
    }, null, 2)
  },
  {
    filename: "INS_LOAN_QR002.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "INS_LOAN_QR002",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "158_00001", "Value": "", "_description": "Sub total (loans to Directors)_Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "158_00002", "Value": "", "_description": "Sub total (loans to Directors)_Security Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "158_00003", "Value": "", "_description": "Sub total (mid- level management and above)_Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "158_00004", "Value": "", "_description": "Sub total (mid- level management and above)_Security Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "158_00005", "Value": "", "_description": "Loans to other staffs_Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "158_00006", "Value": "", "_description": "Loans to other staffs_Security Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "158_00007", "Value": "", "_description": "No. of staff_Security Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "158_00008", "Value": "", "_description": "Sub total_Facility Type", "_dataType": "TEXT", "_required": false },
        { "Code": "158_00009", "Value": "", "_description": "Sub total_Security Value", "_dataType": "NUMERIC", "_required": false },
        { "Code": "158_00010", "Value": "", "_description": "Grand Total_Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
        { "Code": "158_00011", "Value": "", "_description": "Grand Total_Security Value", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": [
        {
          "Area": 198,
          "_areaName": "Loans to Directors",
          "DynamicItems": [
            { "Code": "1.1", "Value": "", "_description": "Director's Name", "_dataType": "TEXT", "_required": true },
            { "Code": "1.2", "Value": "", "_description": "Facility Type", "_dataType": "TEXT", "_required": false },
            { "Code": "1.3", "Value": "", "_description": "Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.4", "Value": "", "_description": "Security Value", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.5", "Value": "", "_description": "Security Type", "_dataType": "TEXT", "_required": false },
            { "Code": "1.6", "Value": "", "_description": "Loan Status", "_dataType": "TEXT", "_required": false }
          ]
        },
        {
          "Area": 199,
          "_areaName": "Loans to Executive Management",
          "DynamicItems": [
            { "Code": "1.1", "Value": "", "_description": "Mid- level manager's name", "_dataType": "TEXT", "_required": true },
            { "Code": "1.2", "Value": "", "_description": "Facility Type", "_dataType": "TEXT", "_required": false },
            { "Code": "1.3", "Value": "", "_description": "Outstanding Balance", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.4", "Value": "", "_description": "Security Value", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.5", "Value": "", "_description": "Security Type", "_dataType": "TEXT", "_required": false },
            { "Code": "1.6", "Value": "", "_description": "Loan Status", "_dataType": "TEXT", "_required": false }
          ]
        }
      ]
    }, null, 2)
  },
  {
    filename: "BD_L&A_BD001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "BD_L&A_BD001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-07-01T00:00:00",
      "EndDate": "2026-07-31T00:00:00",
      "ReturnItemsList": [
        { "Code": "2_00001", "Value": "", "_description": "1-TOTAL LOANS & ADVANCES (sum 2-4)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00002", "Value": "", "_description": "2-SHORT TERM (sum 2.1-2.13)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00003", "Value": "", "_description": "2,1- Agriculture", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00004", "Value": "", "_description": "2,2- Manufacturing", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00005", "Value": "", "_description": "2,3- Domestic trade", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00006", "Value": "", "_description": "2,4- International trade (sum 2.4.1-2.4.2)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00007", "Value": "", "_description": "2.4.1- Export", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00008", "Value": "", "_description": "2.4.2- Import", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00009", "Value": "", "_description": "2,5- Hotel & tourism", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00010", "Value": "", "_description": "2,6- Transport and communication", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00011", "Value": "", "_description": "2,7- Building & construction (sum 2.7.1-2.7.4)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00012", "Value": "", "_description": "2.7.1- Residential building", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00013", "Value": "", "_description": "2.7.2- Commercial building", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00014", "Value": "", "_description": "2.7.3- Real estate", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00015", "Value": "", "_description": "2.7.4- Others", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00016", "Value": "", "_description": "2,8- Mines, power & water resource", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00017", "Value": "", "_description": "2,9-Consumer loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00018", "Value": "", "_description": "2.10- Inter-bank loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00019", "Value": "", "_description": "2,11- Loans to non-bank financial institutions", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00020", "Value": "", "_description": "2,12- Insider loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00021", "Value": "", "_description": "2,13- Other short term loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00022", "Value": "", "_description": "3-MEDIUM TERM (sum 3.1-3.13)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00023", "Value": "", "_description": "3,1- Agriculture", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00024", "Value": "", "_description": "3,2- Manufacturing", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00025", "Value": "", "_description": "3,3- Domestic trade", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00026", "Value": "", "_description": "3,4- International trade (sum 3.4.1-3.4.2)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00027", "Value": "", "_description": "3.4.1- Export", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00028", "Value": "", "_description": "3.4.2- Import", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00029", "Value": "", "_description": "3,5- Hotel & tourism", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00030", "Value": "", "_description": "3,6- Transport and communication", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00031", "Value": "", "_description": "3,7- Building & construction (sum 3.7.1-3.7.4)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00032", "Value": "", "_description": "3.7.1- Residential building", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00033", "Value": "", "_description": "3.7.2-Commercial building", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00034", "Value": "", "_description": "3.7.3-Real estate", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00035", "Value": "", "_description": "3.7.4- Others", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00036", "Value": "", "_description": "3,8- Mines, power & water resource", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00037", "Value": "", "_description": "3,9- Consumer loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00038", "Value": "", "_description": "3.10 - Inter-bank loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00039", "Value": "", "_description": "3,11- Loans to non-bank financial institutions", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00040", "Value": "", "_description": "3,12- Insider loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00041", "Value": "", "_description": "3,13- Other medium term loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00042", "Value": "", "_description": "4-LONG TERM (sum 4.1-4.13)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00043", "Value": "", "_description": "4,1-Agriculture", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00044", "Value": "", "_description": "4,2-Manufacturing", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00045", "Value": "", "_description": "4,3- Domestic trade", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00046", "Value": "", "_description": "4,4-International trade (sum 4.4.1-4.4.2)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00047", "Value": "", "_description": "4.4.1-Export", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00048", "Value": "", "_description": "4.4.2-Import", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00049", "Value": "", "_description": "4,5- Hotel & tourism", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00050", "Value": "", "_description": "4,6-Transport and communication", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00051", "Value": "", "_description": "4,7-Building & construction (sum 4.7.1-4.7.4)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00052", "Value": "", "_description": "4.7.1-Residential building", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00053", "Value": "", "_description": "4.7.2- Commercial building", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00054", "Value": "", "_description": "4.7.3- Real estate", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00055", "Value": "", "_description": "4.7.4-Others", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00056", "Value": "", "_description": "4,8- Mines, power & water resource", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00057", "Value": "", "_description": "4,9-Consumer loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00058", "Value": "", "_description": "4.10 - Inter-bank loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00059", "Value": "", "_description": "4,11- Loans to non-bank financial institutions", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00060", "Value": "", "_description": "4,12-Insider loans", "_dataType": "NUMERIC", "_required": false },
        { "Code": "2_00061", "Value": "", "_description": "4,13- Other long term loans", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "LOA_PORT_EP001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "LOA_PORT_EP001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-07-01T00:00:00",
      "EndDate": "2026-07-31T00:00:00",
      "ReturnItemsList": [
        { "Code": "34_00001", "Value": "", "_description": "Advance on import bills_Disbursement in the month_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00002", "Value": "", "_description": "Advance on import bills_Disbursement in the month_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00003", "Value": "", "_description": "Advance on import bills_Outstanding Loans and Advances_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00004", "Value": "", "_description": "Advance on import bills_ Outstanding Loans and Advances_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00006", "Value": "", "_description": "Pre-shipment export loans_Disbursement in the month_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00007", "Value": "", "_description": "Pre-shipment export loans_Disbursement in the month_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00008", "Value": "", "_description": "Pre-shipment export loans_Outstanding Loans and Advances_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00009", "Value": "", "_description": "Pre-shipment export loans_Outstanding Loans and Advances_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00011", "Value": "", "_description": "Overdraft facilities_Disbursement in the month_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00012", "Value": "", "_description": "Overdraft facilities_Disbursement in the month_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00013", "Value": "", "_description": "Overdraft facilities_Outstanding Loans and Advances_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00014", "Value": "", "_description": "Overdraft facilities_Outstanding Loans and Advances_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00016", "Value": "", "_description": "Merchandise _Disbursement in the Month_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00017", "Value": "", "_description": "Merchandise _Disbursement in the Month_Percentage", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00018", "Value": "", "_description": "Merchandise_Outstanding Loans and Advances_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00019", "Value": "", "_description": "Term Loans_Disbursement in the Month_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00021", "Value": "", "_description": "Other loans_Disbursement in the month_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00022", "Value": "", "_description": "Other loans_Disbursement in the month_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00023", "Value": "", "_description": "Other loans_Outstanding Loans and Advances_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00024", "Value": "", "_description": "Other loans_Outstanding loans and advances_Percentage", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00026", "Value": "", "_description": "Total(sum 1.1-1.5)_Disbursement in the Month_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00027", "Value": "", "_description": "Total(sum 1.1-1.5)_Disbursement in the Month_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00028", "Value": "", "_description": "Total(sum 1.1-1.5)_Outstanding Loans and Advances_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00029", "Value": "", "_description": "Total(sum 1.1-1.5)_Outstanding Loans and Advances_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00031", "Value": "", "_description": "Short term loans_Disbursement in the month_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00032", "Value": "", "_description": "Short term loans_Disbursement in the month_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00033", "Value": "", "_description": "Short term loans_Outstanding Loans and Advances_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00034", "Value": "", "_description": "Short term loans_Outstanding Loans and Advances_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00036", "Value": "", "_description": "Long term loans_Disbursement in the month_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00037", "Value": "", "_description": "Long term loans_Disbursement in the month_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00038", "Value": "", "_description": "Long term loans_Outstanding Loans and Advances_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00039", "Value": "", "_description": "Long term loans_Outstanding Loans and Advances_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00040", "Value": "", "_description": "Term Loans_Outstanding Loans and Advance_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00041", "Value": "", "_description": "Total(sum 2.1-2.2)_Disbursement in the month_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00042", "Value": "", "_description": "Total(sum 2.1-2.2)_Disbursement in the month_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00043", "Value": "", "_description": "Total(sum 2.1-2.2)_Outstanding Loans and Advances_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00044", "Value": "", "_description": "Total(sum 2.1-2.2)_Outstanding Loans and Advances_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00045", "Value": "", "_description": "Term Loans_Outstanding Loans and Advance_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00046", "Value": "", "_description": "Term Loans_Disbursement in the Month_Percentage (%)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "34_00047", "Value": "", "_description": "Merchandise_Outstanding Loans and Advances_Percentage", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "M_LCPLC001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "M_LCPLC001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-07-01T00:00:00",
      "EndDate": "2026-07-31T00:00:00",
      "ReturnItemsList": [
        { "Code": "122_00001", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00002", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Deductible collateral_Cash/cash substitute_(B)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00003", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Deductible collateral_Net recoverable value_(C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00004", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Deductible collateral_Total _(D=B+C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00005", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Deductible collateral_Net loans and advances_(E=A-D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00006", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Provisioning rate_(F)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00007", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00008", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Accumulated provision held_(H)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00009", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Excess/shortfall in provisions_(I=H-G)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00046", "Value": "", "_description": "Special mention (Sum 2.1-2.4)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00049", "Value": "", "_description": "Special mention (Sum 2.1-2.4)_Deductible collateral_Total _(D=B+C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00050", "Value": "", "_description": "Special mention (Sum 2.1-2.4)_Deductible collateral_Net loans and advances_(E=A-D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00052", "Value": "", "_description": "Special mention (Sum 2.1-2.4)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00091", "Value": "", "_description": "Substandard (3.1+3.2)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00094", "Value": "", "_description": "Substandard (3.1+3.2)_Deductible collateral_Total _(D=B+C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00095", "Value": "", "_description": "Substandard (3.1+3.2)_Deductible collateral_Net loans and advances_(E=A-D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00097", "Value": "", "_description": "Substandard (3.1+3.2)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00190", "Value": "", "_description": "Doubtful (Sum 4.1-4.4)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00193", "Value": "", "_description": "Doubtful (Sum 4.1-4.4)_Deductible collateral_Total _(D=B+C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00194", "Value": "", "_description": "Doubtful (Sum 4.1-4.4)_Deductible collateral_Net loans and advances_(E=A-D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00196", "Value": "", "_description": "Doubtful (Sum 4.1-4.4)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00235", "Value": "", "_description": "Loss loans (Sum 5.1-5.4)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00238", "Value": "", "_description": "Loss loans (Sum 5.1-5.4)_Deductible collateral_Total _(D=B+C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00239", "Value": "", "_description": "Loss loans (Sum 5.1-5.4)_Deductible collateral_Net loans and advances_(E=A-D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00241", "Value": "", "_description": "Loss loans (Sum 5.1-5.4)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00280", "Value": "", "_description": "Total (Sum 1-5)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00283", "Value": "", "_description": "Total (Sum 1-5)_Deductible collateral_Total _(D=B+C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00284", "Value": "", "_description": "Total (Sum 1-5)_Deductible collateral_Net loans and advances_(E=A-D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00286", "Value": "", "_description": "Total (Sum 1-5)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00288", "Value": "", "_description": "Total (Sum 1-5)_Excess/shortfall in provisions_(I=H-G)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00289", "Value": "", "_description": "Total Non Performing (Sum 3-5)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00295", "Value": "", "_description": "Total Non Performing (Sum 3-5)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00298", "Value": "", "_description": "NPLs to Total Loans Ratio(7/6)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "122_00307", "Value": "", "_description": "Total_Accumulated provision held", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "LOAN_CLA&PROV_LP001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "LOAN_CLA&PROV_LP001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "21_00001", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00002", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Deductible collateral_Cash/cash substitute_(B)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00003", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Deductible collateral_Net recoverable value_(C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00004", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Deductible collateral_Total _(D=B+C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00005", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Deductible collateral_Net loans and advances_(E=A-D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00006", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Provisioning rate_(F)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00007", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00008", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Accumulated provision held_(H)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00009", "Value": "", "_description": "Pass (Sum 1.1-1.4)_Excess/shortfall in provisions_(I=H-G)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00046", "Value": "", "_description": "Special mention (Sum 2.1-2.4)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00049", "Value": "", "_description": "Special mention (Sum 2.1-2.4)_Deductible collateral_Total _(D=B+C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00050", "Value": "", "_description": "Special mention (Sum 2.1-2.4)_Deductible collateral_Net loans and advances_(E=A-D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00052", "Value": "", "_description": "Special mention (Sum 2.1-2.4)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00091", "Value": "", "_description": "Substandard (3.1+3.2)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00094", "Value": "", "_description": "Substandard (3.1+3.2)_Deductible collateral_Total _(D=B+C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00095", "Value": "", "_description": "Substandard (3.1+3.2)_Deductible collateral_Net loans and advances_(E=A-D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00097", "Value": "", "_description": "Substandard (3.1+3.2)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00190", "Value": "", "_description": "Doubtful (Sum 4.1-4.4)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00193", "Value": "", "_description": "Doubtful (Sum 4.1-4.4)_Deductible collateral_Total _(D=B+C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00194", "Value": "", "_description": "Doubtful (Sum 4.1-4.4)_Deductible collateral_Net loans and advances_(E=A-D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00196", "Value": "", "_description": "Doubtful (Sum 4.1-4.4)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00235", "Value": "", "_description": "Loss loans (Sum 5.1-5.4)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00238", "Value": "", "_description": "Loss loans (Sum 5.1-5.4)_Deductible collateral_Total _(D=B+C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00239", "Value": "", "_description": "Loss loans (Sum 5.1-5.4)_Deductible collateral_Net loans and advances_(E=A-D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00241", "Value": "", "_description": "Loss loans (Sum 5.1-5.4)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00280", "Value": "", "_description": "Total (Sum 1-5)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00283", "Value": "", "_description": "Total (Sum 1-5)_Deductible collateral_Total _(D=B+C)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00284", "Value": "", "_description": "Total (Sum 1-5)_Deductible collateral_Net loans and advances_(E=A-D)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00286", "Value": "", "_description": "Total (Sum 1-5)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00288", "Value": "", "_description": "Total (Sum 1-5)_Excess/shortfall in provisions_(I=H-G)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00289", "Value": "", "_description": "Total Non Performing (Sum 3-5)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00295", "Value": "", "_description": "Total Non Performing (Sum 3-5)_Required provision_(G=ExF)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00298", "Value": "", "_description": "NPLs to Total Loans Ratio(7/6)_Amount (A)", "_dataType": "NUMERIC", "_required": false },
        { "Code": "21_00307", "Value": "", "_description": "Total_Accumulated provision held ", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "BOR_TEN_PER_LB002.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "BOR_TEN_PER_LB002",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-07-01T00:00:00",
      "EndDate": "2026-07-31T00:00:00",
      "ReturnItemsList": [
        ...Array.from({ length: 20 }, (_, i) => ({
          Code: `LB002_${(i + 1).toString().padStart(5, '0')}`,
          Value: "",
          _description: `Name of Counterparty_${20 - i}`,
          _dataType: "NUMERIC",
          _required: true
        })),
        { Code: "LB002_00061", Value: "", _description: "Aggregate _Total Outstanding Balance", _dataType: "NUMERIC", _required: true }
      ],
      "DynamicItemsList": [
        {
          "Area": 226,
          "_areaName": "Monthly Return on Large Exposures List of Counterparties that Exceed Ten Percent of the Bank’s Total Capital ",
          "DynamicItems": [
            { "Code": "1.1", "Value": "", "_description": "Name of Counterparty*", "_dataType": "TEXT", "_required": true },
            { "Code": "1.2", "Value": "", "_description": "Type of Exposure", "_dataType": "TEXT", "_required": true },
            { "Code": "1.3", "Value": "", "_description": "Sector of Exposure", "_dataType": "TEXT", "_required": true },
            { "Code": "1.4", "Value": "", "_description": "Approved Limit/Facility", "_dataType": "NUMERIC", "_required": true },
            { "Code": "1.5", "Value": "", "_description": "Exposure Amount/ Outstanding Balance (on-balance sheet)_ A", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.6", "Value": "", "_description": "Off-balance Sheet Exposure Amount (e.g. guarantee)_ B", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.7", "Value": "", "_description": "Total Outstanding Balance_ C=A+B", "_dataType": "NUMERIC", "_required": true },
            { "Code": "1.8", "Value": "", "_description": "Maturity Date", "_dataType": "DATE", "_required": true },
            { "Code": "1.9", "Value": "", "_description": "Capital", "_dataType": "NUMERIC", "_required": true },
            { "Code": "1.10", "Value": "", "_description": "Exposure Amount (A+B) as Percent of Total Capital", "_dataType": "NUMERIC", "_required": true },
            { "Code": "1.11", "Value": "", "_description": "Status (classification)", "_dataType": "TEXT", "_required": true },
            { "Code": "1.12", "Value": "", "_description": "Collateral_Type", "_dataType": "TEXT", "_required": true },
            { "Code": "1.13", "Value": "", "_description": "Collateral_Estimated/Face value", "_dataType": "NUMERIC", "_required": false }
          ]
        }
      ]
    }, null, 2)
  },
  {
    filename: "BSD_LOAN_PART13002.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "BSD_LOAN_PART13002",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-07-01T00:00:00",
      "EndDate": "2026-07-31T00:00:00",
      "ReturnItemsList": [
        ...Array.from({ length: 20 }, (_, i) => ({
          Code: `13002_${(i + 1).toString().padStart(5, '0')}`,
          Value: "",
          _description: `Name of Counterparty_${20 - i}`,
          _dataType: "NUMERIC",
          _required: true
        })),
        { Code: "13002_00141", Value: "", _description: "Aggregate _Capital", _dataType: "NUMERIC", _required: true },
        { Code: "13002_00142", Value: "", _description: "Aggregate _Total Outstanding Balance", _dataType: "NUMERIC", _required: true }
      ],
      "DynamicItemsList": [
        {
          "Area": 225,
          "_areaName": "Monthly Returns on Related Party Transactions List of Related Party Exposures",
          "DynamicItems": [
            { "Code": "1.1", "Value": "", "_description": "Name of Counterparty*", "_dataType": "TEXT", "_required": true },
            { "Code": "1.2", "Value": "", "_description": "Nature of Counterparty (e.g. influential shareholder, director, subsidiary ….)", "_dataType": "TEXT", "_required": true },
            { "Code": "1.3", "Value": "", "_description": "Type of Exposure", "_dataType": "TEXT", "_required": true },
            { "Code": "1.4", "Value": "", "_description": "Sector of Exposure", "_dataType": "TEXT", "_required": true },
            { "Code": "1.5", "Value": "", "_description": "Approved Limit/Facility", "_dataType": "NUMERIC", "_required": true },
            { "Code": "1.6", "Value": "", "_description": "Exposure Amount/ Outstanding Balance (on-balance sheet)_ A", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.7", "Value": "", "_description": "Off-balance Sheet Exposure Amount (e.g. guarantee)_ B", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.8", "Value": "", "_description": "Total Outstanding Balance_ C=A+B", "_dataType": "NUMERIC", "_required": true },
            { "Code": "1.9", "Value": "", "_description": "Maturity Date", "_dataType": "DATE", "_required": true },
            { "Code": "1.10", "Value": "", "_description": "Capital", "_dataType": "NUMERIC", "_required": true },
            { "Code": "1.11", "Value": "", "_description": "Exposure Amount (A+B) as Percent of Total Capital", "_dataType": "NUMERIC", "_required": true },
            { "Code": "1.12", "Value": "", "_description": "Status (classification)", "_dataType": "TEXT", "_required": true },
            { "Code": "1.13", "Value": "", "_description": "Collateral_Type", "_dataType": "TEXT", "_required": true },
            { "Code": "1.14", "Value": "", "_description": "Collateral_Estimated/Face value", "_dataType": "NUMERIC", "_required": false }
          ]
        }
      ]
    }, null, 2)
  },
  {
    filename: "LOA_ADV_OUT_LA001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "LOA_ADV_OUT_LA001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-07-01T00:00:00",
      "EndDate": "2026-07-31T00:00:00",
      "ReturnItemsList": [
        { "Code": "67_00001", "Value": "", "_description": "Agriculture_Public Enterprise_Disbursement", "_dataType": "NUMERIC", "_required": false },
        { "Code": "67_00002", "Value": "", "_description": "Agriculture_Public Enterprise_Collection", "_dataType": "NUMERIC", "_required": false },
        { "Code": "67_00003", "Value": "", "_description": "Agriculture_Public Enterprise_Outstanding", "_dataType": "NUMERIC", "_required": false },
        { "Code": "67_00010", "Value": "", "_description": "Agriculture_Total_Disbursement", "_dataType": "NUMERIC", "_required": false },
        { "Code": "67_00011", "Value": "", "_description": "Agriculture_Total_Collection", "_dataType": "NUMERIC", "_required": false },
        { "Code": "67_00012", "Value": "", "_description": "Agriculture_Total_Outstanding", "_dataType": "NUMERIC", "_required": false },
        { "Code": "67_00178", "Value": "", "_description": "Total_Total_Disbursement", "_dataType": "NUMERIC", "_required": false },
        { "Code": "67_00179", "Value": "", "_description": "Total_Total_Collection", "_dataType": "NUMERIC", "_required": false },
        { "Code": "67_00180", "Value": "", "_description": "Total_Total_Outstanding", "_dataType": "NUMERIC", "_required": false },
        { "Code": "67_00286", "Value": "", "_description": "Total_Total_Disbursement", "_dataType": "NUMERIC", "_required": false },
        { "Code": "67_00287", "Value": "", "_description": "Total_Total_Collection", "_dataType": "NUMERIC", "_required": false },
        { "Code": "67_00288", "Value": "", "_description": "Total_Total_Outstanding", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "NPL_ECPOMNE001.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "NPL_ECPOMNE001",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "92_00001", "Value": "", "_description": "Agriculture_Substandard Term loan", "_dataType": "NUMERIC", "_required": false },
        { "Code": "92_00007", "Value": "", "_description": "Agriculture_Total", "_dataType": "NUMERIC", "_required": false },
        { "Code": "92_00014", "Value": "", "_description": "Manufacturing_Total", "_dataType": "NUMERIC", "_required": false },
        { "Code": "92_00021", "Value": "", "_description": "Domestic Trade & Service_Total", "_dataType": "NUMERIC", "_required": false },
        { "Code": "92_00112", "Value": "", "_description": "Total (Economic Sector)_Total", "_dataType": "NUMERIC", "_required": false },
        { "Code": "92_00119", "Value": "", "_description": "Total (Branch)_Total", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": [
        {
          "Area": 179,
          "_areaName": "Top 6 Branches NPL",
          "DynamicItems": [
            { "Code": "1.1", "Value": "", "_description": "NPL by Branch (Largest six by Amount)", "_dataType": "TEXT", "_required": true },
            { "Code": "1.2", "Value": "", "_description": "Substandard Term loan", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.3", "Value": "", "_description": "Substandard O/D", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.4", "Value": "", "_description": "Doubtful Term loan", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.5", "Value": "", "_description": "Doubtful O/D", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.6", "Value": "", "_description": "Loss Term loan", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.7", "Value": "", "_description": "Loss O/D", "_dataType": "NUMERIC", "_required": false },
            { "Code": "1.8", "Value": "", "_description": "Total", "_dataType": "NUMERIC", "_required": false }
          ]
        }
      ]
    }, null, 2)
  },
  {
    filename: "LOAN_RAN_REGRL002.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "LOAN_RAN & REGRL002",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-07-01T00:00:00",
      "EndDate": "2026-07-31T00:00:00",
      "ReturnItemsList": [
        { "Code": "RL002_48782", "Value": "", "_description": "Addis Ababa_<= 100,000_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RL002_48783", "Value": "", "_description": "Addis Ababa_ <= 100,000_# of Borrowers", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RL002_48784", "Value": "", "_description": "Addis Ababa_<= 100,000_ # of Accounts ", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RL002_48803", "Value": "", "_description": "Addis Ababa_Total_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RL002_50819", "Value": "", "_description": "Total Amount_Total_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RL002_50820", "Value": "", "_description": "Total Amount_ Total_# of Borrowers", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RL002_50821", "Value": "", "_description": "Total Amount_Total_ # of Accounts ", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "LOAN_RAN_REG_RA002.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "LOAN_RAN&REG_RA002",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "RA002_40622", "Value": "", "_description": "Addis Ababa_<= 100,000_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RA002_40623", "Value": "", "_description": "Addis Ababa_ <= 100,000_# of Borrowers", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RA002_40643", "Value": "", "_description": "Addis Ababa_Total_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RA002_42659", "Value": "", "_description": "Total Amount_Total_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RA002_42660", "Value": "", "_description": "Total Amount_ Total_# of Borrowers", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RA002_42661", "Value": "", "_description": "Total Amount_Total_ # of Accounts ", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "LOAN_SEC_REG_SE002.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "LOAN_SEC&REG_SE002",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-04-01T00:00:00",
      "EndDate": "2026-06-30T00:00:00",
      "ReturnItemsList": [
        { "Code": "SE002_39092", "Value": "", "_description": "Addis Ababa_Public Enterprise_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "SE002_39095", "Value": "", "_description": "Addis Ababa_Private & Coop._Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "SE002_39107", "Value": "", "_description": "Addis Ababa_Total_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "SE002_40619", "Value": "", "_description": "Total Amount_Total_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "SE002_40620", "Value": "", "_description": "Total Amount_Total_ # of Borrowers", "_dataType": "NUMERIC", "_required": false },
        { "Code": "SE002_40621", "Value": "", "_description": "Total Amount_ Total_# of Accounts ", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  },
  {
    filename: "LOAN_SEC_REG_RS002.txt",
    jsonStr: JSON.stringify({
      "ReturnKey": "LOAN_SEC & REGRS002",
      "InstCode": "0000013",
      "FinYear": 2026,
      "StartDate": "2026-07-01T00:00:00",
      "EndDate": "2026-07-31T00:00:00",
      "ReturnItemsList": [
        { "Code": "RS002_50822", "Value": "", "_description": "Addis Ababa_Public Enterprise_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RS002_50825", "Value": "", "_description": "Addis Ababa_Private & Coop._Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RS002_50837", "Value": "", "_description": "Addis Ababa_Total_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RS002_52349", "Value": "", "_description": "Total Amount_Total_Amount", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RS002_52350", "Value": "", "_description": "Total Amount_Total_ # of Borrowers", "_dataType": "NUMERIC", "_required": false },
        { "Code": "RS002_52351", "Value": "", "_description": "Total Amount_ Total_# of Accounts ", "_dataType": "NUMERIC", "_required": false }
      ],
      "DynamicItemsList": []
    }, null, 2)
  }
];

export { reportAssetsRaw };
