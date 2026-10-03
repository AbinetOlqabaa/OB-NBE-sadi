/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type {
  NormalizedValidationItem,
  NormalizedValidationSummary,
  ProposedFix,
} from '../types/remediation.ts';
import type { UserSession } from '../types/regulatory.ts';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  Search,
  ExternalLink,
  Info,
  ShieldAlert,
  ArrowRight,
  Filter,
  X,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ValidationRemediationAssistantProps {
  summary: NormalizedValidationSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToField: (item: NormalizedValidationItem) => void;
  onApplyFix: (fix: ProposedFix) => Promise<void> | void;
  currentUser: UserSession;
  readOnly?: boolean;
  isFixing?: boolean;
}

export const ValidationRemediationAssistant: React.FC<ValidationRemediationAssistantProps> = ({
  summary,
  isOpen,
  onClose,
  onNavigateToField,
  onApplyFix,
  currentUser,
  readOnly = false,
  isFixing = false,
}) => {
  const [filterTab, setFilterTab] = useState<'ALL' | 'BLOCKING' | 'WARNINGS' | 'AUTO_FIXABLE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reviewFixModal, setReviewFixModal] = useState<{
    item: NormalizedValidationItem;
    fix: ProposedFix;
  } | null>(null);

  if (!isOpen || !summary) return null;

  // Filter items
  const filteredItems = summary.items.filter((item) => {
    if (filterTab === 'BLOCKING' && item.severity !== 'BLOCKING_ERROR') return false;
    if (filterTab === 'WARNINGS' && item.severity !== 'WARNING') return false;
    if (filterTab === 'AUTO_FIXABLE' && !item.autoFixable) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = item.fieldCode.toLowerCase().includes(q);
      const matchTitle = item.fieldTitle.toLowerCase().includes(q);
      const matchMsg = item.message.toLowerCase().includes(q);
      const matchWrong = item.explanation.whatIsWrong.toLowerCase().includes(q);
      return matchCode || matchTitle || matchMsg || matchWrong;
    }

    return true;
  });

  const handleFixClick = (item: NormalizedValidationItem) => {
    if (!item.proposedFix || readOnly || isFixing) return;

    if (item.proposedFix.requiresReview) {
      // Show CURRENT -> PROPOSED confirmation modal (Requirement 8)
      setReviewFixModal({ item, fix: item.proposedFix });
    } else {
      // Direct safe normalization (e.g. whitespace trim)
      onApplyFix(item.proposedFix);
    }
  };

  const handleConfirmReviewFix = () => {
    if (!reviewFixModal) return;
    const fix = reviewFixModal.fix;
    setReviewFixModal(null);
    onApplyFix(fix);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 transition-colors">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-850 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-ob-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Validation & Remediation Assistant
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ob-indigo-100 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300">
                  NBE BSD/03/2020
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Authoritative supervisory rule diagnostics, 4-part explanations & safe auto-fix
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Assistant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Readiness & Summary Strip (Requirement 10) */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {summary.isSubmissionReady ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Submission Ready: All statutory constraints passed</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Submission Blocked: {summary.blockingErrorsCount} blocking error(s) remain</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2 py-1 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 font-bold border border-rose-200 dark:border-rose-900">
                {summary.blockingErrorsCount} Blocking
              </span>
              <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 font-bold border border-amber-200 dark:border-amber-900">
                {summary.warningsCount} Warnings
              </span>
              <span className="px-2 py-1 rounded bg-ob-indigo-100 dark:bg-ob-indigo-950 text-ob-indigo-800 dark:text-ob-indigo-200 font-bold border border-ob-indigo-200 dark:border-ob-indigo-900">
                {summary.autoFixableCount} Auto-Fixable
              </span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="px-4 py-2 bg-slate-50/60 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFilterTab('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filterTab === 'ALL'
                  ? 'bg-ob-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              All ({summary.items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('BLOCKING')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filterTab === 'BLOCKING'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Blocking ({summary.blockingErrorsCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('WARNINGS')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filterTab === 'WARNINGS'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Warnings ({summary.warningsCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('AUTO_FIXABLE')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                filterTab === 'AUTO_FIXABLE'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Auto-Fixable ({summary.autoFixableCount})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 font-medium"
            />
          </div>
        </div>

        {/* Validation Items List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 px-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Unresolved Issues
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {filterTab === 'ALL'
                  ? 'All return items and dynamic schedules conform strictly to NBE supervisory specifications.'
                  : `No items matching the selected filter '${filterTab}'.`}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isBlocking = item.severity === 'BLOCKING_ERROR';
              const isDefError = item.category === 'REPORT_DEFINITION_ERROR';
              const isRuleError = item.category === 'BUSINESS_RULE_ERROR';

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3.5 text-xs transition-all shadow-2xs ${
                    isBlocking
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
                      : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60'
                  }`}
                >
                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isBlocking
                            ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200'
                            : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                        }`}
                      >
                        {isBlocking ? (
                          <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        )}
                        <span>{item.severity.replace('_', ' ')}</span>
                      </span>

                      {/* Requirement 12: Distinguish DATA ERROR vs REPORT-DEFINITION ERROR */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDefError
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : isRuleError
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {isDefError && <Layers className="w-2.5 h-2.5" />}
                        <span>{item.category.replace('_', ' ')}</span>
                      </span>

                      <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                        {item.fieldCode}
                      </span>
                    </div>

                    {/* Actions: Locate and Auto Fix */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onNavigateToField(item)}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                        title="Scroll to and focus this field in the report"
                      >
                        <Search className="w-3 h-3 text-slate-400" />
                        <span>Locate</span>
                      </button>

                      {item.autoFixable && !readOnly && (
                        <button
                          type="button"
                          onClick={() => handleFixClick(item)}
                          disabled={isFixing}
                          className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer shadow-2xs disabled:opacity-50"
                          title="Apply safe deterministic correction"
                        >
                          <Wand2 className="w-3 h-3" />
                          <span>Auto Fix</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Field Title & Primary Message */}
                  <div className="mt-1.5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                      {item.fieldTitle}
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                      {item.message}
                    </p>
                  </div>

                  {/* 4-Part Understandable Explanation Grid (Requirement 4 & 10) */}
                  <div className="mt-2.5 bg-white/80 dark:bg-slate-900/80 rounded-lg p-2.5 border border-slate-200/80 dark:border-slate-800/80 space-y-2 text-[11px]">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-rose-700 dark:text-rose-400 shrink-0 w-24">
                        WHAT IS WRONG:
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 flex-1">
                        {item.explanation.whatIsWrong}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-bold text-amber-700 dark:text-amber-400 shrink-0 w-24">
                        WHY IT MATTERS:
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 flex-1">
                        {item.explanation.whyItMatters}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-bold text-ob-indigo-700 dark:text-ob-indigo-400 shrink-0 w-24">
                        HOW TO FIX IT:
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 flex-1">
                        {item.explanation.howToFix}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0 w-24">
                        EXPECTED:
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px] flex-1">
                        {item.explanation.expectedFormat}
                      </span>
                    </div>
                  </div>

                  {/* Rule source footer */}
                  <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="truncate max-w-[320px]">
                      Source: <strong>{item.ruleSource}</strong>
                    </span>
                    {item.autoFixable ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Deterministic fix available
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">
                        Requires human ledger input
                      </span>
                    )}
                  </div>

                  {/* Requirement 12: Guidance for REPORT-DEFINITION ERROR */}
                  {isDefError && (
                    <div className="mt-2 p-2 rounded bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 text-[11px] text-purple-900 dark:text-purple-200 flex items-start gap-2">
                      <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Configuration Privilege Required: </span>
                        <span>
                          Only authorized configuration users (ADMIN) can change report definitions. If you are a Maker, contact your System Administrator to correct the template in Report Template Studio.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            Authoritative Server State • {new Date(summary.timestamp).toLocaleTimeString()}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-lg transition-colors cursor-pointer"
          >
            Close Assistant
          </button>
        </div>
      </div>

      {/* Requirement 8: Review & Confirm Auto-Fix Modal (CURRENT → PROPOSED) */}
      {reviewFixModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Review & Confirm Auto-Fix
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Deterministic correction preview before authoritative save
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewFixModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Target Field:</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {reviewFixModal.item.fieldTitle} ({reviewFixModal.fix.targetField})
                </div>
              </div>

              {/* CURRENT -> PROPOSED Diff Display */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Current Value
                  </span>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 font-mono text-slate-800 dark:text-slate-200 break-all">
                    {String(reviewFixModal.fix.currentValue)}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Proposed Value
                  </span>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 font-mono font-bold text-emerald-700 dark:text-emerald-300 break-all">
                    {String(reviewFixModal.fix.proposedValue)}
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-ob-indigo-50 dark:bg-ob-indigo-950/60 border border-ob-indigo-200 dark:border-ob-indigo-800/80 text-[11px] text-ob-indigo-900 dark:text-ob-indigo-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400 shrink-0" />
                  <span>Reason for Deterministic Correction:</span>
                </div>
                <p>{reviewFixModal.fix.description}</p>
                <div className="text-[10px] text-ob-indigo-700 dark:text-ob-indigo-300 font-mono">
                  Rule Source: {reviewFixModal.fix.ruleSource}
                </div>
              </div>

              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Applying this fix will update the draft in memory and on the server, re-run authoritative validation, and remove this issue once genuinely resolved.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReviewFixModal(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReviewFix}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Apply Auto-Fix</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
