/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  GitBranch,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Users,
  Building2,
  FileText,
  Layers,
  Lock,
  Clock,
  ArrowRight,
  Search,
  Filter,
  Info,
  Sparkles,
  X,
  ChevronDown,
  ChevronRight,
  Eye,
  Send,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Plus,
} from 'lucide-react';
import {
  configurationGovernanceService,
  GovernanceProposal,
  GovernanceProposalStatus,
  GovernanceRiskLevel,
  GovernanceEntityType,
  GovernanceAuditExplanation,
} from '../services/configurationGovernanceService.ts';
import { UserSession } from '../types/regulatory.ts';
import { vibrate } from '../utils/haptics.ts';

interface ConfigurationGovernanceViewProps {
  currentUser?: UserSession;
  onNotice?: (message: string, type?: 'SUCCESS' | 'ERROR') => void;
}

export const ConfigurationGovernanceView: React.FC<ConfigurationGovernanceViewProps> = ({
  currentUser,
  onNotice,
}) => {
  const [proposals, setProposals] = useState<GovernanceProposal[]>(() =>
    configurationGovernanceService.getProposals()
  );
  const [selectedProposal, setSelectedProposal] = useState<GovernanceProposal | null>(null);
  const [statusFilter, setStatusFilter] = useState<GovernanceProposalStatus | 'ALL'>('ALL');
  const [riskFilter, setRiskFilter] = useState<GovernanceRiskLevel | 'ALL'>('ALL');
  const [entityFilter, setEntityFilter] = useState<GovernanceEntityType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const [explanationData, setExplanationData] = useState<GovernanceAuditExplanation | null>(null);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackTargetVersion, setRollbackTargetVersion] = useState<number>(1);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Sync listener
  useEffect(() => {
    const handleUpdate = () => {
      const refreshed = configurationGovernanceService.getProposals();
      setProposals(refreshed);
      if (selectedProposal) {
        const found = configurationGovernanceService.getProposalById(selectedProposal.id);
        if (found) setSelectedProposal(found);
      }
    };

    configurationGovernanceService.on('proposal:created', handleUpdate);
    configurationGovernanceService.on('proposal:validated', handleUpdate);
    configurationGovernanceService.on('proposal:approved', handleUpdate);
    configurationGovernanceService.on('proposal:rejected', handleUpdate);
    configurationGovernanceService.on('proposal:published', handleUpdate);
    configurationGovernanceService.on('proposal:rollback_initiated', handleUpdate);

    return () => {
      configurationGovernanceService.off('proposal:created', handleUpdate);
      configurationGovernanceService.off('proposal:validated', handleUpdate);
      configurationGovernanceService.off('proposal:approved', handleUpdate);
      configurationGovernanceService.off('proposal:rejected', handleUpdate);
      configurationGovernanceService.off('proposal:published', handleUpdate);
      configurationGovernanceService.off('proposal:rollback_initiated', handleUpdate);
    };
  }, [selectedProposal]);

  // Filtered proposals
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (riskFilter !== 'ALL' && p.riskLevel !== riskFilter) return false;
      if (entityFilter !== 'ALL' && p.entityType !== entityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesEntity = p.entityName.toLowerCase().includes(q) || p.entityId.toLowerCase().includes(q);
        const matchesProposer = p.proposer.name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesEntity && !matchesProposer) return false;
      }
      return true;
    });
  }, [proposals, statusFilter, riskFilter, entityFilter, searchQuery]);

  // Set default selection
  useEffect(() => {
    if (!selectedProposal && filteredProposals.length > 0) {
      setSelectedProposal(filteredProposals[0]);
    }
  }, [filteredProposals, selectedProposal]);

  const getRiskBadge = (risk: GovernanceRiskLevel) => {
    switch (risk) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800';
      default:
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    }
  };

  const getStatusBadge = (status: GovernanceProposalStatus) => {
    switch (status) {
      case 'EFFECTIVE':
      case 'PUBLISHED':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700';
      case 'APPROVED':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700';
      case 'PENDING_APPROVAL':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700';
      case 'VALIDATED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-700';
      case 'REJECTED':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-700';
      case 'ROLLED_BACK':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-700';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  // Lifecycle steps definitions
  const LIFECYCLE_STEPS: Array<{ key: string; label: string; icon: any }> = [
    { key: 'DRAFT', label: '1. Draft', icon: FileText },
    { key: 'VALIDATED', label: '2. Validate', icon: FileCheck },
    { key: 'IMPACT', label: '3. Impact Analysis', icon: Layers },
    { key: 'APPROVED', label: '4. Review & Approval', icon: ShieldCheck },
    { key: 'PUBLISHED', label: '5. Publish', icon: Send },
    { key: 'EFFECTIVE', label: '6. Effective', icon: CheckCircle2 },
    { key: 'AUDIT', label: '7. Audit Sealed', icon: Lock },
  ];

  const getStepStatus = (proposal: GovernanceProposal, stepKey: string) => {
    const status = proposal.status;
    if (status === 'REJECTED') {
      if (stepKey === 'DRAFT' || stepKey === 'VALIDATED' || stepKey === 'IMPACT') return 'DONE';
      if (stepKey === 'APPROVED') return 'FAILED';
      return 'PENDING';
    }
    if (status === 'EFFECTIVE') return 'DONE';
    if (status === 'PUBLISHED') {
      if (stepKey === 'EFFECTIVE') return new Date(proposal.effectiveFrom) <= new Date() ? 'DONE' : 'CURRENT';
      return 'DONE';
    }
    if (status === 'APPROVED') {
      if (stepKey === 'DRAFT' || stepKey === 'VALIDATED' || stepKey === 'IMPACT' || stepKey === 'APPROVED') return 'DONE';
      if (stepKey === 'PUBLISHED') return 'CURRENT';
      return 'PENDING';
    }
    if (status === 'PENDING_APPROVAL') {
      if (stepKey === 'DRAFT' || stepKey === 'VALIDATED' || stepKey === 'IMPACT') return 'DONE';
      if (stepKey === 'APPROVED') return 'CURRENT';
      return 'PENDING';
    }
    if (status === 'VALIDATED') {
      if (stepKey === 'DRAFT' || stepKey === 'VALIDATED') return 'DONE';
      if (stepKey === 'IMPACT') return 'DONE';
      return 'PENDING';
    }
    if (status === 'DRAFT') {
      if (stepKey === 'DRAFT') return 'CURRENT';
      return 'PENDING';
    }
    return 'DONE';
  };

  // Action handlers
  const handleValidate = (proposalId: string) => {
    try {
      const validator = {
        id: currentUser?.id || 'usr_admin',
        name: currentUser?.name || 'Administrator',
        role: currentUser?.role || 'ADMIN',
      };
      const res = configurationGovernanceService.validateProposal(proposalId, validator);
      setSelectedProposal({ ...res });
      onNotice?.(`Proposal '${res.title}' validated successfully.`, 'SUCCESS');
      vibrate([20, 20]);
    } catch (err: any) {
      onNotice?.(`Validation error: ${err.message}`, 'ERROR');
    }
  };

  const handleApprove = () => {
    if (!selectedProposal) return;
    try {
      const approver = {
        id: currentUser?.id || 'usr_checker_seed',
        name: currentUser?.name || 'Almaz Ayana',
        role: currentUser?.role || 'CHECKER',
        department: currentUser?.department,
      };
      const res = configurationGovernanceService.approveProposal(
        selectedProposal.id,
        approver,
        approvalComments || 'Approved per NBE regulatory supervisory governance.'
      );
      setSelectedProposal({ ...res });
      setApprovalComments('');
      setIsApproving(false);
      onNotice?.(`Proposal approved under 4-eyes governance review.`, 'SUCCESS');
      vibrate([25, 30, 25]);
    } catch (err: any) {
      onNotice?.(err.message, 'ERROR');
    }
  };

  const handleReject = () => {
    if (!selectedProposal || !rejectionReason.trim()) return;
    try {
      const rejector = {
        id: currentUser?.id || 'usr_checker_seed',
        name: currentUser?.name || 'Almaz Ayana',
        role: currentUser?.role || 'CHECKER',
      };
      const res = configurationGovernanceService.rejectProposal(
        selectedProposal.id,
        rejector,
        rejectionReason
      );
      setSelectedProposal({ ...res });
      setRejectionReason('');
      setIsRejectModalOpen(false);
      onNotice?.(`Proposal rejected. Proposer notified.`, 'SUCCESS');
      vibrate([30, 40]);
    } catch (err: any) {
      onNotice?.(err.message, 'ERROR');
    }
  };

  const handlePublish = () => {
    if (!selectedProposal) return;
    try {
      const publisher = {
        id: currentUser?.id || 'usr_admin',
        name: currentUser?.name || 'Abebe Bikila',
        role: currentUser?.role || 'ADMIN',
      };
      const { proposal: published, resultingVersion } = configurationGovernanceService.publishProposal(
        selectedProposal.id,
        publisher
      );
      setSelectedProposal({ ...published });
      onNotice?.(
        `Configuration published as Version ${resultingVersion}. Optimistic concurrency locks verified.`,
        'SUCCESS'
      );
      vibrate([30, 20, 30]);
    } catch (err: any) {
      onNotice?.(err.message, 'ERROR');
    }
  };

  const handleOpenExplain = () => {
    if (!selectedProposal) return;
    try {
      const expl = configurationGovernanceService.explainChange(selectedProposal.id);
      setExplanationData(expl);
      setIsExplainModalOpen(true);
    } catch (err: any) {
      onNotice?.(`Cannot explain change: ${err.message}`, 'ERROR');
    }
  };

  const handleExecuteRollback = () => {
    if (!selectedProposal || !rollbackReason.trim()) return;
    try {
      const actor = {
        id: currentUser?.id || 'usr_admin',
        name: currentUser?.name || 'Administrator',
        role: currentUser?.role || 'ADMIN',
      };
      const rollbackProp = configurationGovernanceService.rollbackToVersion(
        selectedProposal.entityType,
        selectedProposal.entityId,
        Number(rollbackTargetVersion),
        actor,
        rollbackReason
      );
      setSelectedProposal(rollbackProp);
      setIsRollbackModalOpen(false);
      setRollbackReason('');
      onNotice?.(
        `Rollback proposal drafted for Version ${rollbackTargetVersion}. A rollback is a new auditable event; historical versions remain intact.`,
        'SUCCESS'
      );
      vibrate([30, 30, 30]);
    } catch (err: any) {
      onNotice?.(`Rollback failed: ${err.message}`, 'ERROR');
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-ob-indigo-900 via-slate-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-ob-indigo-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-ob-indigo-500/30 text-ob-indigo-200 border border-ob-indigo-400/30">
                Phase 8 Architecture
              </span>
              <span className="text-xs text-slate-400">NBE Directive BSD/03/2020</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-1 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-ob-indigo-400" />
              <span>Configuration Governance, Versioning & Governed Rollback</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Controlled lifecycle for high-impact organizational and reporting changes:
              <strong className="text-white ml-1">Draft → Validate → Impact Analysis → Dual Review → Publish → Effective → Audit</strong>.
              All changes are versioned, optimistic-locked, and reversibly audited without rewriting history.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Controls & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search proposals by title, entity, return key, or proposer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-ob-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="VALIDATED">Validated</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="PUBLISHED">Published</option>
              <option value="EFFECTIVE">Effective</option>
              <option value="ROLLED_BACK">Rolled Back</option>
              <option value="REJECTED">Rejected</option>
            </select>

            {/* Risk Filter */}
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="LOW">Low Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="HIGH">High Risk</option>
              <option value="CRITICAL">Critical Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Main Workspace: Split Pane (List vs Detail Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Pane: Proposal List (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-semibold">
            <span>Governance Proposals ({filteredProposals.length})</span>
            <span>Sorted by Recent</span>
          </div>

          <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
            {filteredProposals.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-500">
                <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs">No configuration proposals match the filters.</p>
              </div>
            ) : (
              filteredProposals.map((prop) => {
                const isSelected = selectedProposal?.id === prop.id;
                return (
                  <div
                    key={prop.id}
                    onClick={() => {
                      setSelectedProposal(prop);
                      vibrate(15);
                    }}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-ob-indigo-50/50 dark:bg-ob-indigo-950/20 border-ob-indigo-500 dark:border-ob-indigo-400 shadow-sm ring-1 ring-ob-indigo-400/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        {prop.entityType} · v{prop.expectedEntityVersion}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRiskBadge(prop.riskLevel)}`}>
                          {prop.riskLevel}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(prop.status)}`}>
                          {prop.status}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                      {prop.title}
                    </h4>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                      {prop.description}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Proposer: {prop.proposer.name}</span>
                      <span>{new Date(prop.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Proposal Inspector & Governance Actions (7 cols) */}
        <div className="lg:col-span-7">
          {selectedProposal ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-ob-indigo-600 dark:text-ob-indigo-400 border border-slate-200 dark:border-slate-700">
                      {selectedProposal.entityId}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${getRiskBadge(selectedProposal.riskLevel)}`}>
                      {selectedProposal.riskLevel} RISK
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${getStatusBadge(selectedProposal.status)}`}>
                      {selectedProposal.status}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1.5">
                    {selectedProposal.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedProposal.description}
                  </p>
                </div>

                {/* Primary Action Button Bar */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenExplain}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400" />
                    <span>Explain Change</span>
                  </button>

                  {/* Rollback Trigger */}
                  {selectedProposal.publication && (
                    <button
                      type="button"
                      onClick={() => {
                        setRollbackTargetVersion(Math.max(1, selectedProposal.expectedEntityVersion));
                        setIsRollbackModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Rollback</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4. Visual Governance Lifecycle Stepper */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span>Governance Lifecycle Progress</span>
                  <span className="font-mono text-[10px] text-slate-500">
                    Concurrency Lock: Expected v{selectedProposal.expectedEntityVersion}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 text-center">
                  {LIFECYCLE_STEPS.map((step) => {
                    const st = getStepStatus(selectedProposal, step.key);
                    const StepIcon = step.icon;
                    return (
                      <div
                        key={step.key}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          st === 'DONE'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                            : st === 'CURRENT'
                            ? 'bg-ob-indigo-50 dark:bg-ob-indigo-950/50 border-ob-indigo-400 text-ob-indigo-700 dark:text-ob-indigo-300 ring-1 ring-ob-indigo-400/40'
                            : st === 'FAILED'
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <StepIcon className="w-3.5 h-3.5 mx-auto mb-1" />
                        <div className="text-[10px] font-bold leading-tight line-clamp-1">{step.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. Comprehensive Impact Analysis Panel */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
                  <span>Impact Analysis & Dependency Resolution</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Affected Users</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <span>{selectedProposal.impactAnalysis.affectedUsers.length}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Affected Depts</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-purple-500" />
                      <span>{selectedProposal.impactAnalysis.affectedDepartments.length}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Affected Returns</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{selectedProposal.impactAnalysis.affectedReports.length}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Active Submissions</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        {selectedProposal.impactAnalysis.affectedSubmissions.draftCount +
                          selectedProposal.impactAnalysis.affectedSubmissions.submittedCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Risk Justification & Breaking Changes */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    Risk Assessment Rationale:
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {selectedProposal.impactAnalysis.riskReason}
                  </p>

                  {selectedProposal.impactAnalysis.breakingChanges.length > 0 && (
                    <div className="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Breaking Changes Detected:</span>
                      </div>
                      <ul className="list-disc pl-4 text-[10px] text-amber-700 dark:text-amber-300/90 mt-1 space-y-0.5">
                        {selectedProposal.impactAnalysis.breakingChanges.map((bc, idx) => (
                          <li key={idx}>{bc}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 pt-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{selectedProposal.impactAnalysis.affectedSubmissions.note}</span>
                  </div>
                </div>

                {/* Affected Stakeholders preview */}
                {selectedProposal.impactAnalysis.affectedUsers.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 max-h-36 overflow-y-auto space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Affected Stakeholders & Reason:
                    </div>
                    {selectedProposal.impactAnalysis.affectedUsers.map((u, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] flex items-center justify-between text-slate-700 dark:text-slate-300 py-0.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                      >
                        <span className="font-semibold">
                          {u.name} ({u.role} - {u.department})
                        </span>
                        <span className="text-[10px] text-slate-500 italic">{u.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 6. Proposed Changes Diff (Sanitized, No Secrets) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
                    <span>State Differences & Fields Touched (Sanitized)</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">Secrets & Tokens Scrubbed</span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
                  {selectedProposal.proposedChanges.diff.length === 0 ? (
                    <div className="p-3 text-slate-400 text-center italic text-xs">No direct scalar field diff recorded.</div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono">
                        <tr>
                          <th className="p-2">Field</th>
                          <th className="p-2">Before State</th>
                          <th className="p-2">Proposed State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                        {selectedProposal.proposedChanges.diff.map((d, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-2 font-bold text-ob-indigo-600 dark:text-ob-indigo-400">{d.field}</td>
                            <td className="p-2 text-rose-600 dark:text-rose-400">
                              {typeof d.oldValue === 'object' ? JSON.stringify(d.oldValue) : String(d.oldValue ?? 'null')}
                            </td>
                            <td className="p-2 text-emerald-600 dark:text-emerald-400">
                              {typeof d.newValue === 'object' ? JSON.stringify(d.newValue) : String(d.newValue ?? 'null')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* 7. Action Execution Bar */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Effective From: {new Date(selectedProposal.effectiveFrom).toLocaleDateString()}
                </div>

                <div className="flex items-center gap-2">
                  {/* Step: Validate */}
                  {selectedProposal.status === 'DRAFT' && (
                    <button
                      type="button"
                      onClick={() => handleValidate(selectedProposal.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Validate Proposal</span>
                    </button>
                  )}

                  {/* Step: Approve / Reject */}
                  {(selectedProposal.status === 'PENDING_APPROVAL' ||
                    selectedProposal.status === 'VALIDATED') && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsRejectModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsApproving(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Review & Approve</span>
                      </button>
                    </>
                  )}

                  {/* Step: Publish */}
                  {(selectedProposal.status === 'APPROVED' ||
                    (selectedProposal.status === 'VALIDATED' && selectedProposal.riskLevel === 'LOW')) && (
                    <button
                      type="button"
                      onClick={handlePublish}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Publish & Make Effective</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500">
              <ShieldCheck className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs">Select a proposal from the left list to inspect its governance details.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Explain Change (Phase 8 Completion Gate) */}
      {isExplainModalOpen && explanationData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-ob-indigo-500/10 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Official Regulatory Change Explanation
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Compliant with NBE supervisory non-repudiation audit requirements.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExplainModalOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Narrative Paragraph */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
              <strong className="text-ob-indigo-600 dark:text-ob-indigo-400 block mb-1">
                Auditable Explanation:
              </strong>
              {explanationData.impactSummary.summaryNarrative}
            </div>

            {/* Structured Table */}
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-slate-100 dark:bg-slate-800">
                  <span className="text-slate-500 block text-[10px]">Actor:</span>
                  <span className="font-bold">{explanationData.actor.name} ({explanationData.actor.role})</span>
                </div>
                <div className="p-2 rounded bg-slate-100 dark:bg-slate-800">
                  <span className="text-slate-500 block text-[10px]">Timestamp:</span>
                  <span className="font-bold">{new Date(explanationData.timestamp).toLocaleString()}</span>
                </div>
                <div className="p-2 rounded bg-slate-100 dark:bg-slate-800">
                  <span className="text-slate-500 block text-[10px]">Target Entity:</span>
                  <span className="font-bold">{explanationData.entity.name} ({explanationData.entity.type})</span>
                </div>
                <div className="p-2 rounded bg-slate-100 dark:bg-slate-800">
                  <span className="text-slate-500 block text-[10px]">Governed Version:</span>
                  <span className="font-bold">Version {explanationData.version.versionNumber}</span>
                </div>
              </div>

              {explanationData.approval && (
                <div className="p-2.5 rounded bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[11px]">
                  <span className="text-indigo-800 dark:text-indigo-300 font-bold block">
                    Four-Eyes Approval Record:
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                    Approved by {explanationData.approval.approvedBy} ({explanationData.approval.approverRole}) on{' '}
                    {new Date(explanationData.approval.approvedAt).toLocaleString()}. Comments:{' '}
                    <em>"{explanationData.approval.comments}"</em>
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsExplainModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 cursor-pointer"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Approval Confirmation & Comments */}
      {isApproving && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Confirm Regulatory 4-Eyes Approval</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You are certifying this configuration change. Under NBE BSD/03/2020 rules, your identity and timestamp will be permanently sealed into the regulatory audit log.
            </p>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Approval Justification Notes:
              </label>
              <textarea
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                placeholder="Enter regulatory review notes or confirmation statement..."
                rows={3}
                className="w-full p-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsApproving(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
              >
                Sign & Authorize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Rejection Reason */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-rose-600 flex items-center gap-2">
              <X className="w-4 h-4" />
              <span>Reject Configuration Proposal</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide a clear reason for rejecting this configuration proposal. The proposer will receive notice.
            </p>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Mandatory Rejection Reason:
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Specify regulatory discrepancies, formula errors, or departmental concerns..."
                rows={3}
                className="w-full p-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Governed Rollback */}
      {isRollbackModalOpen && selectedProposal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              <span>Initiate Governed Rollback</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <strong>Non-Destructive Rollback Principle:</strong> A rollback creates a new version reproducing the target historical schema. Past versions and historical submissions are NEVER rewritten or lost.
            </p>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Target Version to Revert to:
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, selectedProposal.expectedEntityVersion)}
                  value={rollbackTargetVersion}
                  onChange={(e) => setRollbackTargetVersion(Number(e.target.value))}
                  className="w-full p-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Mandatory Audit Rollback Reason:
                </label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Detail why this configuration is being rolled back..."
                  rows={3}
                  className="w-full p-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRollbackModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRollback}
                disabled={!rollbackReason.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Execute Governed Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
