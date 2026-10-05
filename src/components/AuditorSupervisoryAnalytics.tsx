/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Clock,
  Download,
  ShieldCheck,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import type { UserSession, AuditorExportFormat } from '../types/regulatory.ts';
import { auditorService } from '../services/auditorService.ts';
import { triggerAuditorMultiFormatExport } from '../utils/auditorMultiFormatExport.ts';
import { MaximizeButton } from './MaximizeButton.tsx';
import { MaximizedViewModal } from './MaximizedViewModal.tsx';
import { haptics } from '../utils/haptics.ts';

interface AuditorSupervisoryAnalyticsProps {
  currentUser: UserSession;
}

export const AuditorSupervisoryAnalytics: React.FC<AuditorSupervisoryAnalyticsProps> = ({
  currentUser,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  const deptMatrix = useMemo(() => auditorService.getDepartmentComplianceMatrix(), []);
  const slaDistribution = useMemo(() => auditorService.getProcessingTimeDistribution(), []);

  const handleExportAnalytics = (format: AuditorExportFormat) => {
    triggerAuditorMultiFormatExport({
      format,
      scope: 'PERFORMANCE_KPIS',
      mode: 'BULK',
      actorName: currentUser.name,
    });
    haptics.success();
  };

  const renderChartsContent = (chartHeight = 250) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chart 1: Departmental Compliance & Risk Exposure */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
              <span>Departmental Compliance & Risk Exposure (8 Departments)</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Compliance score (%) vs active findings and detected anomalies by banking directorate.
            </p>
          </div>
        </div>

        <div style={{ width: '100%', height: chartHeight }} className="min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptMatrix} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
              <XAxis dataKey="shortName" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  fontSize: '11px',
                  color: '#f8fafc',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="complianceScore" name="Compliance Score (%)" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              <Bar dataKey="openFindings" name="Open Findings" fill="#e11d48" radius={[6, 6, 0, 0]} />
              <Bar dataKey="activeAnomalies" name="Anomalies" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Turnaround & SLA Processing Time Distribution */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Submission Processing Turnaround & SLA Distribution</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              End-to-end processing time from Maker draft preparation to 4-eyes sign-off and NBE receipt.
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          {slaDistribution.map((b) => (
            <div
              key={b.bucket}
              className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">{b.bucket}</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-500">{b.count} returns</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      b.slaStatus === 'OPTIMAL'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : b.slaStatus === 'ON_TARGET'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : b.slaStatus === 'NEAR_THRESHOLD'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {b.percentage}% ({b.slaStatus.replace(/_/g, ' ')})
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    b.slaStatus === 'OPTIMAL'
                      ? 'bg-emerald-500'
                      : b.slaStatus === 'ON_TARGET'
                      ? 'bg-ob-indigo-500'
                      : b.slaStatus === 'NEAR_THRESHOLD'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.max(8, b.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4 min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              <span>SUPERVISORY ANALYTICS & SLA MATRIX</span>
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1">
            Internal Audit Departmental Risk & Turnaround Visualizations
          </h3>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(['XLSX', 'CSV', 'PDF', 'JSON', 'XML'] as AuditorExportFormat[]).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => handleExportAnalytics(fmt)}
              className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
              title={`Export Departmental & SLA Analytics in ${fmt}`}
            >
              <Download className="w-3 h-3 text-ob-indigo-600" />
              <span>{fmt}</span>
            </button>
          ))}
          <MaximizeButton
            onClick={() => setIsMaximized(true)}
            title="Maximize Supervisory Analytics Charts (Esc to restore)"
          />
        </div>
      </div>

      {renderChartsContent(240)}

      {isMaximized && (
        <MaximizedViewModal
          isOpen={isMaximized}
          onClose={() => setIsMaximized(false)}
          title="Internal Audit Departmental Risk & SLA Turnaround Visualizations"
          badge="Auditor Analytics"
          subtitle="Comprehensive 8-department compliance comparison and processing time SLA distribution"
          icon={BarChart3}
        >
          <div className="space-y-4">
            {renderChartsContent(380)}
          </div>
        </MaximizedViewModal>
      )}
    </div>
  );
};
