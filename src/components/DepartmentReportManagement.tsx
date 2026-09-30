/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Layers,
  ArrowRight,
  Shield,
  HelpCircle,
  Network,
  FolderTree,
  Calendar,
  Clock,
  Sparkles,
  Users,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Upload,
  History,
} from 'lucide-react';
import { DepartmentDefinition } from '../data/organizationHierarchy.ts';
import { departmentService } from '../services/departmentService.ts';
import {
  getAllReports,
  getReportByKey,
  addReportType,
  updateReportType,
  removeReportType,
  subscribeReports,
} from '../data/report-registry.ts';
import { ReportMetadata, UserSession } from '../types/regulatory.ts';
import { userService } from '../services/userService.ts';
import { submissionService } from '../services/submissionService.ts';
import { Pagination } from './Pagination.tsx';
import { vibrate, haptics } from '../utils/haptics.ts';
import { BulkImportModal } from './BulkImportModal.tsx';
import { ReportVersionHistoryModal } from './ReportVersionHistoryModal.tsx';
import { ChangeHistoryView } from './ChangeHistoryView.tsx';
import { ReportTemplateStudioModal } from './ReportTemplateStudioModal.tsx';

// =========================================================================
// SUB-COMPONENT: DepartmentEditor
// =========================================================================

export interface DepartmentEditorProps {
  currentUser: UserSession;
  onNotice?: (message: string, type?: 'SUCCESS' | 'ERROR') => void;
  reports?: ReportMetadata[];
}

export const DepartmentEditor: React.FC<DepartmentEditorProps> = ({
  currentUser,
  onNotice,
  reports: passedReports,
}) => {
  const [departments, setDepartments] = useState<DepartmentDefinition[]>(() => departmentService.getAll());
  const [reports, setReports] = useState<ReportMetadata[]>(() => passedReports || getAllReports());

  const [searchQuery, setSearchQuery] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [activeDeptForEdit, setActiveDeptForEdit] = useState<DepartmentDefinition | null>(null);
  const [activeDeptForDelete, setActiveDeptForDelete] = useState<DepartmentDefinition | null>(null);
  const [fallbackDeptForDelete, setFallbackDeptForDelete] = useState<string>('');

  // Form Data & Validation
  const [formData, setFormData] = useState<{
    name: string;
    shortCode: string;
    division: string;
    description: string;
    primaryResponsibilitiesText: string;
    selectedReportKeys: string[];
  }>({
    name: '',
    shortCode: '',
    division: 'Credit Business & Operations Division',
    description: '',
    primaryResponsibilitiesText: '',
    selectedReportKeys: [],
  });

  const [formErrors, setFormErrors] = useState<{
    name?: string;
    shortCode?: string;
    division?: string;
  }>({});

  const [reportSearchInModal, setReportSearchInModal] = useState('');
  const [isReportDropdownOpenInModal, setIsReportDropdownOpenInModal] = useState(false);

  // Subscriptions
  useEffect(() => {
    const unsubDepts = departmentService.subscribe((updated) => {
      setDepartments(updated);
    });
    const unsubReports = subscribeReports((updated) => {
      setReports(updated);
    });
    return () => {
      unsubDepts();
      unsubReports();
    };
  }, []);

  const triggerNotice = (message: string, type: 'SUCCESS' | 'ERROR' = 'SUCCESS') => {
    if (onNotice) {
      onNotice(message, type);
    }
  };

  // Divisions list
  const availableDivisions = useMemo(() => {
    const defaults = [
      'Credit Business & Operations Division',
      'Finance, Treasury & Accounts Division',
      'Risk Management & Compliance Directorate',
      'Digital Banking & Channels Division',
      'Trade Services & International Banking',
      'Internal Audit & Quality Assurance',
    ];
    const extracted = departments.map((d) => d.division || 'General Operations Division');
    return Array.from(new Set([...defaults, ...extracted])).sort();
  }, [departments]);

  // Filtered list
  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      if (divisionFilter !== 'ALL' && d.division !== divisionFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        d.name.toLowerCase().includes(q) ||
        d.shortCode.toLowerCase().includes(q) ||
        d.division.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.reportKeys.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [departments, divisionFilter, searchQuery]);

  const getDepartmentStats = (deptName: string) => {
    const allUsers = userService.getAll();
    const assignedOfficers = allUsers.filter(
      (u) => u.department && u.department.toLowerCase() === deptName.toLowerCase()
    );
    const makers = assignedOfficers.filter((u) => u.role === 'MAKER');
    const checkers = assignedOfficers.filter((u) => u.role === 'CHECKER');
    const subs = submissionService.getAll().filter(
      (s) => s.department && s.department.toLowerCase() === deptName.toLowerCase()
    );
    return {
      totalUsers: assignedOfficers.length,
      makersCount: makers.length,
      checkersCount: checkers.length,
      submissionsCount: subs.length,
    };
  };

  // Validation logic to prevent duplicates
  const validateForm = (isEdit: boolean, currentId?: string): boolean => {
    const errors: { name?: string; shortCode?: string; division?: string } = {};
    const trimmedName = formData.name.trim();
    const trimmedCode = formData.shortCode.trim().toUpperCase();

    if (!trimmedName) {
      errors.name = 'Department name is required.';
    } else {
      const duplicateName = departments.find(
        (d) =>
          d.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
          (!isEdit || d.id !== currentId)
      );
      if (duplicateName) {
        errors.name = `A department named "${trimmedName}" already exists.`;
      }
    }

    if (!trimmedCode) {
      errors.shortCode = 'Short code is required.';
    } else if (trimmedCode.length < 2) {
      errors.shortCode = 'Short code must be at least 2 characters.';
    } else {
      const duplicateCode = departments.find(
        (d) =>
          d.shortCode.trim().toUpperCase() === trimmedCode &&
          (!isEdit || d.id !== currentId)
      );
      if (duplicateCode) {
        errors.shortCode = `Short code "${trimmedCode}" is already in use by "${duplicateCode.name}".`;
      }
    }

    if (!formData.division.trim()) {
      errors.division = 'Division / Directorate is required.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      shortCode: '',
      division: availableDivisions[0] || 'Credit Business & Operations Division',
      description: '',
      primaryResponsibilitiesText: '',
      selectedReportKeys: [],
    });
    setFormErrors({});
    setReportSearchInModal('');
    setIsReportDropdownOpenInModal(false);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (dept: DepartmentDefinition) => {
    setActiveDeptForEdit(dept);
    setFormData({
      name: dept.name,
      shortCode: dept.shortCode,
      division: dept.division,
      description: dept.description,
      primaryResponsibilitiesText: dept.primaryResponsibilities?.join('\n') || '',
      selectedReportKeys: [...dept.reportKeys],
    });
    setFormErrors({});
    setReportSearchInModal('');
    setIsReportDropdownOpenInModal(false);
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteModal = (dept: DepartmentDefinition) => {
    setActiveDeptForDelete(dept);
    const fallbacks = departments.filter((d) => d.id !== dept.id);
    setFallbackDeptForDelete(fallbacks[0]?.name || '');
    setIsDeleteModalOpen(true);
  };

  const handleToggleReportSelection = (reportKey: string) => {
    setFormData((prev) => {
      const exists = prev.selectedReportKeys.includes(reportKey);
      const next = exists
        ? prev.selectedReportKeys.filter((k) => k !== reportKey)
        : [...prev.selectedReportKeys, reportKey];
      return { ...prev, selectedReportKeys: next };
    });
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) {
      triggerNotice('Please resolve duplicate or missing department fields.', 'ERROR');
      return;
    }

    const resp = departmentService.addDepartment(
      {
        name: formData.name.trim(),
        shortCode: formData.shortCode.trim().toUpperCase(),
        division: formData.division.trim(),
        description: formData.description.trim(),
        primaryResponsibilities: formData.primaryResponsibilitiesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        reportKeys: formData.selectedReportKeys,
      },
      currentUser.name
    );

    if (resp.success) {
      triggerNotice(resp.message || 'Department created successfully!');
      setIsAddModalOpen(false);
    } else {
      triggerNotice(resp.message || 'Failed to create department.', 'ERROR');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeptForEdit) return;

    if (!validateForm(true, activeDeptForEdit.id)) {
      triggerNotice('Please resolve duplicate or missing department fields.', 'ERROR');
      return;
    }

    const resp = departmentService.updateDepartment(
      activeDeptForEdit.id,
      {
        name: formData.name.trim(),
        shortCode: formData.shortCode.trim().toUpperCase(),
        division: formData.division.trim(),
        description: formData.description.trim(),
        primaryResponsibilities: formData.primaryResponsibilitiesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        reportKeys: formData.selectedReportKeys,
      },
      currentUser.name
    );

    if (resp.success) {
      triggerNotice(resp.message || 'Department updated successfully!');
      setIsEditModalOpen(false);
      setActiveDeptForEdit(null);
    } else {
      triggerNotice(resp.message || 'Failed to update department.', 'ERROR');
    }
  };

  const handleConfirmDelete = () => {
    if (!activeDeptForDelete) return;

    const resp = departmentService.removeDepartment(
      activeDeptForDelete.id,
      fallbackDeptForDelete,
      currentUser.name
    );

    if (resp.success) {
      triggerNotice(resp.message || 'Department removed successfully.');
      setIsDeleteModalOpen(false);
      setActiveDeptForDelete(null);
    } else {
      triggerNotice(resp.message || 'Failed to remove department.', 'ERROR');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Sub-Header / Action Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Active Bank Departments
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {filteredDepartments.length} of {departments.length}
              </span>
            </div>
            <span className="hidden sm:inline text-xs text-slate-400">|</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Division:</span>
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="text-xs px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="ALL">All Divisions</option>
                {availableDivisions.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search departments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-7 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="min-h-[36px] px-3.5 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer touch-press"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Department</span>
            </button>
          </div>
        </div>

        {/* Departments Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-3 px-4">Department & Short Code</th>
                <th className="py-3 px-4">Division Directorate</th>
                <th className="py-3 px-4">Authorized Returns</th>
                <th className="py-3 px-4 text-center">Assigned Officers</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No departments found matching your search.
                  </td>
                </tr>
              ) : (
                filteredDepartments
                  .slice((page - 1) * pageSize, page * pageSize)
                  .map((dept) => {
                    const stats = getDepartmentStats(dept.name);
                    return (
                      <tr
                        key={dept.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{dept.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-ob-indigo-50 dark:bg-ob-indigo-950 text-ob-indigo-700 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800">
                              {dept.shortCode}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 max-w-md">
                            {dept.description}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          {dept.division}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                            {dept.reportKeys.length === 0 ? (
                              <span className="text-[11px] text-slate-400 italic">
                                No returns assigned (Supervisory/Support)
                              </span>
                            ) : (
                              <>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-ob-green-50 dark:bg-ob-green-950 text-ob-green-800 dark:text-ob-green-300 border border-ob-green-300 dark:border-ob-green-700">
                                  {dept.reportKeys.length} return{dept.reportKeys.length > 1 ? 's' : ''}
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  ({dept.reportKeys.slice(0, 3).join(', ')}
                                  {dept.reportKeys.length > 3 ? '...' : ''})
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {stats.makersCount} Makers
                            </span>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                              {stats.checkersCount} Checkers
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(dept)}
                              className="p-1.5 text-ob-indigo-600 dark:text-ob-indigo-400 hover:bg-ob-indigo-50 dark:hover:bg-ob-indigo-950/60 rounded-lg transition-colors cursor-pointer"
                              title="Edit Department & Linkages"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(dept)}
                              className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                              title="Remove Department"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
          <Pagination
            currentPage={page}
            totalItems={filteredDepartments.length}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* MODAL: ADD DEPARTMENT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-ob-indigo-500/10 dark:bg-ob-indigo-500/20 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Add New Bank Department
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Create a new operational or regulatory department with SSOT sync.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Treasury Operations & Liquidity"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                    }}
                    className={`w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-white focus:outline-none ${
                      formErrors.name
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-slate-200 dark:border-slate-700 focus:border-ob-indigo-500'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {formErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Short Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    placeholder="e.g. TOLM"
                    value={formData.shortCode}
                    onChange={(e) => {
                      setFormData({ ...formData, shortCode: e.target.value.toUpperCase() });
                      if (formErrors.shortCode) setFormErrors({ ...formErrors, shortCode: undefined });
                    }}
                    className={`w-full p-2.5 font-mono uppercase bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-white focus:outline-none ${
                      formErrors.shortCode
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-slate-200 dark:border-slate-700 focus:border-ob-indigo-500'
                    }`}
                  />
                  {formErrors.shortCode && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {formErrors.shortCode}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Division / Directorate *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Finance & Accounts Division"
                  value={formData.division}
                  onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Mandate summary..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500"
                />
              </div>

              {/* Multi-Select Returns */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Link Regulatory Returns ({formData.selectedReportKeys.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsReportDropdownOpenInModal((prev) => !prev)}
                    className="text-[11px] font-bold text-ob-indigo-600 dark:text-ob-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isReportDropdownOpenInModal ? 'Collapse Selection' : 'Browse All Returns'}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${isReportDropdownOpenInModal ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap p-2 min-h-[42px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                  {formData.selectedReportKeys.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">
                      No returns linked yet.
                    </span>
                  ) : (
                    formData.selectedReportKeys.map((key) => (
                      <span
                        key={key}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-ob-indigo-600 text-white flex items-center gap-1 shadow-2xs"
                      >
                        <span>{key}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleReportSelection(key)}
                          className="hover:text-ob-indigo-200 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {isReportDropdownOpenInModal && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-900 space-y-2 max-h-48 overflow-y-auto animate-in fade-in">
                    <input
                      type="text"
                      placeholder="Filter reports..."
                      value={reportSearchInModal}
                      onChange={(e) => setReportSearchInModal(e.target.value)}
                      className="w-full text-xs p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <div className="grid grid-cols-1 gap-1">
                      {reports
                        .filter((r) => {
                          if (!reportSearchInModal) return true;
                          const q = reportSearchInModal.toLowerCase();
                          return r.ReturnKey.toLowerCase().includes(q) || r.Title.toLowerCase().includes(q);
                        })
                        .map((r) => {
                          const isSelected = formData.selectedReportKeys.includes(r.ReturnKey);
                          return (
                            <label
                              key={r.ReturnKey}
                              className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-ob-indigo-50 dark:bg-ob-indigo-950/80 font-bold text-ob-indigo-900 dark:text-ob-indigo-200'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleReportSelection(r.ReturnKey)}
                                  className="rounded text-ob-indigo-600 focus:ring-ob-indigo-500 cursor-pointer"
                                />
                                <span className="font-mono text-[11px]">{r.ReturnKey}</span>
                                <span className="text-[10px] text-slate-500 truncate max-w-xs">{r.Title}</span>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                {r.Frequency}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer touch-press"
                >
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DEPARTMENT */}
      {isEditModalOpen && activeDeptForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-ob-indigo-500/10 dark:bg-ob-indigo-500/20 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Department: {activeDeptForEdit.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Modifications will update user accounts and active submissions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                    }}
                    className={`w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-white focus:outline-none ${
                      formErrors.name
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-slate-200 dark:border-slate-700 focus:border-ob-indigo-500'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {formErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Short Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={formData.shortCode}
                    onChange={(e) => {
                      setFormData({ ...formData, shortCode: e.target.value.toUpperCase() });
                      if (formErrors.shortCode) setFormErrors({ ...formErrors, shortCode: undefined });
                    }}
                    className={`w-full p-2.5 font-mono uppercase bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-white focus:outline-none ${
                      formErrors.shortCode
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-slate-200 dark:border-slate-700 focus:border-ob-indigo-500'
                    }`}
                  />
                  {formErrors.shortCode && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {formErrors.shortCode}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Division / Directorate *
                </label>
                <input
                  type="text"
                  required
                  value={formData.division}
                  onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-ob-indigo-500"
                />
              </div>

              {/* Returns multi-select */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Linked Returns ({formData.selectedReportKeys.length} active)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsReportDropdownOpenInModal((prev) => !prev)}
                    className="text-[11px] font-bold text-ob-indigo-600 dark:text-ob-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isReportDropdownOpenInModal ? 'Hide Return Selector' : 'Change Returns'}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${isReportDropdownOpenInModal ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap p-2 min-h-[42px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                  {formData.selectedReportKeys.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">
                      No returns linked.
                    </span>
                  ) : (
                    formData.selectedReportKeys.map((key) => (
                      <span
                        key={key}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-ob-indigo-600 text-white flex items-center gap-1 shadow-2xs"
                      >
                        <span>{key}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleReportSelection(key)}
                          className="hover:text-ob-indigo-200 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {isReportDropdownOpenInModal && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-900 space-y-2 max-h-48 overflow-y-auto animate-in fade-in">
                    <input
                      type="text"
                      placeholder="Filter reports..."
                      value={reportSearchInModal}
                      onChange={(e) => setReportSearchInModal(e.target.value)}
                      className="w-full text-xs p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <div className="grid grid-cols-1 gap-1">
                      {reports
                        .filter((r) => {
                          if (!reportSearchInModal) return true;
                          const q = reportSearchInModal.toLowerCase();
                          return r.ReturnKey.toLowerCase().includes(q) || r.Title.toLowerCase().includes(q);
                        })
                        .map((r) => {
                          const isSelected = formData.selectedReportKeys.includes(r.ReturnKey);
                          return (
                            <label
                              key={r.ReturnKey}
                              className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-ob-indigo-50 dark:bg-ob-indigo-950/80 font-bold text-ob-indigo-900 dark:text-ob-indigo-200'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleReportSelection(r.ReturnKey)}
                                  className="rounded text-ob-indigo-600 focus:ring-ob-indigo-500 cursor-pointer"
                                />
                                <span className="font-mono text-[11px]">{r.ReturnKey}</span>
                                <span className="text-[10px] text-slate-500 truncate max-w-xs">{r.Title}</span>
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer touch-press"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE DEPARTMENT */}
      {isDeleteModalOpen && activeDeptForDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Remove Department: {activeDeptForDelete.name}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Decommissioning of department
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">{activeDeptForDelete.name}</span> from the bank organizational hierarchy?
            </p>

            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                Reassign Existing Officers & Returns to:
              </label>
              <select
                value={fallbackDeptForDelete}
                onChange={(e) => setFallbackDeptForDelete(e.target.value)}
                className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {departments
                  .filter((d) => d.id !== activeDeptForDelete.id)
                  .map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} ({d.shortCode})
                    </option>
                  ))}
              </select>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                Any Makers or Checkers assigned to {activeDeptForDelete.name} will be reassigned smoothly to maintain access governance.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer touch-press"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: ReportTypeEditor
// =========================================================================

export interface ReportTypeEditorProps {
  currentUser: UserSession;
  onNotice?: (message: string, type?: 'SUCCESS' | 'ERROR') => void;
  departments?: DepartmentDefinition[];
}

export const ReportTypeEditor: React.FC<ReportTypeEditorProps> = ({
  currentUser,
  onNotice,
  departments: passedDepartments,
}) => {
  const [reports, setReports] = useState<ReportMetadata[]>(() => getAllReports());
  const [departments, setDepartments] = useState<DepartmentDefinition[]>(() => passedDepartments || departmentService.getAll());

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [frequencyFilter, setFrequencyFilter] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Template Studio state
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioReportKey, setStudioReportKey] = useState<string | undefined>(undefined);

  const [activeReportForEdit, setActiveReportForEdit] = useState<ReportMetadata | null>(null);
  const [activeReportForDelete, setActiveReportForDelete] = useState<ReportMetadata | null>(null);

  // Version History Modal state
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [versionModalReportKey, setVersionModalReportKey] = useState('');
  const [versionModalReportTitle, setVersionModalReportTitle] = useState('');

  // Form State & Validation
  const [formData, setFormData] = useState<{
    ReturnKey: string;
    Code: string;
    Title: string;
    Category: "Credit & Lending" | "Classification & Provisioning" | "Exposures & Concentration" | "Assets & Collateral" | "Restructuring" | "Sector Breakdown";
    Frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL";
    Description: string;
    selectedDepartments: string[];
    initialFieldsCount: number;
  }>({
    ReturnKey: '',
    Code: '',
    Title: '',
    Category: 'Credit & Lending',
    Frequency: 'MONTHLY',
    Description: '',
    selectedDepartments: [],
    initialFieldsCount: 4,
  });

  const [formErrors, setFormErrors] = useState<{
    ReturnKey?: string;
    Title?: string;
    departments?: string;
  }>({});

  // Subscriptions
  useEffect(() => {
    const unsubReports = subscribeReports((updated) => {
      setReports(updated);
    });
    const unsubDepts = departmentService.subscribe((updated) => {
      setDepartments(updated);
    });
    return () => {
      unsubReports();
      unsubDepts();
    };
  }, []);

  const triggerNotice = (message: string, type: 'SUCCESS' | 'ERROR' = 'SUCCESS') => {
    if (onNotice) {
      onNotice(message, type);
    }
  };

  const availableCategories = useMemo(() => {
    return Array.from(new Set(reports.map((r) => r.Category || 'General'))).sort();
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (categoryFilter !== 'ALL' && r.Category !== categoryFilter) return false;
      if (frequencyFilter !== 'ALL' && r.Frequency !== frequencyFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const linkedDepts = r.departments || [r.department || ''];
      return (
        r.ReturnKey.toLowerCase().includes(q) ||
        r.Title.toLowerCase().includes(q) ||
        r.Category.toLowerCase().includes(q) ||
        r.Description.toLowerCase().includes(q) ||
        linkedDepts.some((d) => d.toLowerCase().includes(q))
      );
    });
  }, [reports, categoryFilter, frequencyFilter, searchQuery]);

  const validateForm = (isEdit: boolean, currentKey?: string): boolean => {
    const errors: { ReturnKey?: string; Title?: string; departments?: string } = {};
    const trimmedKey = formData.ReturnKey.trim().toUpperCase();
    const trimmedTitle = formData.Title.trim();

    if (!isEdit) {
      if (!trimmedKey) {
        errors.ReturnKey = 'Return Key is required.';
      } else if (!/^[A-Z0-9_&-]+$/.test(trimmedKey)) {
        errors.ReturnKey = 'Return Key must contain only letters, numbers, and underscores.';
      } else {
        const duplicate = reports.find((r) => r.ReturnKey.toUpperCase() === trimmedKey);
        if (duplicate) {
          errors.ReturnKey = `Return Key "${trimmedKey}" already exists.`;
        }
      }
    }

    if (!trimmedTitle) {
      errors.Title = 'Report title is required.';
    }

    if (formData.selectedDepartments.length === 0) {
      errors.departments = 'Select at least one department to compile this return.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenAddModal = () => {
    const defaultDept = departments[0]?.name || 'Credit Operations & Portfolio Management';
    setFormData({
      ReturnKey: '',
      Code: '',
      Title: '',
      Category: 'Credit & Lending',
      Frequency: 'MONTHLY',
      Description: '',
      selectedDepartments: [defaultDept],
      initialFieldsCount: 4,
    });
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (report: ReportMetadata) => {
    setActiveReportForEdit(report);
    const linked = report.departments && report.departments.length > 0
      ? [...report.departments]
      : report.department
      ? [report.department]
      : departmentService.getDepartmentsForReport(report.ReturnKey);

    setFormData({
      ReturnKey: report.ReturnKey,
      Code: report.Code || report.ReturnKey,
      Title: report.Title,
      Category: report.Category,
      Frequency: report.Frequency,
      Description: report.Description,
      selectedDepartments: linked,
      initialFieldsCount: report.ReturnItemsList?.length || 4,
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteModal = (report: ReportMetadata) => {
    setActiveReportForDelete(report);
    setIsDeleteModalOpen(true);
  };

  const handleToggleDeptSelection = (deptName: string) => {
    setFormData((prev) => {
      const exists = prev.selectedDepartments.includes(deptName);
      let next: string[];
      if (exists) {
        next = prev.selectedDepartments.filter((d) => d !== deptName);
        if (next.length === 0) next = [deptName];
      } else {
        next = [...prev.selectedDepartments, deptName];
      }
      return { ...prev, selectedDepartments: next };
    });
    if (formErrors.departments) {
      setFormErrors({ ...formErrors, departments: undefined });
    }
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) {
      triggerNotice('Please resolve report validation errors.', 'ERROR');
      return;
    }

    const resp = addReportType(
      {
        ReturnKey: formData.ReturnKey.trim().toUpperCase(),
        Code: formData.Code.trim().toUpperCase() || formData.ReturnKey.trim().toUpperCase(),
        Title: formData.Title.trim(),
        Category: formData.Category,
        Frequency: formData.Frequency,
        Description: formData.Description.trim() || `Mandatory prudential report for ${formData.Title}`,
        departments: formData.selectedDepartments,
        department: formData.selectedDepartments[0],
        initialFieldsCount: formData.initialFieldsCount,
      },
      currentUser.name
    );

    if (resp.success) {
      triggerNotice(resp.message || 'Report type created successfully!');
      setIsAddModalOpen(false);
    } else {
      triggerNotice(resp.message || 'Failed to create report.', 'ERROR');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReportForEdit) return;

    if (!validateForm(true, activeReportForEdit.ReturnKey)) {
      triggerNotice('Please resolve report validation errors.', 'ERROR');
      return;
    }

    const resp = updateReportType(activeReportForEdit.ReturnKey, {
      Title: formData.Title.trim(),
      Category: formData.Category,
      Frequency: formData.Frequency,
      Description: formData.Description.trim(),
      departments: formData.selectedDepartments,
      department: formData.selectedDepartments[0],
    });

    if (resp.success) {
      triggerNotice(resp.message || 'Report type updated successfully!');
      setIsEditModalOpen(false);
      setActiveReportForEdit(null);
    } else {
      triggerNotice(resp.message || 'Failed to update report.', 'ERROR');
    }
  };

  const handleConfirmDelete = () => {
    if (!activeReportForDelete) return;

    const resp = removeReportType(activeReportForDelete.ReturnKey);
    if (resp.success) {
      triggerNotice(resp.message || 'Report type removed.');
      setIsDeleteModalOpen(false);
      setActiveReportForDelete(null);
    } else {
      triggerNotice(resp.message || 'Failed to remove report.', 'ERROR');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Action Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Regulatory Returns Registry
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {filteredReports.length} of {reports.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Frequency:</span>
              <select
                value={frequencyFilter}
                onChange={(e) => setFrequencyFilter(e.target.value)}
                className="text-xs px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="ALL">All Frequencies</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search returns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-7 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setStudioReportKey(undefined);
                setIsStudioOpen(true);
              }}
              className="min-h-[36px] px-3.5 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer touch-press"
              title="Open Dynamic Template Studio to configure fields, sections, formulas and versioning"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Template Studio</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="min-h-[36px] px-3.5 py-1.5 bg-ob-green-600 hover:bg-ob-green-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer touch-press"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Report Type</span>
            </button>
          </div>
        </div>

        {/* Reports Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-3 px-4">Return Key & Code</th>
                <th className="py-3 px-4">Title & Description</th>
                <th className="py-3 px-4">Category & Frequency</th>
                <th className="py-3 px-4">Linked Department(s)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No regulatory return templates found.
                  </td>
                </tr>
              ) : (
                filteredReports
                  .slice((page - 1) * pageSize, page * pageSize)
                  .map((report) => {
                    const linkedDepts = report.departments && report.departments.length > 0
                      ? report.departments
                      : report.department
                      ? [report.department]
                      : departmentService.getDepartmentsForReport(report.ReturnKey);

                    return (
                      <tr
                        key={report.ReturnKey}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-ob-indigo-600 dark:text-ob-indigo-400 bg-ob-indigo-50 dark:bg-ob-indigo-950/80 px-2 py-0.5 rounded border border-ob-indigo-200 dark:border-ob-indigo-800 inline-block">
                            {report.ReturnKey}
                          </span>
                          {report.isCustom && (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              Custom
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 max-w-sm">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {report.Title}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {report.Description}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="block font-medium text-slate-700 dark:text-slate-300">
                            {report.Category}
                          </span>
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            {report.Frequency}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 flex-wrap max-w-xs">
                            {linkedDepts.map((d) => (
                              <span
                                key={d}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-ob-indigo-50 dark:bg-ob-indigo-950/60 text-ob-indigo-800 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setStudioReportKey(report.ReturnKey);
                                setIsStudioOpen(true);
                              }}
                              className="p-1.5 text-ob-green-700 dark:text-ob-green-400 hover:bg-ob-green-50 dark:hover:bg-ob-green-950/60 rounded-lg transition-colors cursor-pointer"
                              title="Template Studio: Configure Structure, Sections, Fields, Formulas & Versioning"
                            >
                              <Layers className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setVersionModalReportKey(report.ReturnKey);
                                setVersionModalReportTitle(report.Title);
                                setIsVersionModalOpen(true);
                              }}
                              className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Version History & Structure Audit"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(report)}
                              className="p-1.5 text-ob-indigo-600 dark:text-ob-indigo-400 hover:bg-ob-indigo-50 dark:hover:bg-ob-indigo-950/60 rounded-lg transition-colors cursor-pointer"
                              title="Rename / Edit Report Type"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(report)}
                              className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                              title="Delete Report Type"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
          <Pagination
            currentPage={page}
            totalItems={filteredReports.length}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* MODAL: ADD REPORT TYPE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-ob-green-500/10 text-ob-green-600 dark:text-ob-green-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Add New Regulatory Return Template
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Register a new statutory report for NBE compliance.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Return Key *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LIQ_RATIO_LQ001"
                    value={formData.ReturnKey}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        ReturnKey: e.target.value.toUpperCase(),
                        Code: e.target.value.toUpperCase(),
                      });
                      if (formErrors.ReturnKey) setFormErrors({ ...formErrors, ReturnKey: undefined });
                    }}
                    className={`w-full p-2.5 font-mono uppercase bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-white focus:outline-none ${
                      formErrors.ReturnKey
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-slate-200 dark:border-slate-700 focus:border-ob-indigo-500'
                    }`}
                  />
                  {formErrors.ReturnKey && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {formErrors.ReturnKey}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reporting Frequency *
                  </label>
                  <select
                    value={formData.Frequency}
                    onChange={(e) =>
                      setFormData({ ...formData, Frequency: e.target.value as any })
                    }
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="MONTHLY">Monthly Return</option>
                    <option value="QUARTERLY">Quarterly Return</option>
                    <option value="ANNUAL">Annual Return</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Return Full Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Statutory Liquidity Coverage Return"
                  value={formData.Title}
                  onChange={(e) => {
                    setFormData({ ...formData, Title: e.target.value });
                    if (formErrors.Title) setFormErrors({ ...formErrors, Title: undefined });
                  }}
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-white focus:outline-none ${
                    formErrors.Title
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:border-ob-indigo-500'
                  }`}
                />
                {formErrors.Title && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {formErrors.Title}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Regulatory Category *
                  </label>
                  <select
                    value={formData.Category}
                    onChange={(e) =>
                      setFormData({ ...formData, Category: e.target.value as any })
                    }
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="Credit & Lending">Credit & Lending</option>
                    <option value="Classification & Provisioning">Classification & Provisioning</option>
                    <option value="Exposures & Concentration">Exposures & Concentration</option>
                    <option value="Assets & Collateral">Assets & Collateral</option>
                    <option value="Restructuring">Restructuring</option>
                    <option value="Sector Breakdown">Sector Breakdown</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Balance Fields Count
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={30}
                    value={formData.initialFieldsCount}
                    onChange={(e) =>
                      setFormData({ ...formData, initialFieldsCount: parseInt(e.target.value) || 4 })
                    }
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / NBE Directive Reference
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Directive SBB/82/2026 reporting requirements on liquidity..."
                  value={formData.Description}
                  onChange={(e) => setFormData({ ...formData, Description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Multi-Select Linked Departments */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Linked Department(s) ({formData.selectedDepartments.length} selected) *
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Makers in these departments can fill this return
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50 dark:bg-slate-800">
                  {departments.map((d) => {
                    const isSelected = formData.selectedDepartments.includes(d.name);
                    return (
                      <label
                        key={d.id}
                        className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-ob-green-50 dark:bg-ob-green-950/70 font-bold text-ob-green-900 dark:text-ob-green-200'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleDeptSelection(d.name)}
                            className="rounded text-ob-green-600 focus:ring-ob-green-500 cursor-pointer"
                          />
                          <span>{d.name}</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white dark:bg-slate-800 text-slate-500">
                          {d.shortCode}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {formErrors.departments && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {formErrors.departments}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-ob-green-600 hover:bg-ob-green-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer touch-press"
                >
                  Create Return Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / RENAME REPORT TYPE */}
      {isEditModalOpen && activeReportForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-ob-indigo-500/10 dark:bg-ob-indigo-500/20 text-ob-indigo-600 dark:text-ob-indigo-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Rename / Edit Return: {activeReportForEdit.ReturnKey}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Update report title, frequency, and authorized department linkages.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Return Full Title (Rename) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.Title}
                  onChange={(e) => {
                    setFormData({ ...formData, Title: e.target.value });
                    if (formErrors.Title) setFormErrors({ ...formErrors, Title: undefined });
                  }}
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-white focus:outline-none ${
                    formErrors.Title
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:border-ob-indigo-500'
                  }`}
                />
                {formErrors.Title && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {formErrors.Title}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Regulatory Category
                  </label>
                  <select
                    value={formData.Category}
                    onChange={(e) =>
                      setFormData({ ...formData, Category: e.target.value as any })
                    }
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="Credit & Lending">Credit & Lending</option>
                    <option value="Classification & Provisioning">Classification & Provisioning</option>
                    <option value="Exposures & Concentration">Exposures & Concentration</option>
                    <option value="Assets & Collateral">Assets & Collateral</option>
                    <option value="Restructuring">Restructuring</option>
                    <option value="Sector Breakdown">Sector Breakdown</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={formData.Frequency}
                    onChange={(e) =>
                      setFormData({ ...formData, Frequency: e.target.value as any })
                    }
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="MONTHLY">Monthly Return</option>
                    <option value="QUARTERLY">Quarterly Return</option>
                    <option value="ANNUAL">Annual Return</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.Description}
                  onChange={(e) => setFormData({ ...formData, Description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Department Linkage Multi-Select */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Linked Department(s) ({formData.selectedDepartments.length} assigned) *
                </label>
                <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50 dark:bg-slate-800">
                  {departments.map((d) => {
                    const isSelected = formData.selectedDepartments.includes(d.name);
                    return (
                      <label
                        key={d.id}
                        className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-ob-indigo-50 dark:bg-ob-indigo-950/80 font-bold text-ob-indigo-900 dark:text-ob-indigo-200'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleDeptSelection(d.name)}
                            className="rounded text-ob-indigo-600 focus:ring-ob-indigo-500 cursor-pointer"
                          />
                          <span>{d.name}</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white dark:bg-slate-800 text-slate-500">
                          {d.shortCode}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {formErrors.departments && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {formErrors.departments}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-ob-indigo-600 hover:bg-ob-indigo-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer touch-press"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE REPORT */}
      {isDeleteModalOpen && activeReportForDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Remove Return Template: {activeReportForDelete.ReturnKey}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Decommissioning of regulatory return
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">{activeReportForDelete.Title}</span> ({activeReportForDelete.ReturnKey}) from the active reporting catalogue?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer touch-press"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REPORT VERSION HISTORY AUDIT */}
      <ReportVersionHistoryModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        reportKey={versionModalReportKey}
        reportTitle={versionModalReportTitle}
        onSuccess={(msg) => triggerNotice(msg, 'SUCCESS')}
        adminName={currentUser.name}
      />

      {/* MODAL: DYNAMIC REPORT DEFINITION & TEMPLATE STUDIO */}
      {isStudioOpen && (
        <ReportTemplateStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          reportKey={studioReportKey}
          currentUser={currentUser}
          onSuccess={(msg) => triggerNotice(msg, 'SUCCESS')}
        />
      )}
    </div>
  );
};

// =========================================================================
// MAIN COMPONENT: DepartmentReportManagement
// =========================================================================

interface DepartmentReportManagementProps {
  currentUser: UserSession;
  onBackToDashboard?: () => void;
}

type ManagementViewMode = 'DEPARTMENTS' | 'REPORT_TYPES' | 'LINKAGE_MATRIX' | 'CHANGE_HISTORY';

export const DepartmentReportManagement: React.FC<DepartmentReportManagementProps> = ({
  currentUser,
  onBackToDashboard,
}) => {
  const [viewMode, setViewMode] = useState<ManagementViewMode>('DEPARTMENTS');
  const [departments, setDepartments] = useState<DepartmentDefinition[]>(() => departmentService.getAll());
  const [reports, setReports] = useState<ReportMetadata[]>(() => getAllReports());
  const [changeLogsCount, setChangeLogsCount] = useState<number>(() => departmentService.getChangeLogs().length);

  // Bulk Import state
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{ type: 'SUCCESS' | 'ERROR'; message: string } | null>(null);

  // Subscriptions
  useEffect(() => {
    const unsubDepts = departmentService.subscribe((updated) => {
      setDepartments(updated);
    });
    const unsubReports = subscribeReports((updated) => {
      setReports(updated);
    });
    const unsubLogs = departmentService.subscribeChangeLogs((updated) => {
      setChangeLogsCount(updated.length);
    });
    return () => {
      unsubDepts();
      unsubReports();
      unsubLogs();
    };
  }, []);

  const showNotice = (message: string, type: 'SUCCESS' | 'ERROR' = 'SUCCESS') => {
    setNotification({ type, message });
    if (type === 'SUCCESS') {
      vibrate([20, 30, 25]);
    } else {
      vibrate([40, 50, 40]);
    }
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // Matrix Linkage Toggle
  const handleToggleMatrixLink = (reportKey: string, departmentName: string) => {
    const dept = departments.find((d) => d.name === departmentName);
    if (!dept) return;

    const isLinked = dept.reportKeys.includes(reportKey);
    const nextKeys = isLinked
      ? dept.reportKeys.filter((k) => k !== reportKey)
      : [...dept.reportKeys, reportKey];

    departmentService.setDepartmentReports(dept.id, nextKeys);

    // Synchronize report's departments array
    const r = getReportByKey(reportKey);
    if (r) {
      const allLinkedDepts = departmentService.getDepartmentsForReport(reportKey);
      updateReportType(reportKey, { departments: allLinkedDepts });
    }

    vibrate(12);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-150 pb-16">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-ob-indigo-500/10 dark:bg-ob-indigo-500/20 text-ob-indigo-600 dark:text-ob-indigo-400 border border-ob-indigo-500/30 flex items-center justify-center shrink-0">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Departments & Regulatory Returns Governance
                </h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-ob-indigo-100 dark:bg-ob-indigo-950 text-ob-indigo-800 dark:text-ob-indigo-300 border border-ob-indigo-300 dark:border-ob-indigo-700">
                  Dynamic SSOT
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage bank organizational hierarchy, add/rename regulatory return templates, and configure Many-to-Many report linkages.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsBulkImportModalOpen(true)}
            className="min-h-[42px] px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer touch-press"
          >
            <Upload className="w-3.5 h-3.5 text-ob-indigo-600 dark:text-ob-indigo-400" />
            <span>Bulk Import (CSV/JSON)</span>
          </button>

          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="min-h-[42px] px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer touch-press"
            >
              ← Back to Admin Governance
            </button>
          )}
        </div>
      </div>

      {/* Global Notification Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 shadow-sm animate-in fade-in slide-in-from-top-1 ${
            notification.type === 'SUCCESS'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'SUCCESS' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary View Mode Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setViewMode('DEPARTMENTS');
              vibrate(10);
            }}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer touch-press ${
              viewMode === 'DEPARTMENTS'
                ? 'bg-ob-indigo-600 text-white shadow-sm ring-1 ring-ob-indigo-400/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Departments Registry ({departments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('REPORT_TYPES');
              vibrate(10);
            }}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer touch-press ${
              viewMode === 'REPORT_TYPES'
                ? 'bg-ob-indigo-600 text-white shadow-sm ring-1 ring-ob-indigo-400/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Report Types & Returns ({reports.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('LINKAGE_MATRIX');
              vibrate(10);
            }}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer touch-press ${
              viewMode === 'LINKAGE_MATRIX'
                ? 'bg-ob-indigo-600 text-white shadow-sm ring-1 ring-ob-indigo-400/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>M:N Linkage Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('CHANGE_HISTORY');
              vibrate(10);
            }}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer touch-press ${
              viewMode === 'CHANGE_HISTORY'
                ? 'bg-ob-indigo-600 text-white shadow-sm ring-1 ring-ob-indigo-400/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail & Change History ({changeLogsCount})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: DEPARTMENTS (DepartmentEditor) */}
      {/* ========================================================================= */}
      {viewMode === 'DEPARTMENTS' && (
        <DepartmentEditor
          currentUser={currentUser}
          onNotice={showNotice}
          reports={reports}
        />
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: REPORT TYPES (ReportTypeEditor) */}
      {/* ========================================================================= */}
      {viewMode === 'REPORT_TYPES' && (
        <ReportTypeEditor
          currentUser={currentUser}
          onNotice={showNotice}
          departments={departments}
        />
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: MANY-TO-MANY LINKAGE MATRIX */}
      {/* ========================================================================= */}
      {viewMode === 'LINKAGE_MATRIX' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Network className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
                  <span>Interactive Many-to-Many Report & Department Linkage Matrix</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                  Click any checkbox below to immediately connect or disconnect a regulatory report from a department.
                  Makers and Checkers from that department dynamically gain or lose access in real-time.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-ob-indigo-600 text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-300 font-medium">Linked / Authorized</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"></div>
                  <span className="text-slate-400">Unlinked</span>
                </div>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto mt-4 max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-xs">
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3 text-left font-bold text-slate-900 dark:text-white min-w-[200px] bg-slate-50 dark:bg-slate-800">
                      Report Return Key / Title
                    </th>
                    {departments.map((dept) => (
                      <th
                        key={dept.id}
                        className="py-2.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200 min-w-[120px] max-w-[140px] truncate"
                        title={dept.name}
                      >
                        <span className="block text-[11px] font-mono text-ob-indigo-600 dark:text-ob-indigo-400">
                          {dept.shortCode}
                        </span>
                        <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 truncate block">
                          {dept.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reports.map((report) => (
                    <tr
                      key={report.ReturnKey}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-medium bg-slate-50/50 dark:bg-slate-800">
                        <span className="font-mono font-bold text-ob-indigo-700 dark:text-ob-indigo-300 block">
                          {report.ReturnKey}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate block max-w-xs">
                          {report.Title}
                        </span>
                      </td>

                      {departments.map((dept) => {
                        const isLinked = dept.reportKeys.includes(report.ReturnKey);
                        return (
                          <td key={dept.id} className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleMatrixLink(report.ReturnKey, dept.name)}
                              className={`w-6 h-6 rounded-md transition-all inline-flex items-center justify-center cursor-pointer touch-press ${
                                isLinked
                                  ? 'bg-ob-indigo-600 text-white shadow-xs hover:bg-ob-indigo-700 scale-105'
                                  : 'border border-slate-300 dark:border-slate-700 hover:border-ob-indigo-400 dark:hover:border-ob-indigo-500 bg-white dark:bg-slate-800'
                              }`}
                              title={
                                isLinked
                                  ? `Unlink ${report.ReturnKey} from ${dept.name}`
                                  : `Link ${report.ReturnKey} to ${dept.name}`
                              }
                            >
                              {isLinked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: GOVERNANCE AUDIT TRAIL & CHANGE HISTORY */}
      {/* ========================================================================= */}
      {viewMode === 'CHANGE_HISTORY' && (
        <ChangeHistoryView currentUser={currentUser} onNotice={showNotice} />
      )}

      {/* MODAL: BULK IMPORT (CSV / JSON) */}
      <BulkImportModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        onSuccess={(msg) => showNotice(msg, 'SUCCESS')}
        adminName={currentUser.name}
      />
    </div>
  );
};
