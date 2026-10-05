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
  ShieldAlert,
  Power,
  ArrowUpDown,
  ChevronRight,
  Fingerprint,
  ChevronDown,
  Info,
  Upload,
  BarChart3,
  TrendingUp,
  Flame,
  CalendarDays,
} from 'lucide-react';
import { UserAccount, UserRole, UserStatus, userService } from '../services/userService.ts';
import { ReportMetadata, ReportSubmission, SpecialAccessGrant, UserSession } from '../types/regulatory.ts';
import { Pagination } from './Pagination.tsx';
import { ViewTab } from './Sidebar.tsx';
import { MaximizedViewModal } from './MaximizedViewModal.tsx';
import { MaximizeButton } from './MaximizeButton.tsx';
import { submissionService } from '../services/submissionService.ts';
import { getAllReports, getReportByKey } from '../data/report-registry.ts';
import {
  DepartmentDefinition,
  getReportsForDepartment,
  getDepartmentForReport,
} from '../data/organizationHierarchy.ts';
import { departmentService } from '../services/departmentService.ts';
import { ReportTemplateStudioModal } from './ReportTemplateStudioModal.tsx';
import { NbeReportPackageImportModal } from './NbeReportPackageImportModal.tsx';
import { BulkOperationsModal } from './BulkOperationsModal.tsx';
import { bulkOperationsEngine, type BulkTargetType } from '../services/bulkOperationsEngine.ts';
import { ConfigurationGovernanceView } from './ConfigurationGovernanceView.tsx';
import { BiometricSecurityCenter } from './BiometricSecurityCenter.tsx';
import { ReportingPerformanceAnalytics } from './ReportingPerformanceAnalytics.tsx';
import { RegulatoryCalendarCard } from './RegulatoryCalendarCard.tsx';
import { DataQualityHeatmap } from './DataQualityHeatmap.tsx';

interface AdminDashboardProps {
  currentUser: UserSession;
  onNavigateTab: (tab: ViewTab) => void;
  onUserStatusChanged?: () => void;
}

type AdminSubTab =
  | 'REPORTS_OVERSIGHT'
  | 'CALENDAR'
  | 'DATA_QUALITY'
  | 'ANALYTICS'
  | 'SPECIAL_ACCESS'
  | 'PENDING'
  | 'ALL_USERS'
  | 'DEPARTMENTS'
  | 'GOVERNANCE';

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
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioReportKey, setStudioReportKey] = useState<string | undefined>(undefined);
  const [isNbeImportOpen, setIsNbeImportOpen] = useState(false);
  const [showAnalyticsWidget, setShowAnalyticsWidget] = useState<boolean>(true);
  const [showCalendarWidget, setShowCalendarWidget] = useState<boolean>(false);
  const [showHeatmapWidget, setShowHeatmapWidget] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [userSortBy, setUserSortBy] = useState<'name' | 'email' | 'role' | 'department' | 'status' | 'createdAt'>('name');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(false);

  // Inspector Modal for Admin Read-Only Detail View
  const [inspectingSub, setInspectingSub] = useState<ReportSubmission | null>(null);

  // Inspector Modal for User Details
  const [inspectingUser, setInspectingUser] = useState<UserAccount | null>(null);
  const [inspectingUserAuth, setInspectingUserAuth] = useState<any | null>(null);
  const [inspectingUserAudit, setInspectingUserAudit] = useState<any[]>([]);

  // Create User Modal State
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [createUserData, setCreateUserData] = useState<{
    name: string;
    email: string;
    role: UserRole;
    department: string;
    employeeId: string;
    phoneNumber: string;
    password?: string;
    status: UserStatus;
    auditScope?: string;
    auditorJustification?: string;
  }>({
    name: '',
    email: '',
    role: 'MAKER',
    department: '',
    employeeId: '',
    phoneNumber: '',
    password: 'password',
    status: 'ACTIVE',
    auditScope: 'ALL_DEPARTMENTS',
    auditorJustification: '',
  });

  // Maximized View States (Phase 47 Full View & Contained Scrolling)
  const [isUsersTableMaximized, setIsUsersTableMaximized] = useState(false);
  const [isDeptTableMaximized, setIsDeptTableMaximized] = useState(false);

  // Department Management States
  const [deptSearch, setDeptSearch] = useState('');
  const [deptDivisionFilter, setDeptDivisionFilter] = useState('ALL');
  const [deptStatusFilter, setDeptStatusFilter] = useState('ALL');
  const [deptViewMode, setDeptViewMode] = useState<'table' | 'hierarchy'>('table');
  const [deptPage, setDeptPage] = useState(1);
  const [deptPageSize, setDeptPageSize] = useState(6);

  // Create Department Modal State
  const [isCreateDeptOpen, setIsCreateDeptOpen] = useState(false);
  const [createDeptForm, setCreateDeptForm] = useState<{
    name: string;
    shortCode: string;
    division: string;
    description: string;
    parentId: string;
    status: string;
    primaryResponsibilitiesText: string;
    selectedReportKeys: string[];
    effectiveFrom: string;
  }>({
    name: '',
    shortCode: '',
    division: 'Credit Business & Operations Division',
    description: '',
    parentId: '',
    status: 'ACTIVE',
    primaryResponsibilitiesText: '',
    selectedReportKeys: [],
    effectiveFrom: new Date().toISOString().split('T')[0],
  });

  // Edit Department Modal State
  const [editingDept, setEditingDept] = useState<DepartmentDefinition | null>(null);
  const [editDeptForm, setEditDeptForm] = useState<{
    name: string;
    shortCode: string;
    division: string;
    description: string;
    parentId: string;
    status: string;
    primaryResponsibilitiesText: string;
    selectedReportKeys: string[];
    effectiveTo: string;
  }>({
    name: '',
    shortCode: '',
    division: '',
    description: '',
    parentId: '',
    status: 'ACTIVE',
    primaryResponsibilitiesText: '',
    selectedReportKeys: [],
    effectiveTo: '',
  });

  // Department Inspector Modal State
  const [inspectingDept, setInspectingDept] = useState<DepartmentDefinition | null>(null);
  const [inspectingDeptDetails, setInspectingDeptDetails] = useState<any | null>(null);

  // Historical Safety Notice Modal State (when deletion is rejected by backend compliance policy)
  const [historicalSafetyNotice, setHistoricalSafetyNotice] = useState<{
    isOpen: boolean;
    type: 'USER' | 'DEPARTMENT';
    entityId: string;
    entityName: string;
    reason: string;
  } | null>(null);

  // Delete Confirmation Modal State (for safe deletion of entities without historical references)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    type: 'USER' | 'DEPARTMENT';
    entityId: string;
    entityName: string;
  } | null>(null);

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
    auditScope?: string;
    auditorJustification?: string;
  }>({
    name: '',
    department: '',
    employeeId: '',
    phoneNumber: '',
    role: 'MAKER',
    status: 'ACTIVE',
    auditScope: 'ALL_DEPARTMENTS',
    auditorJustification: '',
  });

  // Action feedback notice
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Bulk Operations State (Phase 6)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkModalTarget, setBulkModalTarget] = useState<BulkTargetType>('USERS');
  const [isBulkReassignDeptOpen, setIsBulkReassignDeptOpen] = useState(false);
  const [bulkTargetDept, setBulkTargetDept] = useState('');
  const [isBulkAssignRoleOpen, setIsBulkAssignRoleOpen] = useState(false);
  const [bulkTargetRole, setBulkTargetRole] = useState<UserRole>('MAKER');

  // Biometric Management Target User (Phase 13)
  const [biometricTargetUser, setBiometricTargetUser] = useState<UserAccount | null>(null);

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

  // Filter all users with sorting
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    const matchesDept = departmentFilter === 'ALL' || u.department.toLowerCase() === departmentFilter.toLowerCase();
    return matchesSearch && matchesRole && matchesStatus && matchesDept;
  }).sort((a, b) => {
    const order = userSortOrder === 'desc' ? -1 : 1;
    const valA = (a as any)[userSortBy] || '';
    const valB = (b as any)[userSortBy] || '';
    if (typeof valA === 'string') {
      return valA.localeCompare(String(valB)) * order;
    }
    return (valA > valB ? 1 : valA < valB ? -1 : 0) * order;
  });

  // Filter departments for department management tab
  const filteredDepartments = departments.filter((d) => {
    const matchesSearch =
      !deptSearch ||
      d.name.toLowerCase().includes(deptSearch.toLowerCase()) ||
      d.shortCode.toLowerCase().includes(deptSearch.toLowerCase()) ||
      d.division.toLowerCase().includes(deptSearch.toLowerCase()) ||
      d.description.toLowerCase().includes(deptSearch.toLowerCase()) ||
      d.reportKeys.some((k) => k.toLowerCase().includes(deptSearch.toLowerCase()));
    const matchesDiv = deptDivisionFilter === 'ALL' || d.division === deptDivisionFilter;
    const matchesStatus = deptStatusFilter === 'ALL' || (d.status || 'ACTIVE') === deptStatusFilter;
    return matchesSearch && matchesDiv && matchesStatus;
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

  const paginatedDepartments = filteredDepartments.slice(
    (deptPage - 1) * deptPageSize,
    deptPage * deptPageSize
  );

  // Authorize User
  const handleToggleSelectAllVisibleUsers = (visibleUsers: UserAccount[]) => {
    const allSelected = visibleUsers.length > 0 && visibleUsers.every((u) => selectedUserIds.has(u.id));
    const next = new Set(selectedUserIds);
    if (allSelected) {
      for (const u of visibleUsers) next.delete(u.id);
    } else {
      for (const u of visibleUsers) next.add(u.id);
    }
    setSelectedUserIds(next);
  };

  const handleToggleUserSelection = (userId: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelectedUserIds(next);
  };

  const handleExecuteBulkAction = async (
    action: 'ACTIVATE' | 'DEACTIVATE' | 'ASSIGN_DEPARTMENT' | 'ASSIGN_ROLE',
    payload?: any
  ) => {
    if (selectedUserIds.size === 0) return;
    setLoading(true);
    try {
      const res = bulkOperationsEngine.executeBulkUserAction({
        userIds: Array.from(selectedUserIds),
        action,
        payload,
        actor: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          department: currentUser.department,
        },
        mode: 'ATOMIC',
      });
      if (res.success) {
        showNotice('success', res.message);
        setSelectedUserIds(new Set());
        await refreshAllData();
        if (onUserStatusChanged) onUserStatusChanged();
      } else {
        showNotice('error', res.message);
      }
    } catch (err: any) {
      showNotice('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportUsers = (format: 'CSV' | 'XLSX') => {
    try {
      const targetIds = selectedUserIds.size > 0 ? Array.from(selectedUserIds) : undefined;
      const exported = bulkOperationsEngine.exportData({
        target: 'USERS',
        format,
        actor: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          department: currentUser.department,
        },
        selectedIds: targetIds,
        filters: {
          role: roleFilter,
          status: statusFilter,
          department: departmentFilter,
        },
      });

      const blob = exported.content instanceof Uint8Array
        ? new Blob([exported.content as any], { type: exported.mimeType })
        : new Blob([exported.content], { type: exported.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exported.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showNotice('success', `Exported ${exported.rowsCount} users (${format}) with formula injection protection.`);
    } catch (err: any) {
      showNotice('error', err.message);
    }
  };

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

  // Create User Handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUserData.name.trim() || !createUserData.email.trim()) {
      showNotice('error', 'Name and corporate email are required.');
      return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createUserData,
          user: currentUser,
          adminName: currentUser.name,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice('success', data.message || `User ${createUserData.name} created successfully.`);
        setIsCreateUserOpen(false);
        setCreateUserData({
          name: '',
          email: '',
          role: 'MAKER',
          department: departments[0]?.name || 'Credit Operations & Portfolio Management',
          employeeId: '',
          phoneNumber: '',
          password: 'password',
          status: 'ACTIVE',
          auditScope: 'ALL_DEPARTMENTS',
          auditorJustification: '',
        });
        await refreshAllData();
      } else {
        showNotice('error', data.message || data.error || 'Failed to create user account.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Error communicating with user service.');
    }
  };

  // Inspect User Handler
  const handleInspectUser = async (user: UserAccount) => {
    setInspectingUser(user);
    try {
      const [authRes, auditRes] = await Promise.all([
        fetch(`/api/users/${user.id}/authorized-reports`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/users/${user.id}/audit`).then((r) => (r.ok ? r.json() : null)),
      ]);
      setInspectingUserAuth(authRes);
      setInspectingUserAudit(Array.isArray(auditRes) ? auditRes : userService.getUserAuditHistory(user.id));
    } catch {
      setInspectingUserAudit(userService.getUserAuditHistory(user.id));
    }
  };

  // Pre-flight Delete Check for User (Historical Safety)
  const handleInitiateDeleteUser = async (userId: string, userName: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/can-delete`);
      const check = await res.json();
      if (!check.canDelete) {
        setHistoricalSafetyNotice({
          isOpen: true,
          type: 'USER',
          entityId: userId,
          entityName: userName,
          reason: check.reason || 'This account is referenced in statutory historical reporting records.',
        });
      } else {
        setDeleteConfirmation({
          isOpen: true,
          type: 'USER',
          entityId: userId,
          entityName: userName,
        });
      }
    } catch {
      // Local fallback check
      const localCheck = userService.canDeleteUser(userId);
      if (!localCheck.canDelete) {
        setHistoricalSafetyNotice({
          isOpen: true,
          type: 'USER',
          entityId: userId,
          entityName: userName,
          reason: localCheck.reason || 'Account cannot be deleted due to historical reporting linkages.',
        });
      } else {
        setDeleteConfirmation({
          isOpen: true,
          type: 'USER',
          entityId: userId,
          entityName: userName,
        });
      }
    }
  };

  // Confirm True Delete User (for safe accounts)
  const handleConfirmDeleteUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice('success', 'User account permanently deleted.');
      } else {
        showNotice('error', data.message || data.error || 'Failed to delete user.');
      }
      setDeleteConfirmation(null);
      await refreshAllData();
    } catch (err: any) {
      showNotice('error', err.message || 'Error deleting user.');
      setDeleteConfirmation(null);
    }
  };

  // Deactivate User from Historical Safety Modal
  const handleDeactivateFromSafety = async (userId: string) => {
    setHistoricalSafetyNotice(null);
    const user = users.find((u) => u.id === userId);
    if (user) {
      await handleToggleDisable(user);
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
      auditScope: (user as any).auditScope || 'ALL_DEPARTMENTS',
      auditorJustification: (user as any).auditorJustification || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editFormData,
          user: currentUser,
          adminName: currentUser.name,
        }),
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

  // Department Management Handlers
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createDeptForm.name.trim() || !createDeptForm.shortCode.trim()) {
      showNotice('error', 'Department name and short code are required.');
      return;
    }
    const responsibilities = createDeptForm.primaryResponsibilitiesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createDeptForm.name.trim(),
          shortCode: createDeptForm.shortCode.trim().toUpperCase(),
          division: createDeptForm.division.trim(),
          description: createDeptForm.description.trim(),
          parentId: createDeptForm.parentId || null,
          status: createDeptForm.status,
          primaryResponsibilities: responsibilities,
          reportKeys: createDeptForm.selectedReportKeys,
          effectiveFrom: createDeptForm.effectiveFrom,
          user: currentUser,
          adminName: currentUser.name,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice('success', data.message || `Department "${createDeptForm.name}" created successfully.`);
        setIsCreateDeptOpen(false);
        setCreateDeptForm({
          name: '',
          shortCode: '',
          division: 'Credit Business & Operations Division',
          description: '',
          parentId: '',
          status: 'ACTIVE',
          primaryResponsibilitiesText: '',
          selectedReportKeys: [],
          effectiveFrom: new Date().toISOString().split('T')[0],
        });
        await refreshAllData();
      } else {
        showNotice('error', data.message || data.error || 'Failed to create department.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Error communicating with department service.');
    }
  };

  const handleInspectDepartment = async (dept: DepartmentDefinition) => {
    setInspectingDept(dept);
    try {
      const [deptRes, auditRes] = await Promise.all([
        fetch(`/api/departments/${dept.id}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/departments/${dept.id}/audit`).then((r) => (r.ok ? r.json() : null)),
      ]);
      setInspectingDeptDetails({
        ...deptRes,
        auditLogs: Array.isArray(auditRes) ? auditRes : [],
      });
    } catch {
      setInspectingDeptDetails(null);
    }
  };

  const handleOpenEditDeptModal = (dept: DepartmentDefinition) => {
    setEditingDept(dept);
    setEditDeptForm({
      name: dept.name,
      shortCode: dept.shortCode,
      division: dept.division,
      description: dept.description,
      parentId: dept.parentId || '',
      status: dept.status || 'ACTIVE',
      primaryResponsibilitiesText: dept.primaryResponsibilities?.join('\n') || '',
      selectedReportKeys: [...dept.reportKeys],
      effectiveTo: dept.effectiveTo || '',
    });
  };

  const handleSaveEditDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    const responsibilities = editDeptForm.primaryResponsibilitiesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/departments/${editingDept.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editDeptForm.name.trim(),
          shortCode: editDeptForm.shortCode.trim().toUpperCase(),
          division: editDeptForm.division.trim(),
          description: editDeptForm.description.trim(),
          parentId: editDeptForm.parentId || null,
          status: editDeptForm.status,
          primaryResponsibilities: responsibilities,
          reportKeys: editDeptForm.selectedReportKeys,
          effectiveTo: editDeptForm.effectiveTo || null,
          user: currentUser,
          adminName: currentUser.name,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice('success', `Department "${editDeptForm.name}" updated successfully.`);
        setEditingDept(null);
        await refreshAllData();
      } else {
        showNotice('error', data.message || data.error || 'Failed to update department.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Error updating department.');
    }
  };

  const handleToggleDeptStatus = async (dept: DepartmentDefinition) => {
    const nextStatus = (dept.status || 'ACTIVE') === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`/api/departments/${dept.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          user: currentUser,
          adminName: currentUser.name,
          effectiveTo: nextStatus === 'INACTIVE' ? new Date().toISOString() : null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice('success', `Department "${dept.name}" status updated to ${nextStatus}.`);
        await refreshAllData();
      } else {
        showNotice('error', data.message || data.error || 'Failed to update department status.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Error updating department status.');
    }
  };

  // Pre-flight Delete Check for Department (Historical Safety)
  const handleInitiateDeleteDept = async (dept: DepartmentDefinition) => {
    try {
      const res = await fetch(`/api/departments/${dept.id}/can-delete`);
      const check = await res.json();
      if (!check.canDelete) {
        setHistoricalSafetyNotice({
          isOpen: true,
          type: 'DEPARTMENT',
          entityId: dept.id,
          entityName: dept.name,
          reason: check.reason || 'This department has historical reporting or active officer assignments.',
        });
      } else {
        setDeleteConfirmation({
          isOpen: true,
          type: 'DEPARTMENT',
          entityId: dept.id,
          entityName: dept.name,
        });
      }
    } catch {
      const localCheck = departmentService.canDeleteDepartment(dept.id);
      if (!localCheck.canDelete) {
        setHistoricalSafetyNotice({
          isOpen: true,
          type: 'DEPARTMENT',
          entityId: dept.id,
          entityName: dept.name,
          reason: localCheck.reason || 'Department cannot be safely deleted.',
        });
      } else {
        setDeleteConfirmation({
          isOpen: true,
          type: 'DEPARTMENT',
          entityId: dept.id,
          entityName: dept.name,
        });
      }
    }
  };

  const handleConfirmDeleteDept = async (deptId: string) => {
    try {
      const res = await fetch(`/api/departments/${deptId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser, adminName: currentUser.name }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotice('success', 'Department permanently removed.');
      } else {
        showNotice('error', data.message || data.error || 'Failed to delete department.');
      }
      setDeleteConfirmation(null);
      await refreshAllData();
    } catch (err: any) {
      showNotice('error', err.message || 'Error deleting department.');
      setDeleteConfirmation(null);
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
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-ob-indigo-500 text-white uppercase tracking-wider">
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
            type="button"
            onClick={() => {
              setStudioReportKey(undefined);
              setIsStudioOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press bg-ob-green-50 dark:bg-ob-green-950 text-ob-green-800 dark:text-ob-green-300 border border-ob-green-300 dark:border-ob-green-700 hover:bg-ob-green-100 dark:hover:bg-ob-green-900"
            title="Open Dynamic Template Studio to configure report return structure, formulas, and versioning"
          >
            <Layers className="w-3.5 h-3.5 text-ob-green-600" />
            <span>Template Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNbeImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-800 dark:text-ob-indigo-300 border border-ob-indigo-300 dark:border-ob-indigo-700 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-900"
            title="Import an NBE-provided JSON report definition package and normalize into a governed DRAFT"
          >
            <Upload className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400" />
            <span>Import NBE JSON</span>
          </button>

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
            onClick={() => setActiveSubTab('CALENDAR')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press ${
              activeSubTab === 'CALENDAR'
                ? 'bg-ob-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Regulatory Calendar: Upcoming NBE statutory filing deadlines with chronological timeline visualization"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Regulatory Calendar</span>
          </button>

          <button
            onClick={() => setActiveSubTab('DATA_QUALITY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press ${
              activeSubTab === 'DATA_QUALITY'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Data Quality Heatmap: Recharts visualization highlighting departments with recurring validation errors"
          >
            <Flame className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            <span>Data Quality Heatmap</span>
          </button>

          <button
            onClick={() => setActiveSubTab('ANALYTICS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press ${
              activeSubTab === 'ANALYTICS'
                ? 'bg-ob-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Regulatory Performance: Submission Acceptance Rate, Average Turnaround Time, and Pending Review Aging"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Regulatory Performance</span>
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
            <span>User Accounts & RBAC</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('DEPARTMENTS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 touch-manipulation touch-press ${
              activeSubTab === 'DEPARTMENTS'
                ? 'bg-ob-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Departments & Structure</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {departments.length}
            </span>
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
            <span>Governance & Versioning</span>
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

              <button
                type="button"
                onClick={() => setShowCalendarWidget(!showCalendarWidget)}
                className={`text-xs border rounded-lg px-2.5 py-1 font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  showCalendarWidget
                    ? 'bg-ob-indigo-600 text-white border-ob-indigo-700 shadow-2xs'
                    : 'bg-ob-indigo-50 dark:bg-ob-indigo-950/70 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-900 border-ob-indigo-200 dark:border-ob-indigo-800 text-ob-indigo-700 dark:text-ob-indigo-300'
                }`}
                title={showCalendarWidget ? 'Hide Regulatory Calendar' : 'Show Regulatory Calendar Timeline'}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{showCalendarWidget ? 'Calendar (On)' : 'Calendar'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowHeatmapWidget(!showHeatmapWidget)}
                className={`text-xs border rounded-lg px-2.5 py-1 font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  showHeatmapWidget
                    ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                    : 'bg-rose-50 dark:bg-rose-950/70 hover:bg-rose-100 dark:hover:bg-rose-900 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                }`}
                title={showHeatmapWidget ? 'Hide Quality Heatmap' : 'Show Data Quality Heatmap'}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>{showHeatmapWidget ? 'Quality Heatmap (On)' : 'Quality Heatmap'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAnalyticsWidget(!showAnalyticsWidget)}
                className={`text-xs border rounded-lg px-2.5 py-1 font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  showAnalyticsWidget
                    ? 'bg-ob-indigo-600 text-white border-ob-indigo-700 shadow-2xs'
                    : 'bg-ob-indigo-50 dark:bg-ob-indigo-950/70 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-900 border-ob-indigo-200 dark:border-ob-indigo-800 text-ob-indigo-700 dark:text-ob-indigo-300'
                }`}
                title={showAnalyticsWidget ? 'Hide Regulatory Performance Widget' : 'Show Regulatory Performance Widget'}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{showAnalyticsWidget ? 'Performance (On)' : 'Performance'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('ANALYTICS')}
                className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2.5 py-1 font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Open Full Regulatory Performance Suite & SLA Deep Dive"
              >
                <span>Regulatory Suite</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Embedded Regulatory Calendar Widget */}
          {showCalendarWidget && (
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 shrink-0">
              <RegulatoryCalendarCard
                currentUser={currentUser}
                onInspectSubmission={(sub) => setInspectingSub(sub)}
                onViewAllSubmissions={() => {
                  setShowCalendarWidget(false);
                  setReportsPage(1);
                }}
                onOpenReport={(rk) => {
                  setStudioReportKey(rk);
                  setIsStudioOpen(true);
                }}
              />
            </div>
          )}

          {/* Embedded Data Quality Heatmap Widget */}
          {showHeatmapWidget && (
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 shrink-0">
              <DataQualityHeatmap
                currentUser={currentUser}
                onInspectReport={(rk) => {
                  setStudioReportKey(rk);
                  setIsStudioOpen(true);
                }}
                onNavigateToSubmissions={() => {
                  setShowHeatmapWidget(false);
                  setReportsPage(1);
                }}
              />
            </div>
          )}

          {/* Embedded Regulatory Performance Widget */}
          {showAnalyticsWidget && (
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 shrink-0">
              <ReportingPerformanceAnalytics
                currentUser={currentUser}
                compact={true}
                onViewAllSubmissions={() => setActiveSubTab('ANALYTICS')}
              />
            </div>
          )}

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

      {/* Tab Content: REGULATORY CALENDAR DASHBOARD CARD & TIMELINE */}
      {activeSubTab === 'CALENDAR' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <RegulatoryCalendarCard
            currentUser={currentUser}
            onInspectSubmission={(sub) => setInspectingSub(sub)}
            onViewAllSubmissions={() => setActiveSubTab('REPORTS_OVERSIGHT')}
            onOpenReport={(rk) => {
              setStudioReportKey(rk);
              setIsStudioOpen(true);
            }}
          />
        </div>
      )}

      {/* Tab Content: DATA QUALITY HEATMAP & RECURRING VALIDATION ERRORS */}
      {activeSubTab === 'DATA_QUALITY' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <DataQualityHeatmap
            currentUser={currentUser}
            onInspectReport={(rk) => {
              setStudioReportKey(rk);
              setIsStudioOpen(true);
            }}
            onNavigateToSubmissions={() => setActiveSubTab('REPORTS_OVERSIGHT')}
          />
        </div>
      )}

      {/* Tab Content: REPORTING PERFORMANCE ANALYTICS WIDGET & CHARTS */}
      {activeSubTab === 'ANALYTICS' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ReportingPerformanceAnalytics
            currentUser={currentUser}
            onViewAllSubmissions={() => setActiveSubTab('REPORTS_OVERSIGHT')}
          />
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
          {/* User Filtering & Action Toolbar */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setAllUsersPage(1);
                }}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">Administrator</option>
                <option value="MAKER">Maker</option>
                <option value="CHECKER">Checker</option>
                <option value="AUDITOR">Auditor</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setAllUsersPage(1);
                }}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING_APPROVAL">Pending Authorization</option>
                <option value="DISABLED">Disabled</option>
              </select>

              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setAllUsersPage(1);
                }}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer max-w-xs truncate"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                <span className="text-[11px] text-slate-400 font-medium">Sort:</span>
                <select
                  value={userSortBy}
                  onChange={(e) => setUserSortBy(e.target.value as any)}
                  className="text-xs bg-transparent text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="name">Name</option>
                  <option value="email">Email</option>
                  <option value="role">Role</option>
                  <option value="department">Department</option>
                  <option value="status">Status</option>
                  <option value="createdAt">Date Created</option>
                </select>
                <button
                  type="button"
                  onClick={() => setUserSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                  title={`Order: ${userSortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
                >
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkModalTarget('USERS');
                  setIsBulkModalOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
                title="Open Transactional Bulk Import & Management Modal"
              >
                <Layers className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400" />
                <span>Bulk Import & Ops</span>
              </button>

              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={() => handleExportUsers('CSV')}
                  className="px-2 py-1 text-slate-700 dark:text-slate-300 hover:text-ob-indigo-600 text-[11px] font-bold cursor-pointer"
                  title="Export to CSV (Formula-Injection Protected)"
                >
                  Export CSV
                </button>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => handleExportUsers('XLSX')}
                  className="px-2 py-1 text-slate-700 dark:text-slate-300 hover:text-ob-indigo-600 text-[11px] font-bold cursor-pointer"
                  title="Export to Excel (Formula-Injection Protected)"
                >
                  Export XLSX
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateUserOpen(true)}
                className="px-3 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create User</span>
              </button>

              <MaximizeButton
                onClick={() => setIsUsersTableMaximized(true)}
                title="Maximize User Governance Directory (Esc to restore)"
              />
            </div>
          </div>

          {/* BULK ACTION RIBBON (When users are selected) */}
          {selectedUserIds.size > 0 && (
            <div className="px-3 py-2 bg-ob-indigo-50 dark:bg-ob-indigo-950/70 border-b border-ob-indigo-200 dark:border-ob-indigo-800 flex flex-wrap items-center justify-between gap-2 text-xs animate-in slide-in-from-top-1">
              <div className="flex items-center gap-2 text-ob-indigo-900 dark:text-ob-indigo-200 font-bold">
                <span className="w-5 h-5 rounded-full bg-ob-indigo-600 text-white flex items-center justify-center text-[10px]">
                  {selectedUserIds.size}
                </span>
                <span>User(s) Selected</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleExecuteBulkAction('ACTIVATE')}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Activate
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteBulkAction('DEACTIVATE')}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Deactivate
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkReassignDeptOpen(true)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer hover:bg-slate-50"
                >
                  Assign Dept...
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkAssignRoleOpen(true)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer hover:bg-slate-50"
                >
                  Assign Role...
                </button>
                <button
                  type="button"
                  onClick={() => handleExportUsers('CSV')}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer hover:bg-slate-50"
                >
                  Export ({selectedUserIds.size})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUserIds(new Set())}
                  className="px-2 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="overflow-x-auto min-w-full touch-scroll-x">
              <table className="min-w-[750px] w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={paginatedAllUsers.length > 0 && paginatedAllUsers.every((u) => selectedUserIds.has(u.id))}
                      onChange={() => handleToggleSelectAllVisibleUsers(paginatedAllUsers)}
                      className="w-3.5 h-3.5 text-ob-indigo-600 rounded cursor-pointer"
                      title="Select / deselect all visible users"
                    />
                  </th>
                  <th className="py-2.5 px-3">Officer & Email</th>
                  <th className="py-2.5 px-3">Role & Scope</th>
                  <th className="py-2.5 px-3">Account Status</th>
                  <th className="py-2.5 px-3">Department & Employee ID</th>
                  <th className="py-2.5 px-3">Authorized Returns</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedAllUsers.map((user) => {
                  const initials = user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();
                  const isSelected = selectedUserIds.has(user.id);
                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-ob-indigo-50/50 dark:bg-ob-indigo-950/30' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleUserSelection(user.id)}
                          className="w-3.5 h-3.5 text-ob-indigo-600 rounded cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-ob-indigo-100 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 font-bold flex items-center justify-center text-[11px] shrink-0 border border-ob-indigo-200 dark:border-ob-indigo-800">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{user.name}</span>
                              {user.specialAccessGrants && user.specialAccessGrants.length > 0 && (
                                <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded text-[9px] font-bold" title="Has active special cross-department grant">
                                  Special Access
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            user.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : user.role === 'AUDITOR'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : user.role === 'CHECKER'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          {user.role}
                        </span>
                        {user.role === 'AUDITOR' && (user as any).auditScope && (
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">Scope: {(user as any).auditScope}</div>
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
                        <div className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-xs" title={user.department}>
                          {user.department}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">{user.employeeId}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleInspectUser(user)}
                          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[11px] transition-colors cursor-pointer"
                          title="Click to inspect authorized returns"
                        >
                          {user.role === 'ADMIN' || user.role === 'AUDITOR' ? 'All 24 Statutory' : 'Inspect Access'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleInspectUser(user)}
                          className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Inspect details, authorized returns, and audit trail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setBiometricTargetUser(user)}
                          className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                          title="Manage Biometrics & Registered Authenticators"
                        >
                          <Fingerprint className="w-3.5 h-3.5" />
                        </button>

                        {user.status === 'PENDING_APPROVAL' ? (
                          <button
                            type="button"
                            onClick={() => handleAuthorizeUser(user.id)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            title="Authorize user access"
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
                              title={user.status === 'ACTIVE' ? 'Disable account' : 'Re-enable account'}
                            >
                              {user.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                            </button>
                          )
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(user)}
                          className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Edit user profile"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {user.id !== 'usr_admin_1' && (
                          <button
                            type="button"
                            onClick={() => handleInitiateDeleteUser(user.id, user.name)}
                            className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                            title="Delete user account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
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

      {/* 8. Tab Content 5: DEPARTMENTS & HIERARCHY */}
      {activeSubTab === 'DEPARTMENTS' && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          {/* Department Filtering & Action Toolbar */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter departments, code, report..."
                  value={deptSearch}
                  onChange={(e) => {
                    setDeptSearch(e.target.value);
                    setDeptPage(1);
                  }}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 font-medium"
                />
              </div>

              <select
                value={deptDivisionFilter}
                onChange={(e) => {
                  setDeptDivisionFilter(e.target.value);
                  setDeptPage(1);
                }}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer max-w-xs truncate"
              >
                <option value="ALL">All Divisions</option>
                {Array.from(new Set(departments.map((d) => d.division))).sort().map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>

              <select
                value={deptStatusFilter}
                onChange={(e) => {
                  setDeptStatusFilter(e.target.value);
                  setDeptPage(1);
                }}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-ob-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="RESTRUCTURED">Restructured</option>
                <option value="PLANNED">Planned</option>
              </select>

              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setDeptViewMode('table')}
                  className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                    deptViewMode === 'table'
                      ? 'bg-ob-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Table View
                </button>
                <button
                  type="button"
                  onClick={() => setDeptViewMode('hierarchy')}
                  className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                    deptViewMode === 'hierarchy'
                      ? 'bg-ob-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Hierarchy Tree
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreateDeptOpen(true)}
                className="px-3 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Create Department</span>
              </button>

              <MaximizeButton
                onClick={() => setIsDeptTableMaximized(true)}
                title="Maximize Department & Reports Matrix (Esc to restore)"
              />
            </div>
          </div>

          {/* Department Body: Table View */}
          {deptViewMode === 'table' ? (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="overflow-x-auto min-w-full touch-scroll-x">
                <table className="min-w-[800px] w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                      <th className="py-2.5 px-3">Department & Code</th>
                      <th className="py-2.5 px-3">Division & Hierarchy Level</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Assigned Officers</th>
                      <th className="py-2.5 px-3">Statutory Returns</th>
                      <th className="py-2.5 px-3">Historical Submissions</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedDepartments.map((dept) => {
                      const deptUsers = users.filter(
                        (u) => u.department && (u.department.toLowerCase() === dept.name.toLowerCase() || u.department === dept.id)
                      );
                      const makersCount = deptUsers.filter((u) => u.role === 'MAKER').length;
                      const checkersCount = deptUsers.filter((u) => u.role === 'CHECKER').length;
                      const subsCount = submissions.filter(
                        (s) => s.department && (s.department.toLowerCase() === dept.name.toLowerCase() || (s as any).departmentId === dept.id)
                      ).length;
                      const isInactive = (dept.status || 'ACTIVE') === 'INACTIVE';

                      return (
                        <tr key={dept.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-ob-indigo-700 dark:text-ob-indigo-300 border border-slate-200 dark:border-slate-700">
                                {dept.shortCode}
                              </span>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{dept.name}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-sm" title={dept.description}>
                                  {dept.description}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-xs" title={dept.division}>
                              {dept.division}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {dept.hierarchyLevel !== undefined ? `Level ${dept.hierarchyLevel} Unit` : 'Operational Department'}
                              {dept.parentId ? ` (under ${departments.find((d) => d.id === dept.parentId)?.shortCode || dept.parentId})` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                (dept.status || 'ACTIVE') === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : (dept.status || 'ACTIVE') === 'INACTIVE'
                                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  : (dept.status || 'ACTIVE') === 'RESTRUCTURED'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              }`}
                            >
                              {dept.status || 'ACTIVE'}
                            </span>
                            {dept.effectiveTo && (
                              <div className="text-[9px] text-slate-400 font-mono mt-0.5">Until {dept.effectiveTo.split('T')[0]}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{deptUsers.length}</span>
                              <span className="text-[10px] text-slate-500">
                                ({makersCount}M / {checkersCount}C)
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800">
                                {dept.reportKeys.length} Returns
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                              {subsCount} submissions
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleInspectDepartment(dept)}
                              className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Inspect department hierarchy, officers, and reports"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditDeptModal(dept)}
                              className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Edit department structure & responsibilities"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleDeptStatus(dept)}
                              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                isInactive
                                  ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60'
                                  : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60'
                              }`}
                              title={isInactive ? 'Activate Department' : 'Deactivate Department (Retire)'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleInitiateDeleteDept(dept)}
                              className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                              title="Delete department (historical safety verified)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Department Body: Hierarchy Tree View */
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
                <span className="font-semibold">Authoritative Oromia Bank Organizational Hierarchy Tree</span>
              </div>
              <div className="space-y-3">
                {Array.from(new Set(departments.map((d) => d.division))).sort().map((divName) => {
                  const divDepts = departments.filter((d) => d.division === divName);
                  return (
                    <div key={divName} className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 p-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
                          <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">{divName}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {divDepts.length} Units
                        </span>
                      </div>
                      <div className="mt-2 space-y-2 pl-4 border-l-2 border-ob-indigo-200 dark:border-ob-indigo-800/60 ml-2">
                        {divDepts.map((d) => {
                          const deptUsers = users.filter(
                            (u) => u.department && (u.department.toLowerCase() === d.name.toLowerCase() || u.department === d.id)
                          );
                          return (
                            <div key={d.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 flex items-center justify-between shadow-2xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800">
                                    {d.shortCode}
                                  </span>
                                  <span className="font-bold text-xs text-slate-900 dark:text-white">{d.name}</span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    (d.status || 'ACTIVE') === 'ACTIVE'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  }`}>
                                    {d.status || 'ACTIVE'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                  {d.description}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                                  {deptUsers.length} Officers
                                </span>
                                <span className="text-[11px] font-mono text-ob-indigo-600 dark:text-ob-indigo-400">
                                  {d.reportKeys.length} Reports
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleInspectDepartment(d)}
                                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded text-xs font-semibold cursor-pointer"
                                >
                                  Inspect
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Department Pagination */}
          {deptViewMode === 'table' && (
            <div className="shrink-0 p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
              <Pagination
                currentPage={deptPage}
                totalItems={filteredDepartments.length}
                pageSize={deptPageSize}
                onPageChange={setDeptPage}
                onPageSizeChange={setDeptPageSize}
                pageSizeOptions={[6, 12, 20]}
              />
            </div>
          )}
        </div>
      )}

      {/* 9. Tab Content 6: GOVERNANCE & MATRIX */}
      {activeSubTab === 'GOVERNANCE' && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {/* Phase 8 Configuration Governance, Versioning & Governed Rollback */}
          <ConfigurationGovernanceView currentUser={currentUser} />

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
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 12. Create User Modal */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-600 flex items-center justify-center border border-ob-indigo-200 dark:border-ob-indigo-800">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create New User Account</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Provision bank officer account with backend RBAC & SSOT department linkage
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateUserOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Almaz Bekele"
                    value={createUserData.name}
                    onChange={(e) => setCreateUserData({ ...createUserData, name: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Corporate Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. almaz.bekele@oromiabank.com"
                    value={createUserData.email}
                    onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Department *</label>
                  <select
                    required
                    value={createUserData.department}
                    onChange={(e) => setCreateUserData({ ...createUserData, department: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium cursor-pointer"
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name} ({d.shortCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">System Role *</label>
                  <select
                    required
                    value={createUserData.role}
                    onChange={(e) => setCreateUserData({ ...createUserData, role: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium cursor-pointer"
                  >
                    <option value="MAKER">Maker (Reporting Preparer)</option>
                    <option value="CHECKER">Checker (Review Officer)</option>
                    <option value="AUDITOR">Auditor (Internal / External Audit)</option>
                    <option value="ADMIN">Administrator (Governance & RBAC)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OB-2026-8801"
                    value={createUserData.employeeId}
                    onChange={(e) => setCreateUserData({ ...createUserData, employeeId: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +251 91 123 4567"
                    value={createUserData.phoneNumber}
                    onChange={(e) => setCreateUserData({ ...createUserData, phoneNumber: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Account Status</label>
                  <select
                    value={createUserData.status}
                    onChange={(e) => setCreateUserData({ ...createUserData, status: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium cursor-pointer"
                  >
                    <option value="ACTIVE">Active (Immediate Access)</option>
                    <option value="PENDING_APPROVAL">Pending Approval (Hold)</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Initial Password</label>
                  <input
                    type="text"
                    value={createUserData.password}
                    onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                    placeholder="password"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {createUserData.role === 'AUDITOR' && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-2">
                  <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-bold">
                    <Shield className="w-4 h-4" />
                    <span>Auditor Scope & Statutory Mandate</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Audit Scope *
                    </label>
                    <select
                      value={createUserData.auditScope}
                      onChange={(e) => setCreateUserData({ ...createUserData, auditScope: e.target.value })}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 rounded-lg text-slate-900 dark:text-white text-xs"
                    >
                      <option value="ALL_DEPARTMENTS">All Bank Units & 24 Statutory Returns (Universal Inspection)</option>
                      <option value="CREDIT_RISK">Credit & Lending Operations Directorate</option>
                      <option value="TREASURY_INVESTMENTS">Finance, Treasury & Foreign Exchange</option>
                      <option value="TRADE_SERVICES">International Banking & Trade Services</option>
                      <option value="DIGITAL_CHANNELS">Digital Channels & Payment Systems</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Auditor Appointment Justification
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Approved by Board Audit Committee Res #2026/04"
                      value={createUserData.auditorJustification}
                      onChange={(e) => setCreateUserData({ ...createUserData, auditorJustification: e.target.value })}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 rounded-lg text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-lg cursor-pointer shadow-2xs"
                >
                  Create User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 13. User Details & RBAC Inspector Modal */}
      {inspectingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-ob-indigo-100 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 font-bold flex items-center justify-center border border-ob-indigo-200 dark:border-ob-indigo-800">
                  {inspectingUser.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{inspectingUser.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inspectingUser.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : inspectingUser.role === 'AUDITOR'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : inspectingUser.role === 'CHECKER'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {inspectingUser.role}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inspectingUser.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : inspectingUser.status === 'PENDING_APPROVAL'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {inspectingUser.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">{inspectingUser.email} • ID: {inspectingUser.employeeId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInspectingUser(null);
                  setInspectingUserAuth(null);
                  setInspectingUserAudit([]);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Department</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block" title={inspectingUser.department}>
                  {inspectingUser.department}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Phone</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{inspectingUser.phoneNumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Registered Date</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{new Date(inspectingUser.createdAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Authorized By</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{(inspectingUser as any).authorizedBy || 'System Bootstrap'}</span>
              </div>
            </div>

            {/* Authorized Reports Matrix (Dynamically resolved from SSOT) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-ob-indigo-600" />
                  <span>Authorized Regulatory Reporting Scope</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {inspectingUser.role === 'ADMIN' || inspectingUser.role === 'AUDITOR'
                    ? 'All 24 Returns Authorized (Universal Access)'
                    : `${(inspectingUserAuth?.accessibleReportKeys || getReportsForDepartment(inspectingUser.department)).length} Returns Authorized`}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2.5 border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto text-xs space-y-1">
                {(inspectingUserAuth?.accessibleReportKeys || getReportsForDepartment(inspectingUser.department)).length === 0 ? (
                  <p className="text-slate-400 italic text-[11px] p-2 text-center">No statutory returns currently mapped to this user's department.</p>
                ) : (
                  (inspectingUserAuth?.accessibleReportKeys || getReportsForDepartment(inspectingUser.department)).map((key: string) => {
                    const r = getReportByKey(key);
                    return (
                      <div key={key} className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300">
                            {r?.Code || key}
                          </span>
                          <span className="text-slate-900 dark:text-white font-medium text-xs truncate max-w-xs">{r?.Title || key}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{r?.Frequency || 'Statutory'}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Special Cross-Department Grants (if any) */}
            {inspectingUser.specialAccessGrants && inspectingUser.specialAccessGrants.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  <span>Active Cross-Department Special Access Grants</span>
                </span>
                <div className="space-y-1.5">
                  {inspectingUser.specialAccessGrants.map((grant) => (
                    <div key={grant.id} className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                          <span>{grant.reportKey ? `Return: ${grant.reportKey}` : `Departments: ${grant.departments?.join(', ') || grant.department}`}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">Reason: {grant.reason}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Granted by {grant.grantedBy} on {new Date(grant.grantedAt).toLocaleDateString()}</div>
                      </div>
                      <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-[10px] font-bold rounded">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Audit Trail History */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-ob-indigo-600" />
                <span>Regulatory Audit & Activity History</span>
              </span>
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2.5 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                {inspectingUserAudit.length === 0 ? (
                  <p className="text-slate-400 italic text-[11px] p-2 text-center">No audit logs recorded for this account yet.</p>
                ) : (
                  inspectingUserAudit.map((log: any, idx: number) => (
                    <div key={log.id || idx} className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span className="font-bold text-ob-indigo-600 dark:text-ob-indigo-400">{log.action}</span>
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-[11px] mt-0.5">{log.details}</p>
                      {log.actorName && (
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Actor: {log.actorName} ({log.actorRole})</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setInspectingUser(null);
                  setInspectingUserAuth(null);
                  setInspectingUserAudit([]);
                }}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 14. Create Department Modal */}
      {isCreateDeptOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-600 flex items-center justify-center border border-ob-indigo-200 dark:border-ob-indigo-800">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create New Department</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Codify new operational unit with hierarchy & statutory return linkages
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateDeptOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDepartment} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Department Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Treasury Operations"
                    value={createDeptForm.name}
                    onChange={(e) => setCreateDeptForm({ ...createDeptForm, name: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Short Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. TREAS"
                    value={createDeptForm.shortCode}
                    onChange={(e) => setCreateDeptForm({ ...createDeptForm, shortCode: e.target.value.toUpperCase() })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Division / Directorate *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Finance & Treasury Division"
                    value={createDeptForm.division}
                    onChange={(e) => setCreateDeptForm({ ...createDeptForm, division: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Parent Department (Optional)</label>
                  <select
                    value={createDeptForm.parentId}
                    onChange={(e) => setCreateDeptForm({ ...createDeptForm, parentId: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium cursor-pointer"
                  >
                    <option value="">-- Root Level Department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.shortCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Lifecycle Status</label>
                  <select
                    value={createDeptForm.status}
                    onChange={(e) => setCreateDeptForm({ ...createDeptForm, status: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium cursor-pointer"
                  >
                    <option value="ACTIVE">Active (Fully Operational)</option>
                    <option value="INACTIVE">Inactive (Dormant)</option>
                    <option value="RESTRUCTURED">Restructured (Transitioning)</option>
                    <option value="PLANNED">Planned (Future Entity)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Effective From Date</label>
                  <input
                    type="date"
                    value={createDeptForm.effectiveFrom}
                    onChange={(e) => setCreateDeptForm({ ...createDeptForm, effectiveFrom: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Operational mandate and compliance scope..."
                  value={createDeptForm.description}
                  onChange={(e) => setCreateDeptForm({ ...createDeptForm, description: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Responsibilities (One per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g.&#10;Portfolio classification & monitoring&#10;NBE prudential reporting"
                  value={createDeptForm.primaryResponsibilitiesText}
                  onChange={(e) => setCreateDeptForm({ ...createDeptForm, primaryResponsibilitiesText: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono text-[11px]"
                />
              </div>

              {/* Related Reports Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Linked Statutory Reports ({createDeptForm.selectedReportKeys.length} selected)
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCreateDeptForm({ ...createDeptForm, selectedReportKeys: templates.map((t) => t.ReturnKey) })}
                      className="text-ob-indigo-600 dark:text-ob-indigo-400 font-bold hover:underline cursor-pointer"
                    >
                      Select All 24
                    </button>
                    <span className="text-slate-400">|</span>
                    <button
                      type="button"
                      onClick={() => setCreateDeptForm({ ...createDeptForm, selectedReportKeys: [] })}
                      className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 p-1 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg">
                  {templates.map((t) => {
                    const isSelected = createDeptForm.selectedReportKeys.includes(t.ReturnKey);
                    return (
                      <label
                        key={t.ReturnKey}
                        className={`flex items-center justify-between p-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-ob-indigo-50 dark:bg-ob-indigo-950/60 text-ob-indigo-900 dark:text-ob-indigo-200 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const next = isSelected
                                ? createDeptForm.selectedReportKeys.filter((k) => k !== t.ReturnKey)
                                : [...createDeptForm.selectedReportKeys, t.ReturnKey];
                              setCreateDeptForm({ ...createDeptForm, selectedReportKeys: next });
                            }}
                            className="w-3.5 h-3.5 text-ob-indigo-600 rounded cursor-pointer"
                          />
                          <span className="truncate max-w-xs">{t.Title}</span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">{t.Code}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateDeptOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-lg cursor-pointer shadow-2xs"
                >
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 15. Edit Department Modal */}
      {editingDept && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-600 flex items-center justify-center border border-ob-indigo-200 dark:border-ob-indigo-800">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Department: {editingDept.name}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Update code, responsibilities, hierarchy & effective dates
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDept(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditDepartment} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Department Name *</label>
                  <input
                    type="text"
                    required
                    value={editDeptForm.name}
                    onChange={(e) => setEditDeptForm({ ...editDeptForm, name: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Short Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={editDeptForm.shortCode}
                    onChange={(e) => setEditDeptForm({ ...editDeptForm, shortCode: e.target.value.toUpperCase() })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Division / Directorate *</label>
                  <input
                    type="text"
                    required
                    value={editDeptForm.division}
                    onChange={(e) => setEditDeptForm({ ...editDeptForm, division: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Parent Department</label>
                  <select
                    value={editDeptForm.parentId}
                    onChange={(e) => setEditDeptForm({ ...editDeptForm, parentId: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium cursor-pointer"
                  >
                    <option value="">-- None (Root Operational Level) --</option>
                    {departments
                      .filter((d) => d.id !== editingDept.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.shortCode})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Lifecycle Status</label>
                  <select
                    value={editDeptForm.status}
                    onChange={(e) => setEditDeptForm({ ...editDeptForm, status: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium cursor-pointer"
                  >
                    <option value="ACTIVE">Active (Fully Operational)</option>
                    <option value="INACTIVE">Inactive (Dormant)</option>
                    <option value="RESTRUCTURED">Restructured (Transitioning)</option>
                    <option value="PLANNED">Planned (Future Entity)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Effective Until (Retire Date)</label>
                  <input
                    type="date"
                    value={editDeptForm.effectiveTo ? editDeptForm.effectiveTo.split('T')[0] : ''}
                    onChange={(e) => setEditDeptForm({ ...editDeptForm, effectiveTo: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editDeptForm.description}
                  onChange={(e) => setEditDeptForm({ ...editDeptForm, description: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Responsibilities (One per line)
                </label>
                <textarea
                  rows={3}
                  value={editDeptForm.primaryResponsibilitiesText}
                  onChange={(e) => setEditDeptForm({ ...editDeptForm, primaryResponsibilitiesText: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono text-[11px]"
                />
              </div>

              {/* Related Reports Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Linked Statutory Reports ({editDeptForm.selectedReportKeys.length} selected)
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setEditDeptForm({ ...editDeptForm, selectedReportKeys: templates.map((t) => t.ReturnKey) })}
                      className="text-ob-indigo-600 dark:text-ob-indigo-400 font-bold hover:underline cursor-pointer"
                    >
                      Select All 24
                    </button>
                    <span className="text-slate-400">|</span>
                    <button
                      type="button"
                      onClick={() => setEditDeptForm({ ...editDeptForm, selectedReportKeys: [] })}
                      className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 p-1 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg">
                  {templates.map((t) => {
                    const isSelected = editDeptForm.selectedReportKeys.includes(t.ReturnKey);
                    return (
                      <label
                        key={t.ReturnKey}
                        className={`flex items-center justify-between p-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-ob-indigo-50 dark:bg-ob-indigo-950/60 text-ob-indigo-900 dark:text-ob-indigo-200 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const next = isSelected
                                ? editDeptForm.selectedReportKeys.filter((k) => k !== t.ReturnKey)
                                : [...editDeptForm.selectedReportKeys, t.ReturnKey];
                              setEditDeptForm({ ...editDeptForm, selectedReportKeys: next });
                            }}
                            className="w-3.5 h-3.5 text-ob-indigo-600 rounded cursor-pointer"
                          />
                          <span className="truncate max-w-xs">{t.Title}</span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">{t.Code}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-lg cursor-pointer shadow-2xs"
                >
                  Save Department Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 16. Department Details & Hierarchy Inspector Modal */}
      {inspectingDept && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-ob-indigo-100 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 font-bold flex items-center justify-center border border-ob-indigo-200 dark:border-ob-indigo-800 font-mono text-xs">
                  {inspectingDept.shortCode}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{inspectingDept.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        (inspectingDept.status || 'ACTIVE') === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : (inspectingDept.status || 'ACTIVE') === 'INACTIVE'
                          ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {inspectingDept.status || 'ACTIVE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{inspectingDept.division}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInspectingDept(null);
                  setInspectingDeptDetails(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Department Hierarchy Position */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                <span>Hierarchy Structure:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {inspectingDept.hierarchyLevel !== undefined ? `Level ${inspectingDept.hierarchyLevel} Node` : 'Standard Unit'}
                </span>
              </div>
              <div className="text-slate-800 dark:text-slate-200 font-medium">
                {inspectingDeptDetails?.ancestors && inspectingDeptDetails.ancestors.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {inspectingDeptDetails.ancestors.map((anc: any) => (
                      <React.Fragment key={anc.id}>
                        <span className="font-bold text-ob-indigo-600 dark:text-ob-indigo-400">{anc.name}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </React.Fragment>
                    ))}
                    <span className="font-bold text-slate-900 dark:text-white underline">{inspectingDept.name}</span>
                  </div>
                ) : (
                  <span>Direct Sub-unit under {inspectingDept.division}</span>
                )}
              </div>
            </div>

            {/* Metrics Triad Cards */}
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Assigned Officers</span>
                <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                  {inspectingDeptDetails?.usersCount !== undefined
                    ? inspectingDeptDetails.usersCount
                    : users.filter((u) => u.department && (u.department.toLowerCase() === inspectingDept.name.toLowerCase() || u.department === inspectingDept.id)).length}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  ({inspectingDeptDetails?.makersCount || 0} Maker / {inspectingDeptDetails?.checkersCount || 0} Checker)
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Statutory Returns</span>
                <span className="text-base font-bold text-ob-indigo-600 dark:text-ob-indigo-400 font-mono">
                  {inspectingDept.reportKeys.length}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Assigned Templates</span>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Historical Submissions</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {inspectingDeptDetails?.submissionsCount !== undefined
                    ? inspectingDeptDetails.submissionsCount
                    : submissions.filter((s) => s.department && (s.department.toLowerCase() === inspectingDept.name.toLowerCase() || (s as any).departmentId === inspectingDept.id)).length}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Preserved in Ledger</span>
              </div>
            </div>

            {/* Department Responsibilities */}
            {inspectingDept.primaryResponsibilities && inspectingDept.primaryResponsibilities.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Mandated Responsibilities</span>
                <ul className="text-xs text-slate-600 dark:text-slate-300 list-disc list-inside bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-0.5">
                  {inspectingDept.primaryResponsibilities.map((resp, i) => (
                    <li key={i}>{resp}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Assigned Officers List */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-ob-indigo-600" />
                <span>Assigned Department Officers</span>
              </span>
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2 max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 text-xs">
                {(inspectingDeptDetails?.assignedUsers || users.filter((u) => u.department && (u.department.toLowerCase() === inspectingDept.name.toLowerCase() || u.department === inspectingDept.id))).length === 0 ? (
                  <p className="text-slate-400 italic text-[11px] p-2 text-center">No officers currently assigned to this department.</p>
                ) : (
                  (inspectingDeptDetails?.assignedUsers || users.filter((u) => u.department && (u.department.toLowerCase() === inspectingDept.name.toLowerCase() || u.department === inspectingDept.id))).map((officer: any) => (
                    <div key={officer.id} className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800 mb-1 last:mb-0">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{officer.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{officer.email} • {officer.employeeId}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {officer.role}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {officer.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Department Audit Trail */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-ob-indigo-600" />
                <span>Department Configuration Audit History</span>
              </span>
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2 max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                {!inspectingDeptDetails?.auditLogs || inspectingDeptDetails.auditLogs.length === 0 ? (
                  <p className="text-slate-400 italic text-[11px] p-2 text-center">No structural configuration events recorded.</p>
                ) : (
                  inspectingDeptDetails.auditLogs.map((log: any, idx: number) => (
                    <div key={log.id || idx} className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span className="font-bold text-ob-indigo-600 dark:text-ob-indigo-400">{log.action}</span>
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-[11px] mt-0.5">{log.details}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setInspectingDept(null);
                  setInspectingDeptDetails(null);
                }}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 17. Historical Safety Notice Modal (NBE Compliance Protection) */}
      {historicalSafetyNotice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-300 dark:border-amber-800">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Deletion Blocked by Historical Compliance Policy
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  National Bank of Ethiopia (NBE) statutory retention mandates prohibit destructive deletion.
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Target Entity: {historicalSafetyNotice.entityName}</span>
              </div>
              <p className="leading-relaxed">{historicalSafetyNotice.reason}</p>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              To preserve regulatory chain of custody while preventing new submissions, you can <strong>deactivate / retire</strong> this {historicalSafetyNotice.type === 'USER' ? 'user account' : 'department'}. Deactivation maintains auditability for central bank inspections.
            </p>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setHistoricalSafetyNotice(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Dismiss Notice
              </button>
              <button
                type="button"
                onClick={() => {
                  if (historicalSafetyNotice.type === 'USER') {
                    handleDeactivateFromSafety(historicalSafetyNotice.entityId);
                  } else {
                    const dept = departments.find((d) => d.id === historicalSafetyNotice.entityId);
                    if (dept) handleToggleDeptStatus(dept);
                    setHistoricalSafetyNotice(null);
                  }
                }}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Deactivate Entity Instead</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 18. Delete Confirmation Modal (for safe entities) */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-800">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Confirm Permanent Deletion
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Backend pre-flight verification confirmed zero historical reporting references.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete the {deleteConfirmation.type === 'USER' ? 'user account' : 'department'}{' '}
              <strong className="text-slate-900 dark:text-white">"{deleteConfirmation.entityName}"</strong>? This operation is irreversible.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmation.type === 'USER') {
                    handleConfirmDeleteUser(deleteConfirmation.entityId);
                  } else {
                    handleConfirmDeleteDept(deleteConfirmation.entityId);
                  }
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow-2xs"
              >
                Confirm Permanent Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* DYNAMIC REPORT DEFINITION & TEMPLATE STUDIO MODAL */}
      {isStudioOpen && (
        <ReportTemplateStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          reportKey={studioReportKey}
          currentUser={currentUser}
          onSuccess={(msg) => {
            showNotice('success', msg);
            refreshAllData();
          }}
        />
      )}

      {/* NBE JSON REPORT PACKAGE IMPORT MODAL (Phase 31) */}
      {isNbeImportOpen && (
        <NbeReportPackageImportModal
          isOpen={isNbeImportOpen}
          onClose={() => setIsNbeImportOpen(false)}
          currentUser={currentUser}
          onImportSuccess={(key, msg) => {
            showNotice('success', msg);
            refreshAllData();
          }}
          onOpenStudio={(key) => {
            setStudioReportKey(key);
            setIsStudioOpen(true);
          }}
        />
      )}

      {/* BULK OPERATIONS & FILE WORKFLOW MODAL */}
      {isBulkModalOpen && (
        <BulkOperationsModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          onSuccess={(msg) => {
            showNotice('success', msg);
            refreshAllData();
            if (onUserStatusChanged) onUserStatusChanged();
          }}
          currentUser={{
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            role: currentUser.role,
            department: currentUser.department,
          }}
          initialTarget={bulkModalTarget}
        />
      )}

      {/* MODAL: BULK REASSIGN DEPARTMENT */}
      {isBulkReassignDeptOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Bulk Department Reassignment ({selectedUserIds.size} Users)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select target department for selected officers. Effective permissions will be recalculated automatically.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Department
              </label>
              <select
                value={bulkTargetDept}
                onChange={(e) => setBulkTargetDept(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                <option value="">-- Choose Department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsBulkReassignDeptOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!bulkTargetDept}
                onClick={() => {
                  handleExecuteBulkAction('ASSIGN_DEPARTMENT', { department: bulkTargetDept });
                  setIsBulkReassignDeptOpen(false);
                }}
                className="px-4 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl"
              >
                Apply Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK ASSIGN ROLE */}
      {isBulkAssignRoleOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Bulk Role Assignment ({selectedUserIds.size} Users)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Assign authoritative NBE compliance role. Note: Segregation of duties applies.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Role
              </label>
              <select
                value={bulkTargetRole}
                onChange={(e) => setBulkTargetRole(e.target.value as UserRole)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                <option value="MAKER">Maker (Report Preparer)</option>
                <option value="CHECKER">Checker (Report Approver)</option>
                <option value="AUDITOR">Auditor (Independent Compliance)</option>
                <option value="ADMIN">Administrator (Governance Oversight)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsBulkAssignRoleOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExecuteBulkAction('ASSIGN_ROLE', { role: bulkTargetRole });
                  setIsBulkAssignRoleOpen(false);
                }}
                className="px-4 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold text-xs rounded-xl"
              >
                Apply Role Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMINISTRATIVE BIOMETRIC SECURITY CENTER MODAL (PHASE 13) */}
      {biometricTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <BiometricSecurityCenter
              currentUser={currentUser}
              targetEmail={biometricTargetUser.email}
              onClose={() => setBiometricTargetUser(null)}
              isEmbedded={true}
            />
          </div>
        </div>
      )}

      {/* PHASE 47: FULL VIEW / MAXIMIZED USERS DIRECTORY */}
      {isUsersTableMaximized && (
        <MaximizedViewModal
          isOpen={isUsersTableMaximized}
          onClose={() => setIsUsersTableMaximized(false)}
          title="User Governance & Role Directory"
          badge="Live SSOT"
          subtitle="Complete bank-wide regulatory officer profiles, dual-control credentials & NBE return authorizations"
          icon={Users}
        >
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search officers by name, email, department or employee ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setAllUsersPage(1);
                  }}
                  className="w-full text-xs bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value as any);
                    setAllUsersPage(1);
                  }}
                  className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                >
                  <option value="ALL">All Roles</option>
                  <option value="MAKER">Maker</option>
                  <option value="CHECKER">Checker</option>
                  <option value="AUDITOR">Auditor</option>
                  <option value="ADMIN">Administrator</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setAllUsersPage(1);
                  }}
                  className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                </select>

                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(true)}
                  className="px-3 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create User</span>
                </button>
              </div>
            </div>

            {/* Maximized Users Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto min-w-full touch-scroll-x">
                <table className="min-w-[800px] w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-10">
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={paginatedAllUsers.length > 0 && paginatedAllUsers.every((u) => selectedUserIds.has(u.id))}
                          onChange={() => handleToggleSelectAllVisibleUsers(paginatedAllUsers)}
                          className="w-3.5 h-3.5 text-ob-indigo-600 rounded cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3">Officer & Email</th>
                      <th className="py-3 px-3">Role & Scope</th>
                      <th className="py-3 px-3">Account Status</th>
                      <th className="py-3 px-3">Department & Employee ID</th>
                      <th className="py-3 px-3">Authorized Returns</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedAllUsers.map((u) => {
                      const isPending = u.status === 'PENDING_APPROVAL';
                      const isCurrentUser = u.email === currentUser.email;

                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                            selectedUserIds.has(u.id) ? 'bg-ob-indigo-50/50 dark:bg-ob-indigo-950/40' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.has(u.id)}
                              onChange={() => handleToggleSelectUser(u.id)}
                              className="w-3.5 h-3.5 text-ob-indigo-600 rounded cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isCurrentUser && (
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1 rounded">You</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.role === 'ADMIN'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                  : u.role === 'CHECKER'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  : u.role === 'AUDITOR'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : u.status === 'INACTIVE'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-800 dark:text-slate-200">{u.department || 'All Departments'}</div>
                            <div className="text-[10px] font-mono text-slate-400">{u.employeeId || 'EMP-REG'}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {u.allowedReportKeys && u.allowedReportKeys.length > 0 ? (
                                u.allowedReportKeys.slice(0, 3).map((rk) => (
                                  <span key={rk} className="px-1.5 py-0.2 rounded font-mono text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {rk}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-400">All Returns</span>
                              )}
                              {u.allowedReportKeys && u.allowedReportKeys.length > 3 && (
                                <span className="text-[9px] text-slate-400">+{u.allowedReportKeys.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingUser(u)}
                                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-ob-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Edit User"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setBiometricTargetUser(u)}
                                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-purple-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Biometric Security Center"
                              >
                                <Fingerprint className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            <Pagination
              currentPage={allUsersPage}
              pageSize={allUsersPageSize}
              totalItems={filteredAllUsers.length}
              onPageChange={(p) => setAllUsersPage(p)}
              onPageSizeChange={(sz) => {
                setAllUsersPageSize(sz);
                setAllUsersPage(1);
              }}
              itemName="users"
            />
          </div>
        </MaximizedViewModal>
      )}

      {/* PHASE 47: FULL VIEW / MAXIMIZED DEPARTMENTS & REPORTS MATRIX */}
      {isDeptTableMaximized && (
        <MaximizedViewModal
          isOpen={isDeptTableMaximized}
          onClose={() => setIsDeptTableMaximized(false)}
          title="Departments & Statutory Reports Matrix"
          badge="Governance Directory"
          subtitle="Oromia Bank organizational units, division hierarchies, assigned officers, and NBE returns"
          icon={Building2}
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search departments by name, code, division..."
                  value={deptSearch}
                  onChange={(e) => {
                    setDeptSearch(e.target.value);
                    setDeptPage(1);
                  }}
                  className="w-full text-xs bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateDeptOpen(true)}
                  className="px-3 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Create Department</span>
                </button>
              </div>
            </div>

            {/* Maximized Departments Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto min-w-full touch-scroll-x">
                <table className="min-w-[850px] w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-10">
                      <th className="py-3 px-3">Department & Code</th>
                      <th className="py-3 px-3">Division & Hierarchy Level</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Assigned Officers</th>
                      <th className="py-3 px-3">Statutory Returns</th>
                      <th className="py-3 px-3">Historical Submissions</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedDepartments.map((dept) => {
                      const deptOfficers = users.filter((u) => u.department === dept.name);
                      const deptReturns = getReportsForDepartment(dept.name);
                      const deptSubs = submissions.filter((s) => s.department === dept.name);

                      return (
                        <tr key={dept.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{dept.name}</span>
                              <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1 rounded border border-slate-200 dark:border-slate-700">
                                {dept.shortCode}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {dept.description}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-800 dark:text-slate-200">{dept.division}</div>
                            <div className="text-[10px] text-slate-400">{dept.hierarchyLevel}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                dept.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {dept.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white">{deptOfficers.length} Officers</div>
                            <div className="text-[10px] text-slate-400">
                              {deptOfficers.filter((o) => o.role === 'MAKER').length} Makers ·{' '}
                              {deptOfficers.filter((o) => o.role === 'CHECKER').length} Checkers
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-ob-indigo-600 dark:text-ob-indigo-400">
                              {deptReturns.length} Statutory Returns
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white">{deptSubs.length} Filings</div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDeptForEdit(dept);
                                setIsEditDeptOpen(true);
                              }}
                              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-ob-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Edit Department"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              currentPage={deptPage}
              pageSize={deptPageSize}
              totalItems={filteredDepartments.length}
              onPageChange={(p) => setDeptPage(p)}
              onPageSizeChange={(sz) => {
                setDeptPageSize(sz);
                setDeptPage(1);
              }}
              itemName="departments"
            />
          </div>
        </MaximizedViewModal>
      )}
    </div>
  );
};
