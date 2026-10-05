/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { UserCheck, ShieldCheck, AlertCircle, Check, Star, Users } from 'lucide-react';
import type { UserSession, ReportSubmission } from '../types/regulatory.ts';
import {
  effectiveAccessEngine,
  EligibleCheckerInfo,
} from '../services/effectiveAccessEngine.ts';

interface CheckerSelectorProps {
  reportKey: string;
  currentUser: UserSession;
  selectedCheckerIds: string[];
  onChangeSelectedCheckers: (ids: string[]) => void;
  submission?: Partial<ReportSubmission>;
}

export const CheckerSelector: React.FC<CheckerSelectorProps> = ({
  reportKey,
  currentUser,
  selectedCheckerIds,
  onChangeSelectedCheckers,
  submission,
}) => {
  // Query eligible checkers from authoritative server-side effectiveAccessEngine
  const eligibleCheckers = useMemo<EligibleCheckerInfo[]>(() => {
    return effectiveAccessEngine.getEligibleCheckersForReport(
      reportKey,
      currentUser,
      submission
    );
  }, [reportKey, currentUser, submission]);

  const handleToggleChecker = (checkerId: string) => {
    if (selectedCheckerIds.includes(checkerId)) {
      onChangeSelectedCheckers(selectedCheckerIds.filter((id) => id !== checkerId));
    } else {
      onChangeSelectedCheckers([...selectedCheckerIds, checkerId]);
    }
  };

  const handleSetPrimary = (checkerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedCheckerIds.includes(checkerId)) {
      onChangeSelectedCheckers([checkerId, ...selectedCheckerIds]);
    } else {
      const rest = selectedCheckerIds.filter((id) => id !== checkerId);
      onChangeSelectedCheckers([checkerId, ...rest]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-ob-blue-600 dark:text-ob-blue-400" />
          <span>Select Checker(s) for 4-Eyes Review</span>
          <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
            ({eligibleCheckers.length} eligible)
          </span>
        </label>
        {selectedCheckerIds.length > 0 && (
          <span className="text-[11px] font-semibold text-ob-blue-600 dark:text-ob-blue-400 bg-ob-blue-50 dark:bg-ob-blue-950/60 px-2 py-0.5 rounded-full border border-ob-blue-200 dark:border-ob-blue-800">
            {selectedCheckerIds.length} Selected
          </span>
        )}
      </div>

      {/* Selected Reviewers Chips / List */}
      {selectedCheckerIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
          {selectedCheckerIds.map((id, index) => {
            const checker = eligibleCheckers.find((c) => c.id === id);
            const isPrimary = index === 0;
            return (
              <div
                key={id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  isPrimary
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
              >
                {isPrimary && (
                  <span
                    title="Primary Reviewer"
                    className="flex items-center text-amber-500"
                  >
                    <Star className="w-3 h-3 fill-amber-500" />
                  </span>
                )}
                <span>{checker?.name || id}</span>
                {isPrimary && (
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    Primary
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleChecker(id)}
                  className="ml-1 text-slate-400 hover:text-rose-500 focus:outline-hidden cursor-pointer"
                  title="Remove reviewer"
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* List of Eligible Checkers */}
      {eligibleCheckers.length === 0 ? (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              No Eligible Same-Department Checkers Available
            </p>
            <p className="text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
              No active registered Checkers were found in your department (<span className="font-medium">{currentUser.department || 'Unassigned'}</span>) for return <span className="font-mono font-medium">{reportKey}</span>. Under NBE BSD/03/2020 segregation rules, you cannot review your own submission. Please contact your Compliance Administrator to configure department Checkers or grant Special Cross-Department Access.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {eligibleCheckers.map((checker, index) => {
            const isSelected = selectedCheckerIds.includes(checker.id);
            const isPrimary = selectedCheckerIds[0] === checker.id;

            return (
              <div
                key={checker.id}
                onClick={() => handleToggleChecker(checker.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-ob-blue-50/70 dark:bg-ob-blue-950/40 border-ob-blue-400 dark:border-ob-blue-700 shadow-2xs'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      isSelected
                        ? 'bg-ob-blue-600 border-ob-blue-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {checker.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {checker.employeeId || 'OB-CHK'}
                      </span>
                      {checker.isAvailable && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {checker.department} • <span className="text-slate-600 dark:text-slate-300">{checker.authorizationReason}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {isSelected && (
                    <button
                      type="button"
                      onClick={(e) => handleSetPrimary(checker.id, e)}
                      title={isPrimary ? 'Primary Reviewer' : 'Click to set as Primary Reviewer'}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                        isPrimary
                          ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/60'
                      }`}
                    >
                      <Star className={`w-2.5 h-2.5 ${isPrimary ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                      {isPrimary ? 'Primary' : 'Make Primary'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Validation hint */}
      {selectedCheckerIds.length === 0 && eligibleCheckers.length > 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Please select at least one eligible Checker before submitting.</span>
        </p>
      )}
    </div>
  );
};
