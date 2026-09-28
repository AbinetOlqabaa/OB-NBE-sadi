/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TemporalEntity {
  valid_from: string;
  valid_to: string | null;
}

export interface SSOTCustomer extends TemporalEntity {
  customerId: string;
  nationalId: string;
  legalName: string;
  customerType: "INDIVIDUAL" | "CORPORATE" | "COOPERATIVE" | "PUBLIC_ENTERPRISE";
  economicSector: string;
  region: string;
  isRelatedParty: boolean;
  relatedPartyType?: string;
  creditRating?: string;
}

export interface SSOTAccount extends TemporalEntity {
  accountNumber: string;
  customerId: string;
  accountType: "TERM_LOAN" | "OVERDRAFT" | "MERCHANDISE" | "IMPORT_LETTER_OF_CREDIT" | "EXPORT_BILL" | "DEMAND_DEPOSIT";
  currency: string;
  principalBalance: number;
  accruedInterest: number;
  approvedLimit: number;
  disbursedAmount: number;
  collectedAmount: number;
  classificationStatus: "PASS" | "SPECIAL_MENTION" | "SUBSTANDARD" | "DOUBTFUL" | "LOSS";
  isNonAccrual: boolean;
  originationDate: string;
  maturityDate: string;
  branchCode: string;
}

export interface SSOTCollateral extends TemporalEntity {
  collateralId: string;
  accountNumber: string;
  collateralType: "CASH_EQUIVALENT" | "BUILDING_COMMERCIAL" | "BUILDING_RESIDENTIAL" | "LAND" | "VEHICLE" | "MERCHANDISE" | "COUNTER_GUARANTEE";
  faceValue: number;
  netRecoverableValue: number;
  valuationDate: string;
  isForeclosed: boolean;
  foreclosureDate?: string;
}

export interface SSOTGeneralLedger extends TemporalEntity {
  glAccountCode: string;
  glAccountName: string;
  glCategory: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE" | "OFF_BALANCE";
  balance: number;
  reportingDate: string;
}

export interface IngestionJob {
  id: string;
  source: "CORE_BANKING" | "ERP" | "TREASURY" | "LOAN_ORIGINATION" | "TRADE_FINANCE" | "DIGITAL_PAYMENTS";
  startTime: string;
  endTime?: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  recordsIngested: number;
  bronzeRecords: number;
  silverRecords: number;
  goldAggregates: number;
  qualityScore: number;
  reconciliationStatus: "BALANCED" | "VARIANCE_DETECTED";
  varianceAmount?: number;
}
