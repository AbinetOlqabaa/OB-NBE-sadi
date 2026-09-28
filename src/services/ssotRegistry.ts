/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SSOTCustomer,
  SSOTAccount,
  SSOTCollateral,
  SSOTGeneralLedger,
  IngestionJob,
} from '../types/ssot.ts';

class SSOTRegistryClass {
  private customers: SSOTCustomer[] = [];
  private accounts: SSOTAccount[] = [];
  private collaterals: SSOTCollateral[] = [];
  private glAccounts: SSOTGeneralLedger[] = [];
  private ingestionHistory: IngestionJob[] = [];

  constructor() {
    this.seedSSOTData();
  }

  private seedSSOTData(): void {
    const now = '2026-07-01T00:00:00';

    // Seed Core Customers
    this.customers = [
      {
        customerId: 'CUST-001',
        nationalId: 'TIN-1002345',
        legalName: 'Ethio Cement SC',
        customerType: 'CORPORATE',
        economicSector: 'Manufacturing',
        region: 'Oromia',
        isRelatedParty: false,
        creditRating: 'A',
        valid_from: now,
        valid_to: null,
      },
      {
        customerId: 'CUST-002',
        nationalId: 'TIN-1002891',
        legalName: 'Oromia Coffee Farmers Union',
        customerType: 'COOPERATIVE',
        economicSector: 'Agriculture',
        region: 'Oromia',
        isRelatedParty: false,
        creditRating: 'AA',
        valid_from: now,
        valid_to: null,
      },
      {
        customerId: 'CUST-003',
        nationalId: 'TIN-1003412',
        legalName: 'Muger Energy PLC',
        customerType: 'CORPORATE',
        economicSector: 'Mines, power & water resource',
        region: 'Addis Ababa',
        isRelatedParty: true,
        relatedPartyType: 'Influential Shareholder (12%)',
        creditRating: 'BBB',
        valid_from: now,
        valid_to: null,
      },
      {
        customerId: 'CUST-004',
        nationalId: 'TIN-1004990',
        legalName: 'Rift Valley Trading Enterprise',
        customerType: 'CORPORATE',
        economicSector: 'Domestic trade',
        region: 'Sidama',
        isRelatedParty: false,
        valid_from: now,
        valid_to: null,
      },
      {
        customerId: 'CUST-005',
        nationalId: 'TIN-1005882',
        legalName: 'Bole Residential Construction Ltd',
        customerType: 'CORPORATE',
        economicSector: 'Building & construction',
        region: 'Addis Ababa',
        isRelatedParty: false,
        valid_from: now,
        valid_to: null,
      },
    ];

    // Seed Accounts
    this.accounts = [
      {
        accountNumber: 'ACC-LN-10101',
        customerId: 'CUST-001',
        accountType: 'TERM_LOAN',
        currency: 'ETB',
        principalBalance: 850000000,
        accruedInterest: 12500000,
        approvedLimit: 900000000,
        disbursedAmount: 900000000,
        collectedAmount: 50000000,
        classificationStatus: 'PASS',
        isNonAccrual: false,
        originationDate: '2024-01-15T00:00:00',
        maturityDate: '2029-01-15T00:00:00',
        branchCode: 'BR-001-FINFINNE',
        valid_from: now,
        valid_to: null,
      },
      {
        accountNumber: 'ACC-OD-20202',
        customerId: 'CUST-002',
        accountType: 'OVERDRAFT',
        currency: 'ETB',
        principalBalance: 750000000,
        accruedInterest: 8400000,
        approvedLimit: 800000000,
        disbursedAmount: 800000000,
        collectedAmount: 50000000,
        classificationStatus: 'PASS',
        isNonAccrual: false,
        originationDate: '2025-03-01T00:00:00',
        maturityDate: '2027-03-01T00:00:00',
        branchCode: 'BR-002-ADAMA',
        valid_from: now,
        valid_to: null,
      },
      {
        accountNumber: 'ACC-LN-30303',
        customerId: 'CUST-003',
        accountType: 'TERM_LOAN',
        currency: 'ETB',
        principalBalance: 650000000,
        accruedInterest: 18000000,
        approvedLimit: 700000000,
        disbursedAmount: 700000000,
        collectedAmount: 50000000,
        classificationStatus: 'SPECIAL_MENTION',
        isNonAccrual: false,
        originationDate: '2023-06-10T00:00:00',
        maturityDate: '2028-06-10T00:00:00',
        branchCode: 'BR-001-FINFINNE',
        valid_from: now,
        valid_to: null,
      },
      {
        accountNumber: 'ACC-MC-40404',
        customerId: 'CUST-004',
        accountType: 'MERCHANDISE',
        currency: 'ETB',
        principalBalance: 240000000,
        accruedInterest: 9500000,
        approvedLimit: 300000000,
        disbursedAmount: 300000000,
        collectedAmount: 60000000,
        classificationStatus: 'SUBSTANDARD',
        isNonAccrual: true,
        originationDate: '2022-09-01T00:00:00',
        maturityDate: '2026-09-01T00:00:00',
        branchCode: 'BR-003-HAWASSA',
        valid_from: now,
        valid_to: null,
      },
      {
        accountNumber: 'ACC-BL-50505',
        customerId: 'CUST-005',
        accountType: 'TERM_LOAN',
        currency: 'ETB',
        principalBalance: 420000000,
        accruedInterest: 22000000,
        approvedLimit: 500000000,
        disbursedAmount: 500000000,
        collectedAmount: 80000000,
        classificationStatus: 'DOUBTFUL',
        isNonAccrual: true,
        originationDate: '2021-11-20T00:00:00',
        maturityDate: '2026-11-20T00:00:00',
        branchCode: 'BR-001-FINFINNE',
        valid_from: now,
        valid_to: null,
      },
    ];

    // Seed Collaterals
    this.collaterals = [
      {
        collateralId: 'COL-001',
        accountNumber: 'ACC-LN-10101',
        collateralType: 'BUILDING_COMMERCIAL',
        faceValue: 1200000000,
        netRecoverableValue: 960000000,
        valuationDate: '2025-12-10T00:00:00',
        isForeclosed: false,
        valid_from: now,
        valid_to: null,
      },
      {
        collateralId: 'COL-002',
        accountNumber: 'ACC-OD-20202',
        collateralType: 'MERCHANDISE',
        faceValue: 950000000,
        netRecoverableValue: 760000000,
        valuationDate: '2026-02-15T00:00:00',
        isForeclosed: false,
        valid_from: now,
        valid_to: null,
      },
      {
        collateralId: 'COL-003',
        accountNumber: 'ACC-MC-40404',
        collateralType: 'CASH_EQUIVALENT',
        faceValue: 80000000,
        netRecoverableValue: 80000000,
        valuationDate: '2026-01-05T00:00:00',
        isForeclosed: false,
        valid_from: now,
        valid_to: null,
      },
    ];

    // Seed General Ledger
    this.glAccounts = [
      {
        glAccountCode: 'GL-1100-LOANS',
        glAccountName: 'Total Gross Loans & Advances to Customers',
        glCategory: 'ASSET',
        balance: 36050000000,
        reportingDate: '2026-07-31T00:00:00',
        valid_from: now,
        valid_to: null,
      },
      {
        glAccountCode: 'GL-1150-PROV',
        glAccountName: 'Accumulated Allowance for Loan Impairment',
        glCategory: 'ASSET',
        balance: 1485000000,
        reportingDate: '2026-07-31T00:00:00',
        valid_from: now,
        valid_to: null,
      },
      {
        glAccountCode: 'GL-3100-CAPITAL',
        glAccountName: 'Paid-Up Common Share Capital',
        glCategory: 'EQUITY',
        balance: 14000000000,
        reportingDate: '2026-07-31T00:00:00',
        valid_from: now,
        valid_to: null,
      },
      {
        glAccountCode: 'GL-9100-OFFBAL',
        glAccountName: 'Total Guarantees and Standby L/Cs Issued',
        glCategory: 'OFF_BALANCE',
        balance: 1050000000,
        reportingDate: '2026-07-31T00:00:00',
        valid_from: now,
        valid_to: null,
      },
    ];

    // Initial completed ingestion job
    this.ingestionHistory = [
      {
        id: 'job_ingest_001',
        source: 'CORE_BANKING',
        startTime: '2026-07-01T04:00:00Z',
        endTime: '2026-07-01T04:03:12Z',
        status: 'COMPLETED',
        recordsIngested: 148920,
        bronzeRecords: 148920,
        silverRecords: 148850,
        goldAggregates: 24,
        qualityScore: 99.4,
        reconciliationStatus: 'BALANCED',
        varianceAmount: 0,
      },
    ];
  }

  public getCustomers(): SSOTCustomer[] {
    return [...this.customers];
  }

  public getAccounts(): SSOTAccount[] {
    return [...this.accounts];
  }

  public getCollaterals(): SSOTCollateral[] {
    return [...this.collaterals];
  }

  public getGLAccounts(): SSOTGeneralLedger[] {
    return [...this.glAccounts];
  }

  public getIngestionHistory(): IngestionJob[] {
    return [...this.ingestionHistory];
  }

  public addIngestionJob(job: IngestionJob): void {
    this.ingestionHistory.unshift(job);
  }
}

export const ssotRegistry = new SSOTRegistryClass();
