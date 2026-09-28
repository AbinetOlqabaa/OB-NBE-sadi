# OROMIA BANK DEPARTMENT CATALOG & ORGANIZATIONAL HIERARCHY
**Institution**: Oromia Bank S.C. (InstCode: `0000013`)  
**Status**: CONFIRMED & INFERRED per Authoritative NBE Directives & Bank Organization  
**Version**: 1.0.0  

---

## 1. Department Catalog Table

| ID | Department Name | Short Code | Parent Division | Primary Responsibilities | Mapped Return Keys | Source / Confidence |
|---|---|---|---|---|---|---|
| `dept_credit_ops` | Credit Operations & Portfolio Management | `COPM` | Credit Business & Operations Division | Credit disbursements, ongoing credit facility tracking, maturity profiling, size range and economic sector distributions | `LOA_ADV_OUT_LA001`, `LOA_PORT_EP001`, `LOAN_RAN___REGRL002`, `LOAN_RAN_REG_RA002`, `LOAN_SEC___REGRS002`, `LOAN_SEC_REG_SE002`, `BD_L_A_BD001`, `BUIL_CONSTXW002` | CONFIRMED |
| `dept_asset_recovery` | Specialized Asset Recovery & Workout | `SARW` | Credit Business & Operations Division | Distressed debt recovery, foreclosure auctions (18 months rule), restructured loans, non-accrual reclassifications, Top 20 NPLs | `COL_ACQ_18M_OL001`, `COL_SOL_18M_LL001`, `ARLAL001`, `RLAFCRC001`, `ANARN001`, `TOP_20_NPLs_TN001`, `NPL_ECPOMNE001` | CONFIRMED |
| `dept_credit_risk` | Credit Risk & Prudential Reporting | `CRPR` | Enterprise Risk & Governance Division | NBE statutory loan classification (Pass, Special Mention, Substandard, Doubtful, Loss), single-borrower limits (>10% capital), insider credits, related parties | `M_LCPLC001`, `LOAN_CLA_PROV_LP001`, `NPL_PRO_NL001`, `BOR_TEN_PER_LB002`, `TOP_20_BOR_TB001`, `BSD_LOAN_PART13002`, `INS_LOAN_QR002` | CONFIRMED |
| `dept_trade_services` | Trade Services & International Banking | `TSIB` | International Banking & Treasury Division | Off-balance sheet contingent liabilities, letters of credit (LC), trade performance guarantees, bid bonds, foreign counter-guarantees | `POBEPE001` | CONFIRMED |
| `dept_digital_banking` | Digital Banking & Fintech Operations | `DBFO` | Digital Transformation & Retail Division | Automated digital micro-lending, instant mobile credit lines, digital agent lending, credit scoring velocity | `DigitalLendingDL001` | CONFIRMED |
| `dept_internal_audit` | Internal Audit & Regulatory Control | `IARC` | Independent Assurance & Supervisory Directorate | Independent four-eyes verification of submitted returns, traceability inspection, NBE compliance audit | Cross-department inspection | CONFIRMED |
| `dept_finance_treasury` | Finance, Treasury & ALM | `FTALM` | Finance & Accounts Division | General ledger reconciliation, statutory reserve requirements, asset-liability management, liquidity ratios | Central financial GL reconciliation | CONFIRMED |
| `dept_compliance_governance` | Compliance & Legal Governance | `CLG` | Legal & Regulatory Compliance Directorate | Central regulatory liaison with NBE, compliance policy enforcement, user access administration, reporting calendar | System Administration & Special Access Grants | CONFIRMED |

---

## 2. Department Mapping Principles
1. **Immutable IDs**: All database records and user assignments use internal immutable department IDs (e.g. `dept_credit_ops`) rather than display strings.
2. **Department Isolation**: Makers can ONLY create and fill reports assigned to their home department unless an explicit, audited Special Access Grant is active.
3. **Four-Eyes Verification**: Checkers can ONLY review submissions originating within their home department, or where explicit administrative cross-department review access is granted.
