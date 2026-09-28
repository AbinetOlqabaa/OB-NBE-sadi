import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface ReturnItem {
  Code: string;
  Value: string | number;
  _description: string;
  _dataType: "NUMERIC" | "TEXT" | "DATE";
  _required: boolean;
}

interface DynamicItem {
  Code: string;
  Value: string | number;
  _description: string;
  _dataType: "NUMERIC" | "TEXT" | "DATE";
  _required: boolean;
}

interface DynamicArea {
  Area: number;
  _areaName: string;
  DynamicItems: DynamicItem[];
}

export interface ReportDefinition {
  ReturnKey: string;
  InstCode: string;
  FinYear: number;
  StartDate: string;
  EndDate: string;
  Frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  Category: string;
  Title: string;
  ReturnItemsList: ReturnItem[];
  DynamicItemsList: DynamicArea[];
  Formulas?: Array<{ targetCode: string; formula: string; description: string }>;
  ValidationRules?: Array<{ rule: string; description: string; severity: "ERROR" | "WARNING" }>;
  SourceFilename: string;
  SourceHash: string;
}

// Ensure folders exist
const reportAssetsDir = path.resolve(process.cwd(), 'report-assets');
const dataDefsDir = path.resolve(process.cwd(), 'data/report-definitions');
const aiDir = path.resolve(process.cwd(), '.ai');

if (!fs.existsSync(reportAssetsDir)) fs.mkdirSync(reportAssetsDir, { recursive: true });
if (!fs.existsSync(dataDefsDir)) fs.mkdirSync(dataDefsDir, { recursive: true });
if (!fs.existsSync(aiDir)) fs.mkdirSync(aiDir, { recursive: true });

console.log("Ingestion directories ready.");
