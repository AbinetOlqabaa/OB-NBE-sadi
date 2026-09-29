# NBE REPORT SCHEMA & CONTRACT DISCOVERY ANALYSIS

## 1. Global NBE Report Envelope Contract
All supplied report files share a standardized top-level JSON envelope:

```json
{
  "ReturnKey": "string (Unique identifier of the regulatory return)",
  "InstCode": "string (Bank institutional identifier, e.g. '0000013' for Oromia Bank)",
  "FinYear": 2026,
  "StartDate": "YYYY-MM-DDTHH:mm:ss",
  "EndDate": "YYYY-MM-DDTHH:mm:ss",
  "ReturnItemsList": [
    {
      "Code": "string (unique field code within template)",
      "Value": "string | number",
      "_description": "string (human label and calculation formula hints)",
      "_dataType": "NUMERIC | TEXT | DATE",
      "_required": boolean
    }
  ],
  "DynamicItemsList": [
    {
      "Area": number,
      "_areaName": "string",
      "DynamicItems": [
        {
          "Code": "string (column identifier, e.g. 1.1, 1.2)",
          "Value": "string | number",
          "_description": "string",
          "_dataType": "NUMERIC | TEXT | DATE",
          "_required": boolean
        }
      ]
    }
  ]
}
```

## 2. In-Depth Per-Report Analysis
### POBEPE001 - Provision on Off-Balance Sheet Exposure
- **Source File**: `report-assets/POBEPE001.txt`
- **SHA-256**: `a9ce8bd61253d348712b4557c6cb1ca21cc7e102eafee580187b47a7caab1f27`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 42 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - **153_00001**: `153_00010 + 153_00019` (Guarantee Amount = Sum(1.1 + 1.2))
  - **153_00055**: `153_00001 + 153_00028 + 153_00037 + 153_00046` (Total Off Balance = Sum(1-4))
  - **153_00009**: `153_00008 - 153_00007` (Guarantee Provision Excess/Shortfall = Held - Required)
  - **153_00063**: `153_00062 - 153_00061` (Total Provision Excess/Shortfall = Held - Required)
- **Business Validation Rules**:
  - [ERROR] Non-negative amounts: All exposure amounts must be non-negative numbers


### ARLAL001 - Restructured Loans and Advances (Quarterly Return)
- **Source File**: `report-assets/ARLAL001.txt`
- **SHA-256**: `513b9050c8c802a48f68f4b003650a4ce5f933447c1b765f12cdd2d0d01c38d7`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 6 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - **150_00005**: `150_00001 + 150_00003` (Total Number = Previous Quarter + During Quarter)
  - **150_00006**: `150_00002 + 150_00004` (Total Amount = Previous Quarter + During Quarter)
- **Business Validation Rules**:
  - [ERROR] Total Restructured Reconciliation: Total number and amount must equal sum of previous and current quarter additions


### ANARN001 - Loans Re-Categorized from Non-Accrual to Accrual Status
- **Source File**: `report-assets/ANARN001.txt`
- **SHA-256**: `54bc3e9c991562883d72b0d5076b9ea98a8aff47d77dcc0c28357492f48f2c14`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 6 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - **149_00005**: `149_00001 + 149_00003` (Total Number = Previous Quarter + During Quarter)
  - **149_00006**: `149_00002 + 149_00004` (Total Amount = Previous Quarter + During Quarter)
- **Business Validation Rules**:
  - [ERROR] Recategorization Total Check: Total must equal previous quarter balance + current quarter transitions


### DigitalLendingDL001 - Quarterly Digital Lending Activity Return
- **Source File**: `report-assets/DigitalLendingDL001.txt`
- **SHA-256**: `419d07d0ae9bd5f9ea3917e8454c158caf70a3d89c49fa9a4b715cf32e8fa104`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 5 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - Standard field entry
- **Business Validation Rules**:
  - [WARNING] Account to Borrower Ratio: Number of borrower accounts must be greater than or equal to number of borrowers


### NPL&PRO_NL001 - Non-Performing Loans and Provisions Schedule
- **Source File**: `report-assets/NPL&PRO_NL001.txt`
- **SHA-256**: `de71cd46271acfab3ac2b37aa72db27f949a2f6dfa707d68db40cbcd6655abea`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 22 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - **9_00004**: `9_00002 - 9_00003` (Net Substandard = Total - Realizable Security)
  - **9_00005**: `0.20 * (9_00002 - 9_00003)` (Specific provision required (20% of net substandard))
  - **9_00007**: `9_00006 - 9_00005` (Substandard Excess/Shortfall = Held - Required)
  - **9_00011**: `9_00009 - 9_00010` (Net Doubtful = Total - Realizable Security)
  - **9_00012**: `0.50 * (9_00009 - 9_00010)` (Specific provision required (50% of net doubtful))
  - **9_00014**: `9_00013 - 9_00012` (Doubtful Excess/Shortfall = Held - Required)
  - **9_00018**: `9_00016 - 9_00017` (Net Loss = Total - Realizable Security)
  - **9_00019**: `1.00 * (9_00016 - 9_00017)` (Specific provision required (100% of net loss))
  - **9_00021**: `9_00020 - 9_00019` (Loss Excess/Shortfall = Held - Required)
  - **9_00001**: `9_00002 + 9_00009 + 9_00016` (Total NPL = Substandard + Doubtful + Loss)
- **Business Validation Rules**:
  - [ERROR] Provision Percentage Verification: Substandard requires 20%, Doubtful 50%, Loss 100% of net exposure


### M_LCPLC001 - Monthly Loans and Advances Classification and Provisioning
- **Source File**: `report-assets/M_LCPLC001.txt`
- **SHA-256**: `1fd9444147f49efa2777db770cb9d4c0c39452bfebcb557d35af1b7362d73edb`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-07-01 to 2026-07-31)
- **Frequency**: **MONTHLY**
- **ReturnItems Count**: 47 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - **122_00004**: `122_00002 + 122_00003` (Pass D = B + C)
  - **122_00005**: `122_00001 - 122_00004` (Pass E = A - D)
  - **122_00007**: `122_00005 * 0.01` (Pass Required Provision (1%))
  - **122_00009**: `122_00008 - 122_00007` (Pass Excess/Shortfall = H - G)
  - **122_00052**: `122_00050 * 0.03` (Special Mention Required Provision (3%))
  - **122_00097**: `122_00095 * 0.20` (Substandard Required Provision (20%))
  - **122_00196**: `122_00194 * 0.50` (Doubtful Required Provision (50%))
  - **122_00241**: `122_00239 * 1.00` (Loss Required Provision (100%))
  - **122_00280**: `122_00001 + 122_00046 + 122_00091 + 122_00190 + 122_00235` (Total Loans = Pass + Special Mention + Substandard + Doubtful + Loss)
  - **122_00289**: `122_00091 + 122_00190 + 122_00235` (Total NPL = Substandard + Doubtful + Loss)
  - **122_00298**: `(122_00289 / (122_00280 || 1)) * 100` (NPL to Total Loans Ratio %)
- **Business Validation Rules**:
  - [WARNING] NPL Ratio Regulatory Cap: NPL ratio should ideally not exceed 5% regulatory benchmark


### LOAN_CLA&PROV_LP001 - Quarterly Loans and Advances Classification and Provisioning
- **Source File**: `report-assets/LOAN_CLA&PROV_LP001.txt`
- **SHA-256**: `f56328a42fd147fb0bfb6ad4e82bb685eacaa0d69ea06a263be2a0af292dc249`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 34 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - **21_00004**: `21_00002 + 21_00003` (Pass D = B + C)
  - **21_00005**: `21_00001 - 21_00004` (Pass E = A - D)
  - **21_00007**: `21_00005 * 0.01` (Pass Required Provision (1%))
  - **21_00009**: `21_00008 - 21_00007` (Pass Excess/Shortfall = H - G)
  - **21_00052**: `21_00050 * 0.03` (Special Mention Required Provision (3%))
  - **21_00097**: `21_00095 * 0.20` (Substandard Required Provision (20%))
  - **21_00196**: `21_00194 * 0.50` (Doubtful Required Provision (50%))
  - **21_00241**: `21_00239 * 1.00` (Loss Required Provision (100%))
  - **21_00280**: `21_00001 + 21_00046 + 21_00091 + 21_00190 + 21_00235` (Total Loans = Pass + Special Mention + Substandard + Doubtful + Loss)
  - **21_00289**: `21_00091 + 21_00190 + 21_00235` (Total NPL = Substandard + Doubtful + Loss)
  - **21_00298**: `(21_00289 / (21_00280 || 1)) * 100` (NPL to Total Loans Ratio %)
- **Business Validation Rules**:
  - [WARNING] Quarterly NPL Ratio Threshold: NPL ratio should remain below 5% prudential threshold


### TOP_20_BOR_TB001 - Top 20 Borrowers Exposure Return
- **Source File**: `report-assets/TOP_20_BOR_TB001.txt`
- **SHA-256**: `cd4cb62b1e52c61e72d38dc25a84f2920f8501609126676ad936ea3ddabf7b4a`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 28 items
- **Dynamic Areas**: Area 188: Top 20 Borrowers Detailed Schedule (10 columns)
- **Discovered Formulas**:
  - **14_00023**: `14_00021 + 14_00022` (Top 10 Total Exposure = Outstanding + Off-balance)
  - **14_00027**: `14_00025 + 14_00026` (Top 20 Total Exposure = Outstanding + Off-balance)
- **Business Validation Rules**:
  - [WARNING] Single Borrower Limit (25% Capital): No single borrower total exposure should exceed 25% of bank total capital


### TOP_20_NPLs_TN001 - Top 20 Non-Performing Loans Return
- **Source File**: `report-assets/TOP_20_NPLs_TN001.txt`
- **SHA-256**: `8e5a13876973560a4cfb8e3a1813ae1e2c2cd050b5c3b21d578f26388b9e8c7a`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 8 items
- **Dynamic Areas**: Area 171: Top 20 NPLs Itemized Schedule (7 columns)
- **Discovered Formulas**:
  - Standard field entry
- **Business Validation Rules**:
  - [ERROR] Valid NPL Status Required: Loan status must be Substandard, Doubtful, or Loss


### BOR_TEN_PER_LB002 - Large Exposures Exceeding 10% Capital (Monthly)
- **Source File**: `report-assets/BOR_TEN_PER_LB002.txt`
- **SHA-256**: `4dce89b39b0d84f17e4fbb48c6f6ebab80442b494b651332f1cd7179f109d062`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-07-01 to 2026-07-31)
- **Frequency**: **MONTHLY**
- **ReturnItems Count**: 21 items
- **Dynamic Areas**: Area 226: Large Exposures Register (13 columns)
- **Discovered Formulas**:
  - Standard field entry
- **Business Validation Rules**:
  - [WARNING] 10% Capital Threshold Verification: Every counterparty in this schedule must have exposure >= 10% of total capital


### BSD_LOAN_PART13002 - Related Party Exposures & Transactions (Monthly)
- **Source File**: `report-assets/BSD_LOAN_PART13002.txt`
- **SHA-256**: `08c4b6200744884c036d6f2174a1da075c65edc0a4f4a1ffb5dbd882ecfe4a21`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-07-01 to 2026-07-31)
- **Frequency**: **MONTHLY**
- **ReturnItems Count**: 22 items
- **Dynamic Areas**: Area 225: Related Party Transaction Register (14 columns)
- **Discovered Formulas**:
  - Standard field entry
- **Business Validation Rules**:
  - [ERROR] Aggregate Related Party Limit: Total related party exposure must not exceed regulatory aggregate limit (e.g. 15% / 35% of capital)


### INS_LOAN_QR002 - Insider Loans and Credit Facilities Return
- **Source File**: `report-assets/INS_LOAN_QR002.txt`
- **SHA-256**: `2c5da9b48992d13f2133eb42a167bf4b988ff3a2cc495f16bb858fd7dcaca3d5`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 9 items
- **Dynamic Areas**: Area 198: Directors Loans Schedule (6 columns), Area 199: Management Loans Schedule (6 columns)
- **Discovered Formulas**:
  - **158_00010**: `158_00001 + 158_00003 + 158_00005` (Grand Total Outstanding = Directors + Managers + Staff)
  - **158_00011**: `158_00002 + 158_00004 + 158_00006` (Grand Total Security = Directors + Managers + Staff)
- **Business Validation Rules**:
  - [ERROR] Board Approval Compliance: All director and executive loans must be fully collateralized and board-approved


### BUIL_CONSTXW002 - Building and Construction Sector Lending Return
- **Source File**: `report-assets/BUIL_CONSTXW002.txt`
- **SHA-256**: `fe5bfd46dbd9084b9e2bef0a445928dca345508a4d7f1827c253ea89da6336da`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 21 items
- **Dynamic Areas**: Area 196: Commercial Construction Projects (7 columns)
- **Discovered Formulas**:
  - **157_00010**: `157_00001 + 157_00004 + 157_00007` (Sub Grand Total = Real Estate + Commercial + Residential)
  - **157_00016**: `157_00010 + 157_00013` (Total Construction Loans = Sub Grand Total + Other Construction)
- **Business Validation Rules**:
  - [ERROR] Construction Totals Reconciliation: Total construction loans must equal sum of subsectors


### BD_L&A_BD001 - Breakdown of Loans & Advances by Economic Sector & Maturity (Monthly)
- **Source File**: `report-assets/BD_L&A_BD001.txt`
- **SHA-256**: `2f70174890f15e9767e5ca40e57f33559117dbe99d36f4ed888e389663b1b786`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-07-01 to 2026-07-31)
- **Frequency**: **MONTHLY**
- **ReturnItems Count**: 13 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - **2_00001**: `2_00002 + 2_00022 + 2_00042` (Total Loans & Advances = Short Term + Medium Term + Long Term)
- **Business Validation Rules**:
  - [ERROR] Total Loans Maturity Reconciliation: Sum of short, medium, and long term must equal total loans and advances


### COL_SOL_18M_LL001 - Foreclosed Collateral Properties Sold within 18 Months
- **Source File**: `report-assets/COL_SOL_18M_LL001.txt`
- **SHA-256**: `1b3a64ddaedf4f7175ca5c6b12264c0545732377878837438232cd45306b19aa`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 5 items
- **Dynamic Areas**: Area 187: Foreclosed Properties Auctioned / Sold (9 columns)
- **Discovered Formulas**:
  - **94_00004**: `94_00002 - 94_00003` (Net Realized Value = Sales Value - Expenses)
- **Business Validation Rules**:
  - [ERROR] Disposal Net Realized Formula: Net realized value cannot exceed gross sales value


### COL_ACQ_18M_OL001 - Collateral Acquired through Foreclosure within 18 Months
- **Source File**: `report-assets/COL_ACQ_18M_OL001.txt`
- **SHA-256**: `1056a0866a5ff4f7feec9631e14187792aafe3bf4a7398f973fb344180962502`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 7 items
- **Dynamic Areas**: Area 172: Acquired Properties Inventory (11 columns)
- **Discovered Formulas**:
  - **95_00005**: `(95_00003 + 95_00004) / 2` (Average Market Value = (Reserve + Highest Bid) / 2)
  - **95_00007**: `95_00005 - 95_00006` (Net Market Value = Average Market Value - Expenses)
- **Business Validation Rules**:
  - [ERROR] Market Value Non-Negative: Net market value must be positive or zero


### RLAFCRC001 - Restructured Loans After Concessions / Restructuring (Quarterly)
- **Source File**: `report-assets/RLAFCRC001.txt`
- **SHA-256**: `9caf15c073d2cfdc29893d42017e2b00e50edb3009bbac6c02b5382177b91a30`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 4 items
- **Dynamic Areas**: Area 195: Counterparties with Concessions (1 columns)
- **Discovered Formulas**:
  - Standard field entry
- **Business Validation Rules**:
  - [ERROR] Original Amount Positive: Original amount must exceed zero


### LOA_ADV_OUT_LA001 - Loans & Advances Disbursement, Collection and Outstanding Outturn (Monthly)
- **Source File**: `report-assets/LOA_ADV_OUT_LA001.txt`
- **SHA-256**: `b819626a48ff7cfbada1cabf4cb0cba047ce256e1f657002b7a03d494151e371`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-07-01 to 2026-07-31)
- **Frequency**: **MONTHLY**
- **ReturnItems Count**: 18 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - **67_00286**: `67_00010 + 67_00022 + 67_00034` (Disbursement Sum Check)
- **Business Validation Rules**:
  - [ERROR] Disbursement Reconciliation: Disbursement and collection figures must be positive numbers


### NPL_ECPOMNE001 - NPL by Economic Sector and Top 6 Branches
- **Source File**: `report-assets/NPL_ECPOMNE001.txt`
- **SHA-256**: `f4303af524d83000c1146689c158ac8520e69660d334d7d177cf9e14eb094f32`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 8 items
- **Dynamic Areas**: Area 179: Top 6 Branches by NPL (8 columns)
- **Discovered Formulas**:
  - **92_00112**: `92_00007 + 92_00014 + 92_00021` (Economic Sector Total NPL = Sum of Sectors)
- **Business Validation Rules**:
  - [WARNING] Sector vs Branch Total Concordance: Total NPL by Economic Sector should equal Total NPL across all Branches


### LOA_PORT_EP001 - Loan Portfolio by Facility Type and Maturity (Monthly)
- **Source File**: `report-assets/LOA_PORT_EP001.txt`
- **SHA-256**: `0c6506041888dced5b95c67aa4da0b692c25e8ebd9f5557f1151377acfd367ca`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-07-01 to 2026-07-31)
- **Frequency**: **MONTHLY**
- **ReturnItems Count**: 14 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - **34_00026**: `34_00001 + 34_00006 + 34_00011 + 34_00016 + 34_00019` (Total Disbursement = Sum(Facilities))
  - **34_00028**: `34_00003 + 34_00008 + 34_00013 + 34_00018 + 34_00045` (Total Outstanding = Sum(Facilities))
- **Business Validation Rules**:
  - [ERROR] Portfolio Total Reconciliation: Total outstanding must match sum of individual loan facilities


### LOAN_RAN & REGRL002 - Loan Portfolio by Size Range and Region (Monthly - RL002)
- **Source File**: `report-assets/LOAN_RAN & REGRL002.txt`
- **SHA-256**: `763bd8aa3a27c48b6ffc40a4b1eba3fdc93595262c444bf40151881b9a010fc7`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-07-01 to 2026-07-31)
- **Frequency**: **MONTHLY**
- **ReturnItems Count**: 9 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - Standard field entry
- **Business Validation Rules**:
  - [ERROR] Borrower Accounts >= Borrowers: Total accounts must be >= total borrowers


### LOAN_RAN&REG_RA002 - Loan Portfolio by Size Range and Region (Quarterly - RA002)
- **Source File**: `report-assets/LOAN_RAN&REG_RA002.txt`
- **SHA-256**: `176b7307f185aee89e8171ad69555c38801a9b115a12bfc7507f20712449a0f2`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 6 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - Standard field entry
- **Business Validation Rules**:
  - [ERROR] Regional Totals Equal Grand Total: Grand total amount must equal sum of regional totals


### LOAN_SEC&REG_SE002 - Loans by Economic Sector & Region (Quarterly - SE002)
- **Source File**: `report-assets/LOAN_SEC&REG_SE002.txt`
- **SHA-256**: `9975137c7003ff2bca5287524cd062536063d2c09f7c1fca7138d61838142514`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-04-01 to 2026-06-30)
- **Frequency**: **QUARTERLY**
- **ReturnItems Count**: 6 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - Standard field entry
- **Business Validation Rules**:
  - [ERROR] Sector-Region Grand Total: Grand total must equal sum of all regional sector breakdowns


### LOAN_SEC & REGRS002 - Loans by Economic Sector & Region (Monthly - RS002)
- **Source File**: `report-assets/LOAN_SEC & REGRS002.txt`
- **SHA-256**: `d14ab63dd614e90b7cc067be294c0ece1082ec67f019c60eb9b5f0bb0dfa005e`
- **Institution Code**: `0000013` (Oromia Bank)
- **Financial Year / Period**: 2026 (2026-07-01 to 2026-07-31)
- **Frequency**: **MONTHLY**
- **ReturnItems Count**: 6 items
- **Dynamic Areas**: None (Fixed Structure)
- **Discovered Formulas**:
  - Standard field entry
- **Business Validation Rules**:
  - [ERROR] Monthly Sector Region Consistency: Sector totals must reconcile with total outstanding bank assets

