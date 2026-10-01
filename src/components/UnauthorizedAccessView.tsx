/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { ShieldAlert, Lock, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { UserSession } from '../types/regulatory.ts';
import { ViewTab } from './Sidebar.tsx';
import { auditService } from '../services/auditService.ts';

interface UnauthorizedAccessViewProps {
  currentUser: UserSession;
  attemptedTab: ViewTab;
  onReturnToHome: () => void;
}

export const UnauthorizedAccessView: React.FC<UnauthorizedAccessViewProps> = ({
  currentUser,
  attemptedTab,
  onReturnToHome,
}) => {
  useEffect(() => {
    // Record audit violation entry for security audit trail
    auditService.log({
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      entityType: 'SYSTEM_SECURITY',
      entityId: attemptedTab,
      correlationId: `corr_sec_${Date.now()}`,
      details: `[Access Control Violation] User ${currentUser.name} (${currentUser.role}, ${currentUser.department}) attempted unauthorized access to protected workspace "${attemptedTab}". Request rejected by client and backend RBAC policy.`,
    });
  }, [currentUser, attemptedTab]);

  const getAuthorizedHomeName = (role: string) => {
    switch (role) {
      case 'MAKER':
        return 'Maker Workspace';
      case 'CHECKER':
        return 'Checker Inbox';
      case 'AUDITOR':
        return 'Auditor Workspace';
      case 'ADMIN':
        return 'Admin Governance';
      default:
        return 'Regulatory Overview';
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-8 p-6 sm:p-8 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl shadow-sm text-center space-y-6">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-inner">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <Lock className="w-3.5 h-3.5" />
          HTTP 403 Forbidden · Role Boundary Enforced
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Unauthorized Workspace Access
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Your current session role (<span className="font-bold text-slate-900 dark:text-white">{currentUser.role}</span>) does not have authorization to view the <span className="font-semibold text-slate-800 dark:text-slate-200">"{attemptedTab}"</span> workspace.
        </p>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-left text-xs space-y-2.5">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>National Bank of Ethiopia · BSD/03/2020 Segregation of Duties</span>
        </div>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Regulatory dual-control mandates strict separation between <strong>Preparation (Maker)</strong>, <strong>Verification (Checker)</strong>, <strong>System Oversight (Admin)</strong>, and <strong>Independent Examination (Auditor)</strong>. Cross-role operational delegation without an authorized Administrative Special Access Grant is strictly prohibited.
        </p>
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
          <span>Active User: <strong className="text-slate-700 dark:text-slate-300">{currentUser.name}</strong></span>
          <span>Department: <strong className="text-slate-700 dark:text-slate-300">{currentUser.department || 'N/A'}</strong></span>
          <span>Event: <code className="text-rose-600 dark:text-rose-400">UNAUTHORIZED_ACCESS_ATTEMPT</code></span>
        </div>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onReturnToHome}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-ob-indigo-700 hover:bg-ob-indigo-800 active:bg-ob-indigo-900 text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to {getAuthorizedHomeName(currentUser.role)}
        </button>
      </div>
    </div>
  );
};
