/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserCheck,
  UserX,
  UserPlus,
  Users,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Search,
  Filter,
  Edit2,
  Trash2,
  Building2,
  KeyRound,
  FileText,
  Inbox,
  Send,
  Database,
  History,
  Check,
  X,
  RotateCw,
  Sparkles,
  Key,
  Eye,
  FileSpreadsheet,
  Layers,
  HelpCircle,
  FileCheck,
  Calendar,
  Lock,
  ExternalLink,
  FolderTree,
} from 'lucide-react';
import { UserAccount, UserRole, UserStatus, userService } from '../services/userService.ts';
import { ReportMetadata, ReportSubmission, SpecialAccessGrant, UserSession } from '../types/regulatory.ts';
import { Pagination } from './Pagination.tsx';
import { ViewTab } from './Sidebar.tsx';
import { submissionService } from '../services/submissionService.ts';
import { getAllReports, getReportByKey } from '../data/report-registry.ts';
import {
  DepartmentDefinition,
  getReportsForDepartment,
  getDepartmentForReport,
} from '../data/organizationHierarchy.ts';
import { departmentService } from '../services/departmentService.ts';

interface AdminDashboardProps {
  currentUser: UserSession;
  onNavigateTab: (tab: ViewTab) => void;
  onUserStatusChanged?: () => void;
}

type AdminSubTab = 'REPORTS_OVERSIGHT' | 'SPECIAL_ACCESS' | 'PENDING' | 'ALL_USERS' | 'GOVERNANCE';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onNavigateTab,
  onUserStatusChanged,
}) => {
  const [users, setUsers] = useState<UserAccount[]>(userService.getAll());
  const [submissions, setSubmissions] = useState<ReportSubmission[]>(submissionService.getAll());
  const [templates, setTemplates] = useState<ReportMetadata[]>(getAllReports());
  const [departments, setDepartments] = useState<DepartmentDefinition[]>(() => departmentService.getAll());
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>('REPORTS_OVERSIGHT');

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  // Inspector Modal for Admin Read-Only Detail View
  const [inspectingSub, setInspectingSub] = useState<ReportSubmission | null>(null);

  // Grant Special Access Modal
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantTargetUserId, setGrantTargetUserId] = useState('');
  const [grantType, setGrantType] = useState<'REPORT' | 'DEPARTMENT'>('REPORT');
  const [grantReportKey, setGrantReportKey] = useState('');
  const [grantDepartment, setGrantDepartment] = useState('');
  const [grantSelectedDepartments, setGrantSelectedDepartments] = useState<string[]>([]);
  const [grantDeptSearch, setGrantDeptSearch] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [grantExpiresAt, setGrantExpiresAt] = useState('');

  // Pagination for all users table
  const [allUsersPage, setAllUsersPage] = useState(1);
  const [allUsersPageSize, setAllUsersPageSize] = useState(6);

  // Pagination for pending users table
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(6);

  // Pagination for reports oversight table
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsPageSize, setReportsPageSize] = useState(6);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    department: string;
    employeeId: string;
    phoneNumber: string;
    role: UserRole;
    status: UserStatus;
  }>({
    name: '',
    department: '',
    employeeId: '',
    phoneNumber: '',
    role: 'MAKER',
    status: 'ACTIVE',
  });

  // Action feedback notice
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const refreshAllData = async () => {
    try {
      const [uRes, sRes] = await Promise.all([
        fetch('/api/users').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/regulatory/submissions').then((r) => (r.ok ? r.json() : null)),
      ]);
      if (uRes && Array.isArray(uRes)) setUsers(uRes);
      else setUsers(userService.getAll());

      if (sRes && Array.isArray(sRes)) setSubmissions(sRes);
      else setSubmissions(submissionService.getAll());
    } catch {
      setUsers(userService.getAll());
      setSubmissions(submissionService.getAll());
    }
    setDepartments(departmentService.getAll());
    setTemplates(getAllReports());
  };

  useEffect(() => {
    refreshAllData();
    const unsubDepts = departmentService.subscribe((updated) => {
      setDepartments(updated);
    });
    return () => {
      unsubDepts();
    };
  }, []);

  // Filter pending users
  const pendingUsers = users.filter((u) => u.status === 'PENDING_APPROVAL');

  // Filter all users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Filter submissions for reports oversight
  const filteredSubmissions = submissions.filter((sub) => {
    const tpl = templates.find((t) => t.ReturnKey === sub.reportKey);
    const title = tpl ? tpl.Title : sub.reportKey;
    const dept = sub.department || getDepartmentForReport(sub.reportKey);

    const matchesSearch =
      !searchQuery ||
      sub.reportKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.makerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dept.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept =
      departmentFilter === 'ALL' || dept.toLowerCase() === departmentFilter.toLowerCase();

    const matchesStatus =
      statusFilter === 'ALL' || sub.status === statusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Paginated Slices
  const paginatedAllUsers = filteredUsers.slice(
    (allUsersPage - 1) * allUsersPageSize,
    allUsersPage * allUsersPageSize
  );

  const paginatedPending = pendingUsers.slice(
    (pendingPage - 1) * pendingPageSize,
    pendingPage * pendingPageSize
  );

  const paginatedReports = filteredSubmissions.slice(
    (reportsPage - 1) * reportsPageSize,
    reportsPage * reportsPageSize
  );

  // Authorize User
  const handleAuthorizeUser = async (userId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE', adminName: currentUser.name }),
      });
      if (res.ok) {
        showNotice('success', 'User authorized and activated successfully.');
      } else {
        userService.updateUserStatus(userId, 'ACTIVE', currentUser.name);
        showNotice('success', 'User authorized and activated.');
      }
      await refreshAllData();
      if (onUserStatusChanged) onUserStatusChanged();
    } catch {
      userService.updateUserStatus(userId, 'ACTIVE', currentUser.name);
      showNotice('success', 'User authorized successfully.');
      await refreshAllData();
    } finally {
      setLoading(false);
    }
  };

  // Toggle Disable User
  const handleToggleDisable = async (user: UserAccount) => {
    const nextStatus: UserStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/users/${user.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, adminName: currentUser.name }),
      });
      if (res.ok) {
        showNotice('success', `User account status updated to ${nextStatus}.`);
      } else {
        userService.updateUserStatus(user.id, nextStatus, currentUser.name);
        showNotice('success', `User account updated to ${nextStatus}.`);
      }
      await refreshAllData();
    } catch {
      userService.updateUserStatus(user.id, nextStatus, currentUser.name);
      showNotice('success', `User status updated to ${nextStatus}.`);
      await refreshAllData();
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user account "${userName}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotice('success', `User ${userName} has been removed.`);
      } else {
        userService.deleteUser(userId);
        showNotice('success', `User ${userName} removed.`);
      }
      await refreshAllData();
    } catch {
      userService.deleteUser(userId);
      showNotice('success', `User ${userName} removed.`);
      await refreshAllData();
    }
  };

  // Edit User Profile
  const handleOpenEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      department: user.department,
      employeeId: user.employeeId,
      phoneNumber: user.phoneNumber || '',
      role: user.role,
      status: user.status,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      if (res.ok) {
        showNotice('success', `Profile for ${editFormData.name} updated.`);
      } else {
        userService.updateUser(editingUser.id, editFormData);
        showNotice('success', `Profile for ${editFormData.name} updated.`);
      }
      setEditingUser(null);
      await refreshAllData();
    } catch {
      userService.updateUser(editingUser.id, editFormData);
      showNotice('success', `Profile for ${editFormData.name} updated.`);
      setEditingUser(null);
      await refreshAllData();
    }
  };

  // Grant Special Access
  const handleGrantSpecialAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantTargetUserId) {
      showNotice('error', 'Select a target user.');
      return;
    }
    if (!grantReason.trim()) {
      showNotice('error', 'Business justification reason is required.');
      return;
    }
    if (grantType === 'REPORT' && !grantReportKey) {
      showNotice('error', 'Select a report return key.');
      return;
    }
    if (grantType === 'DEPARTMENT' && grantSelectedDepartments.length === 0) {
      showNotice('error', 'Select at least one department to authorize.');
      return;
    }

    const payload = {
      reportKey: grantType === 'REPORT' ? grantReportKey : undefined,
      department:
        grantType === 'DEPARTMENT'
          ? grantSelectedDepartments.length === 1
            ? grantSelectedDepartments[0]
            : grantSelectedDepartments.join(', ')
          : undefined,
      departments: grantType === 'DEPARTMENT' ? grantSelectedDepartments : undefined,
      reason: grantReason.trim(),
      expiresAt: grantExpiresAt || undefined,
      adminName: currentUser.name,
    };

    try {
      const res = await fetch(`/api/users/${grantTargetUserId}/special-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice('success', data.message || 'Special cross-department access granted.');
      } else {
        const local = userService.grantSpecialAccess(grantTargetUserId, payload, currentUser.name);
        if (local.success) {
          showNotice('success', local.message || 'Special access granted.');
        } else {
          showNotice('error', local.message || 'Failed to grant special access.');
        }
      }
      setIsGrantModalOpen(false);
      setGrantReason('');
      setGrantReportKey('');
      setGrantDepartment('');
      setGrantSelectedDepartments([]);
      await refreshAllData();
    } catch {
      const local = userService.grantSpecialAccess(grantTargetUserId, payload, currentUser.name);
      if (local.success) {
        showNotice('success', local.message || 'Special access granted.');
      } else {
        showNotice('error', local.message || 'Failed to grant special access.');
      }
      setIsGrantModalOpen(false);
      setGrantSelectedDepartments([]);
      await refreshAllData();
    }
  };

  // Revoke Special Access
  const handleRevokeSpecialAccess = async (userId: string, grantId: string) => {
    if (!window.confirm('Are you sure you want to revoke this special cross-department access grant?')) {
      return;
    }
    try {
      const res = await fetch(`/api/users/${userId}/special-access/${grantId}?adminName=${encodeURIComponent(currentUser.name)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice('success', data.message || 'Special access revoked.');
      } else {
        const local = userService.revokeSpecialAccess(userId, grantId, currentUser.name);
        showNotice(local.success ? 'success' : 'error', local.message || 'Grant updated.');
      }
      await refreshAllData();
    } catch {
      const local = userService.revokeSpecialAccess(userId, grantId, currentUser.name);
      showNotice(local.success ? 'success' : 'error', local.message || 'Grant updated.');
      await refreshAllData();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Draft
          </span>
        );
      case 'PENDING_CHECKER':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Pending Sign-off
          </span>
        );
      case 'CORRECTION_REQUIRED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Needs Correction
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Approved
          </span>
        );
      case 'SENT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            Delivered to NBE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-2.5 font-sans">
      {/* 1. Administrator Executive Oversight Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-ob-indigo-950 text-white rounded-xl p-3 shadow-sm border border-slate-800 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-ob-indigo-500 text-white uppercase tracking-wider">
                System Administrator
              </span>
              <span className="text-xs text-ob-indigo-200 font-mono">
                {currentUser.name} ({currentUser.employeeId || 'OB-ADM-001'})
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-xs font-semibold text-white flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-ob-indigo-300" />
                Compliance & Legal Governance Directorate
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-snug">
              Comprehensive supervisory oversight of all 24 NBE Returns, user access, and department bindings. Per NBE regulatory directives, Administrator role is informative and oversight-based—administrators inspect records but do not alter, submit, or approve returns.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('DEPT_REPORT_MANAGEMENT')}
              className="px-3 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Manage bank departments, report types and linkages"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Departments & Reports</span>
            </button>
            <button
              type="button"
              onClick={() => setIsGrantModalOpen(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Grant Special Access</span>
            </button>
            <button
              onClick={refreshAllData}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
              title="Refresh all records"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Metrics Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 shrink-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between transition-colors">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ob-indigo-700 dark:text-ob-indigo-400 block">NBE Returns</span>
            <div className="text-lg font-bold text-ob-indigo-700 dark:text-ob-indigo-400 leading-tight">24 Canonical</div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Classified by Dept</span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-400 flex items-center justify-center border border-ob-indigo-200 dark:border-ob-indigo-800">
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between transition-colors">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">Pending Sign-off</span>
            <div className="text-lg font-bold text-amber-700 dark:text-amber-400 leading-tight">
              {submissions.filter((s) => s.status === 'PENDING_CHECKER').length}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Awaiting 4-Eyes</span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between transition-colors">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Approved by Checker</span>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 leading-tight">
              {submissions.filter((s) => s.status === 'APPROVED').length}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Maker Delivery Stage</span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between transition-colors">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 block">Delivered to NBE</span>
            <div className="text-lg font-bold text-purple-700 dark:text-purple-400 leading-tight">
              {submissions.filter((s) => s.status === 'SENT').length}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Tokens Received</span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-800">
            <Send className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between transition-colors">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block">Pending Users</span>
            <div className="text-lg font-bold text-rose-700 dark:text-rose-400 leading-tight">{pendingUsers.length}</div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Awaiting Auth</span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800">
            <UserPlus className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Action Notice Banner */}
      {actionNotice && (
        <div
          className={`p-2.5 rounded-xl text-xs flex items-center justify-between transition-all shrink-0 ${
            actionNotice.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-white/80 hover:text-white text-xs px-2 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 3. Sub-Tab Navigation Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 transition-colors">
        <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll-x pb-1 sm:pb-0">
          <button
            onClick={() => setActiveSubTab('REPORTS_OVERSIGHT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press ${
              activeSubTab === 'REPORTS_OVERSIGHT'
                ? 'bg-ob-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Reports Oversight Center</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold bg-ob-indigo-700 text-white">
              {submissions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('SPECIAL_ACCESS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press ${
              activeSubTab === 'SPECIAL_ACCESS'
                ? 'bg-ob-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Special Access & Delegation</span>
          </button>

          <button
            onClick={() => setActiveSubTab('PENDING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press ${
              activeSubTab === 'PENDING'
                ? 'bg-ob-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Authorizations</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                pendingUsers.length > 0 ? 'bg-rose-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {pendingUsers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('ALL_USERS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press ${
              activeSubTab === 'ALL_USERS'
                ? 'bg-ob-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users & Departments</span>
          </button>

          <button
            onClick={() => setActiveSubTab('GOVERNANCE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press ${
              activeSubTab === 'GOVERNANCE'
                ? 'bg-ob-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Directives & Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('DEPT_REPORT_MANAGEMENT')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press text-ob-indigo-600 dark:text-ob-indigo-400 bg-ob-indigo-50 dark:bg-ob-indigo-950/60 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-900/60 border border-ob-indigo-200 dark:border-ob-indigo-800"
            title="Configure bank departments, report templates & linkages"
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Departments & Reports</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold bg-ob-indigo-200 dark:bg-ob-indigo-800 text-ob-indigo-900 dark:text-ob-indigo-200">
              {departments.length}
            </span>
          </button>
        </div>

        {/* Global Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search return, user, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* 4. Tab Content 1: REPORTS OVERSIGHT CENTER */}
      {activeSubTab === 'REPORTS_OVERSIGHT' && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs transition-colors">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Institutional Regulatory Reporting Ledger ({filteredSubmissions.length} returns)
              </span>
              <span className="text-[10px] text-ob-indigo-700 dark:text-ob-indigo-400 bg-ob-indigo-50 dark:bg-ob-indigo-950 px-1.5 py-0.5 rounded border border-ob-indigo-200 dark:border-ob-indigo-800 font-medium">
                Admin Read-Only Oversight
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setReportsPage(1);
                }}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setReportsPage(1);
                }}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_CHECKER">Pending Checker</option>
                <option value="CORRECTION_REQUIRED">Needs Correction</option>
                <option value="APPROVED">Approved</option>
                <option value="SENT">Delivered to NBE</option>
              </select>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {paginatedReports.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Submissions Found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  Submissions initiated by department Makers across the bank will be visible here in full detail.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto min-w-full touch-scroll-x">
                <table className="min-w-[700px] w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                    <th className="py-2.5 px-3">Return Code</th>
                    <th className="py-2.5 px-3">Report Title</th>
                    <th className="py-2.5 px-3">Responsible Department</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Maker Details</th>
                    <th className="py-2.5 px-3">Checker Details</th>
                    <th className="py-2.5 px-3 text-right">Oversight Inspector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedReports.map((sub) => {
                    const tpl = templates.find((t) => t.ReturnKey === sub.reportKey);
                    return (
                      <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-400">
                          {sub.reportKey}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                          {tpl?.Title || sub.reportKey}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                          {sub.department || getDepartmentForReport(sub.reportKey)}
                        </td>
                        <td className="py-2.5 px-3">{getStatusBadge(sub.status)}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{sub.makerName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{sub.makerDepartment || 'Credit Operations'}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          {sub.checkerName ? (
                            <div>
                              <div className="font-semibold text-emerald-700 dark:text-emerald-400">{sub.checkerName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{sub.checkerDepartment || 'Credit Operations'}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Awaiting assignment</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectingSub(sub)}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-ob-indigo-600 dark:text-ob-indigo-400" />
                            <span>Inspect Return</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>

          <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <Pagination
              currentPage={reportsPage}
              totalItems={filteredSubmissions.length}
              pageSize={reportsPageSize}
              onPageChange={setReportsPage}
              onPageSizeChange={setReportsPageSize}
              pageSizeOptions={[6, 9, 12, 24]}
            />
          </div>
        </div>
      )}

      {/* 5. Tab Content 2: SPECIAL ACCESS & DELEGATION MANAGER */}
      {activeSubTab === 'SPECIAL_ACCESS' && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs transition-colors">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                Cross-Department Access Grants & Audit Delegations
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Grant authorized Makers and Checkers special permissions to access or review returns outside of their home department pursuant to administrative approval.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsGrantModalOpen(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Grant New Access</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {users
                .filter((u) => u.role === 'MAKER' || u.role === 'CHECKER')
                .map((u) => {
                  const grants = u.specialAccessGrants || [];
                  return (
                    <div
                      key={u.id}
                      className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">{u.name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                u.role === 'MAKER'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {u.role}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                            Home Department: <strong>{u.department}</strong>
                          </span>
                        </div>

                        <span className="font-mono text-xs text-slate-400">{u.employeeId}</span>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Active Special Access Delegations ({grants.length})
                        </span>
                        {grants.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No special cross-department access assigned.</p>
                        ) : (
                          grants.map((g) => (
                            <div
                              key={g.id}
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 flex items-start justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                    {g.reportKey
                                      ? `Return: ${g.reportKey}`
                                      : `Dept(s): ${
                                          Array.isArray(g.departments) && g.departments.length > 0
                                            ? g.departments.join(', ')
                                            : g.department
                                        }`}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    (Granted by {g.grantedBy})
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300">{g.reason}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRevokeSpecialAccess(u.id, g.id)}
                                className="px-2 py-0.8 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 rounded border border-rose-200 dark:border-rose-800 text-[10px] font-bold cursor-pointer"
                              >
                                Revoke
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* 6. Tab Content 3: PENDING AUTHORIZATIONS */}
      {activeSubTab === 'PENDING' && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Registrations Awaiting Administrator Authorization ({pendingUsers.length})
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {pendingUsers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">All Registrations Authorized</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                  There are currently no new Maker or Checker signups pending authorization.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto min-w-full touch-scroll-x">
                <table className="min-w-[650px] w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                    <th className="py-2 px-3">Applicant Name & Email</th>
                    <th className="py-2 px-3">Role</th>
                    <th className="py-2 px-3">Department</th>
                    <th className="py-2 px-3">Employee ID</th>
                    <th className="py-2 px-3">Registered Date</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedPending.map((user) => (
                    <tr key={user.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">{user.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{user.email}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          {user.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{user.department}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">{user.employeeId}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleAuthorizeUser(user.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Authorize Account</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>

          <div className="shrink-0 p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
            <Pagination
              currentPage={pendingPage}
              totalItems={pendingUsers.length}
              pageSize={pendingPageSize}
              onPageChange={setPendingPage}
              onPageSizeChange={setPendingPageSize}
              pageSizeOptions={[6, 12, 20]}
            />
          </div>
        </div>
      )}

      {/* 7. Tab Content 4: ALL USERS & ROLES */}
      {activeSubTab === 'ALL_USERS' && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="overflow-x-auto min-w-full touch-scroll-x">
              <table className="min-w-[650px] w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                  <th className="py-2 px-3">User & Email</th>
                  <th className="py-2 px-3">Role</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Department & Employee ID</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedAllUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">{user.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{user.email}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          user.role === 'AUDITOR'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {user.role}
                      </span>
                      {user.role === 'AUDITOR' && (user as any).auditScope && (
                        <div className="text-[9px] text-slate-500 font-mono mt-0.5">Scope: {(user as any).auditScope}</div>
                      )}
                      {user.role === 'AUDITOR' && (user as any).auditorJustification && (
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 italic max-w-xs truncate mt-0.5" title={(user as any).auditorJustification}>
                          "{(user as any).auditorJustification}"
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          user.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : user.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-800 dark:text-slate-200 font-medium">{user.department}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{user.employeeId}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                      {user.status === 'PENDING_APPROVAL' ? (
                        <button
                          type="button"
                          onClick={() => handleAuthorizeUser(user.id)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Authorize</span>
                        </button>
                      ) : (
                        user.id !== 'usr_admin_1' && (
                          <button
                            type="button"
                            onClick={() => handleToggleDisable(user)}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            {user.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(user)}
                        className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Edit
                      </button>

                      {user.id !== 'usr_admin_1' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          className="px-2 py-1 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className="shrink-0 p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
            <Pagination
              currentPage={allUsersPage}
              totalItems={filteredUsers.length}
              pageSize={allUsersPageSize}
              onPageChange={setAllUsersPage}
              onPageSizeChange={setAllUsersPageSize}
              pageSizeOptions={[6, 12, 20]}
            />
          </div>
        </div>
      )}

      {/* 8. Tab Content 5: GOVERNANCE & MATRIX */}
      {activeSubTab === 'GOVERNANCE' && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
              <span>NBE Banking Directive BSD/03/2020: Maker-Checker Role Matrix</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
              The National Bank of Ethiopia mandates strict segregation of duties for all prudential and statistical returns.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="border border-ob-indigo-200 dark:border-ob-indigo-800 bg-ob-indigo-50/50 dark:bg-ob-indigo-950/40 rounded-xl p-3">
                <span className="font-bold text-ob-indigo-900 dark:text-ob-indigo-300 block mb-1">Administrator (Governance & Oversight)</span>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300 list-disc list-inside">
                  <li>Informative read-only oversight of all returns</li>
                  <li>Authorization of new user registrations</li>
                  <li>Granting cross-department special access</li>
                  <li>Audit trails & system security governance</li>
                </ul>
              </div>

              <div className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/40 rounded-xl p-3">
                <span className="font-bold text-emerald-900 dark:text-emerald-300 block mb-1">Maker (Reporting Preparer)</span>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300 list-disc list-inside">
                  <li>Bound to home department returns (+ special access)</li>
                  <li>Inputs figures, dynamic schedules, formulas</li>
                  <li>Submits to Checker queue for 4-eyes review</li>
                  <li>Performs final transmission to NBE after approval</li>
                </ul>
              </div>

              <div className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/40 rounded-xl p-3">
                <span className="font-bold text-amber-900 dark:text-amber-300 block mb-1">Checker (Review Officer)</span>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300 list-disc list-inside">
                  <li>Conducts 4-eyes check on department returns</li>
                  <li>Does NOT fill or edit return forms</li>
                  <li>Approves or Requests Corrections with notes</li>
                  <li>Returns approved report to Maker for NBE delivery</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. Read-Only Report Detail Inspector Modal */}
      {inspectingSub && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-600 flex items-center justify-center border border-ob-indigo-200 dark:border-ob-indigo-800">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Audit Inspection: {inspectingSub.reportKey}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Administrator Read-Only Compliance Oversight • No data mutation permitted
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingSub(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Traceability Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Department:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{inspectingSub.department || 'Credit Operations'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Status:</span>
                <span className="font-semibold">{getStatusBadge(inspectingSub.status)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Period Year / Version:</span>
                <span className="font-mono text-slate-900 dark:text-white">{inspectingSub.periodYear} (v{inspectingSub.version})</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Prepared By (Maker):</span>
                <span className="font-medium text-slate-900 dark:text-white">{inspectingSub.makerName}</span>
                <span className="text-[10px] text-slate-400 block font-mono">{inspectingSub.makerEmail}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Reviewed By (Checker):</span>
                <span className="font-medium text-slate-900 dark:text-white">{inspectingSub.checkerName || 'Pending'}</span>
                <span className="text-[10px] text-slate-400 block font-mono">{inspectingSub.checkerEmail || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Transmission Status:</span>
                <span className="font-medium text-purple-600 dark:text-purple-400 font-mono">
                  {inspectingSub.finalSubmittedAt ? `Sent: ${new Date(inspectingSub.finalSubmittedAt).toLocaleDateString()}` : 'Not yet transmitted'}
                </span>
              </div>
            </div>

            {/* Values Summary */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Populated Return Line Items ({Object.keys(inspectingSub.values || {}).length} populated)
              </span>
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2.5 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 text-[10px] border-b border-slate-200 dark:border-slate-700">
                      <th className="py-1">Code</th>
                      <th className="py-1 text-right">Value (ETB / Count)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {Object.entries(inspectingSub.values || {}).map(([k, v]) => (
                      <tr key={k}>
                        <td className="py-1 font-mono font-bold text-ob-indigo-600 dark:text-ob-indigo-400">{k}</td>
                        <td className="py-1 text-right font-mono text-slate-800 dark:text-slate-200">
                          {typeof v === 'number' ? v.toLocaleString() : String(v)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comments & Audit Trail */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Audit Trail & History
              </span>
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-700 text-xs">
                {inspectingSub.comments.map((comm) => (
                  <div key={comm.id} className="pb-1 border-b border-slate-200/50 dark:border-slate-700/50 last:border-0">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span><strong>{comm.userName}</strong> ({comm.userRole})</span>
                      <span className="font-mono">{new Date(comm.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{comm.comment}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setInspectingSub(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Grant Special Access Modal */}
      {isGrantModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Grant Special Access</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Delegate cross-department return permission
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGrantModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGrantSpecialAccess} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target User (Maker or Checker) *
                </label>
                <select
                  required
                  value={grantTargetUserId}
                  onChange={(e) => setGrantTargetUserId(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white cursor-pointer font-medium"
                >
                  <option value="">-- Choose User --</option>
                  {users
                    .filter((u) => u.status === 'ACTIVE' && (u.role === 'MAKER' || u.role === 'CHECKER'))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role}) - {u.department}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Grant Scope *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGrantType('REPORT')}
                      className={`p-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        grantType === 'REPORT'
                          ? 'bg-ob-indigo-600 text-white border-ob-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Specific Return</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGrantType('DEPARTMENT')}
                      className={`p-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        grantType === 'DEPARTMENT'
                          ? 'bg-ob-indigo-600 text-white border-ob-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Department(s) Access</span>
                    </button>
                  </div>
                </div>

                {grantType === 'REPORT' ? (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Regulatory Return *
                    </label>
                    <select
                      required
                      value={grantReportKey}
                      onChange={(e) => setGrantReportKey(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white cursor-pointer font-medium"
                    >
                      <option value="">-- Choose Return --</option>
                      {templates.map((t) => (
                        <option key={t.ReturnKey} value={t.ReturnKey}>
                          {t.Code} - {t.Title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        Target Department(s) ({grantSelectedDepartments.length} selected) *
                      </label>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setGrantSelectedDepartments(departments.map((d) => d.name))}
                          className="text-ob-indigo-600 dark:text-ob-indigo-400 font-bold hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-400">|</span>
                        <button
                          type="button"
                          onClick={() => setGrantSelectedDepartments([])}
                          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Selected Badges */}
                    <div className="flex items-center gap-1 flex-wrap p-1.5 min-h-[36px] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                      {grantSelectedDepartments.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic px-1">
                          No departments selected. Choose single or multiple departments below.
                        </span>
                      ) : (
                        grantSelectedDepartments.map((deptName) => (
                          <span
                            key={deptName}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white flex items-center gap-1 shadow-2xs"
                          >
                            <span>{deptName}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setGrantSelectedDepartments((prev) => prev.filter((d) => d !== deptName))
                              }
                              className="hover:text-amber-200 cursor-pointer"
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Filter and Checkboxes */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search departments..."
                        value={grantDeptSearch}
                        onChange={(e) => setGrantDeptSearch(e.target.value)}
                        className="w-full pl-8 pr-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white font-medium"
                      />
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1 p-1 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg">
                      {departments
                        .filter((d) =>
                          !grantDeptSearch
                            ? true
                            : d.name.toLowerCase().includes(grantDeptSearch.toLowerCase()) ||
                              d.shortCode.toLowerCase().includes(grantDeptSearch.toLowerCase())
                        )
                        .map((d) => {
                          const isSelected = grantSelectedDepartments.includes(d.name);
                          return (
                            <label
                              key={d.id}
                              className={`flex items-center justify-between p-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setGrantSelectedDepartments((prev) =>
                                      isSelected
                                        ? prev.filter((x) => x !== d.name)
                                        : [...prev, d.name]
                                    );
                                  }}
                                  className="w-3.5 h-3.5 text-amber-600 rounded cursor-pointer"
                                />
                                <span>{d.name}</span>
                              </div>
                              <span className="font-mono text-[10px] text-slate-400">{d.shortCode}</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Business Justification Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Authorized cross-department audit support per VP memorandum..."
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={grantExpiresAt}
                  onChange={(e) => setGrantExpiresAt(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGrantModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  Authorize Special Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 11. Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit User Account</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <select
                  value={editFormData.department}
                  onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white cursor-pointer"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Role</label>
                  <select
                    disabled={editingUser.id === 'usr_admin_1'}
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="MAKER">MAKER</option>
                    <option value="CHECKER">CHECKER</option>
                    <option value="AUDITOR">AUDITOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    disabled={editingUser.id === 'usr_admin_1'}
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
