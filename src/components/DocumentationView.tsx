/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  Shield,
  Layers,
  Database,
  Send,
  BookOpen,
  CheckCircle2,
  Code,
  Lock,
  Search,
  Building2,
} from 'lucide-react';
import { ReportMetadata } from '../types/regulatory';
import { Pagination } from './Pagination';

interface DocumentationViewProps {
  templates: ReportMetadata[];
}

export const DocumentationView: React.FC<DocumentationViewProps> = ({ templates }) => {
  const [docTab, setDocTab] = useState<'OVERVIEW' | 'CATALOG' | 'SPECS' | 'WORKFLOW'>('OVERVIEW');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPageSize, setCatalogPageSize] = useState(6);
  const [catalogCategory, setCatalogCategory] = useState<string>('ALL');
  const [catalogFrequency, setCatalogFrequency] = useState<string>('ALL');

  const categories = ['ALL', ...Array.from(new Set(templates.map((t) => t.Category || 'General')))];

  const filteredCatalog = templates.filter((t) => {
    const matchesSearch =
      !catalogSearch ||
      t.Code.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      t.Title.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      t.Category.toLowerCase().includes(catalogSearch.toLowerCase());

    const matchesCategory = catalogCategory === 'ALL' || t.Category === catalogCategory;
    const matchesFreq = catalogFrequency === 'ALL' || t.Frequency === catalogFrequency;

    return matchesSearch && matchesCategory && matchesFreq;
  });

  const paginatedCatalog = filteredCatalog.slice(
    (catalogPage - 1) * catalogPageSize,
    catalogPage * catalogPageSize
  );

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-2.5 font-sans">
      {/* 1. Header (Compact, Fixed Height) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 bg-red-100 dark:bg-red-950/60 rounded-lg text-red-700 dark:text-red-400">
              <BookOpen className="w-3.5 h-3.5" />
            </span>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Oromia Bank NBE Platform Architecture & Specifications
            </h2>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30">
              24 Returns
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Technical directives, 4-eyes Maker-Checker segregation, idempotency gateway specifications, and catalog.
          </p>
        </div>

        {/* Tab Selection Buttons */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
          {(['OVERVIEW', 'CATALOG', 'WORKFLOW', 'SPECS'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setDocTab(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                docTab === tab
                  ? 'bg-ob-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              {tab === 'OVERVIEW'
                ? 'Overview'
                : tab === 'CATALOG'
                ? `Catalog (${templates.length})`
                : tab === 'WORKFLOW'
                ? 'Maker-Checker'
                : 'API Specs'}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Scrollable Content Area (Strict flex-1 min-h-0 overflow-hidden) */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
        {docTab === 'OVERVIEW' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 text-xs">
            <div className="bg-ob-indigo-50/70 dark:bg-ob-indigo-950/40 border border-ob-indigo-200 dark:border-ob-indigo-800/60 rounded-xl p-4">
              <h3 className="text-sm font-bold text-ob-indigo-950 dark:text-ob-indigo-200 mb-1">
                Executive Purpose & Compliance Scope
              </h3>
              <p className="text-ob-indigo-900/80 dark:text-ob-indigo-300/80 leading-relaxed text-xs">
                This platform provides an end-to-end regulatory intake, validation, simulation, and 4-eyes governance system for Oromia Bank S.C. (Institution Code: 0000013) to report official regulatory returns to the National Bank of Ethiopia (NBE) in strict conformance with directive BSD/03/2020.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-xs mb-1 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
                  <span>Role-Based Governance</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Administrator, Maker, and Checker have separate dashboards. Registrations are vetted by the Administrator before activation.
                </p>
              </div>

              <div className="p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-xs mb-1 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-ob-green-600 dark:text-ob-green-400" />
                  <span>24 Official Returns</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  100% schema completeness across Monthly, Quarterly, and Annual returns with dynamic roster schedules and real-time formula evaluation.
                </p>
              </div>

              <div className="p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-xs mb-1 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Idempotent Gateway</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  NBE Simulator with chaos testing (422, 500, timeouts) issuing cryptographic intake receipts upon delivery.
                </p>
              </div>
            </div>
          </div>
        )}

        {docTab === 'CATALOG' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Search and Filters Bar in Catalog */}
            <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter catalog code, title..."
                    value={catalogSearch}
                    onChange={(e) => {
                      setCatalogSearch(e.target.value);
                      setCatalogPage(1);
                    }}
                    className="w-full pl-8 pr-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-ob-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <select
                  value={catalogCategory}
                  onChange={(e) => {
                    setCatalogCategory(e.target.value);
                    setCatalogPage(1);
                  }}
                  className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer shadow-2xs"
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="dark:bg-slate-800 dark:text-slate-200">
                      {c === 'ALL' ? 'All Categories' : c}
                    </option>
                  ))}
                </select>

                <select
                  value={catalogFrequency}
                  onChange={(e) => {
                    setCatalogFrequency(e.target.value);
                    setCatalogPage(1);
                  }}
                  className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer shadow-2xs"
                >
                  <option value="ALL" className="dark:bg-slate-800">All Frequencies</option>
                  <option value="MONTHLY" className="dark:bg-slate-800">Monthly</option>
                  <option value="QUARTERLY" className="dark:bg-slate-800">Quarterly</option>
                  <option value="ANNUAL" className="dark:bg-slate-800">Annual</option>
                </select>

                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {filteredCatalog.length} / {templates.length} templates
                </span>
              </div>
            </div>

            {/* Catalog Table */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                    <th className="py-2 px-3">Code</th>
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Frequency</th>
                    <th className="py-2 px-3">Items</th>
                    <th className="py-2 px-3">Dynamic Rosters</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedCatalog.map((t) => (
                    <tr key={t.ReturnKey} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-400">{t.Code}</td>
                      <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{t.Title}</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{t.Category}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {t.Frequency}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300 font-mono">{t.ReturnItemsList.length}</td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300 font-mono">{t.DynamicItemsList.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="shrink-0 p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <Pagination
                currentPage={catalogPage}
                totalItems={filteredCatalog.length}
                pageSize={catalogPageSize}
                onPageChange={setCatalogPage}
                onPageSizeChange={setCatalogPageSize}
                pageSizeOptions={[6, 12, 24]}
                itemName="regulatory returns"
              />
            </div>
          </div>
        )}

        {docTab === 'WORKFLOW' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              4-Eyes Maker-Checker Architecture Specification
            </h3>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="font-bold text-slate-800 dark:text-slate-200">State Transition Lifecycle:</div>
              <div className="font-mono text-xs text-ob-indigo-900 dark:text-ob-indigo-300 bg-ob-indigo-50/50 dark:bg-ob-indigo-950/50 p-2.5 rounded-lg border border-ob-indigo-200 dark:border-ob-indigo-800/80 overflow-x-auto">
                DRAFT ──(Submit)──► PENDING_CHECKER ──(Approve)──► APPROVED ──(Deliver)──► SENT
                                      │
                                (Correction / Reject)
                                      ▼
                        CORRECTION_REQUIRED / REJECTED
              </div>
            </div>
            <ul className="space-y-2 text-slate-700 dark:text-slate-300 list-disc list-inside leading-relaxed">
              <li><strong>Zero Self-Approval:</strong> A Maker cannot approve their own submission.</li>
              <li><strong>Checker Non-Tampering:</strong> Checkers cannot edit return data directly; must request correction from Maker.</li>
              <li><strong>Audit Logging:</strong> Every state change is immutably logged with actor identity and timestamp.</li>
            </ul>
          </div>
        )}

        {docTab === 'SPECS' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3 font-mono text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-sans">
              NBE Intake REST API Specifications
            </h3>
            <div className="bg-slate-950 text-slate-200 p-4 rounded-xl border border-slate-800 overflow-x-auto">
              <span className="text-emerald-400 font-bold">POST</span> /api/nbe-simulator/submit<br />
              Headers: <br />
              &nbsp;&nbsp;Content-Type: application/json<br />
              &nbsp;&nbsp;X-Idempotency-Key: &lt;UUID&gt;<br />
              &nbsp;&nbsp;X-Correlation-ID: &lt;UUID&gt;<br />
              Response (200 OK):<br />
              &nbsp;&nbsp;&#123;<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&quot;status&quot;: &quot;ACCEPTED&quot;,<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&quot;submissionReceiptNumber&quot;: &quot;NBE-REC-2026-XXXX&quot;,<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&quot;timestamp&quot;: &quot;2026-09-25T...&quot;<br />
              &nbsp;&nbsp;&#125;
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
