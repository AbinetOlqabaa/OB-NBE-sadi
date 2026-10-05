/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  FileCheck,
  ShieldCheck,
  Building2,
  Activity,
  AlertTriangle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { AppNotification, NotificationCategory } from '../services/notificationService.ts';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToTab,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'UNREAD' | NotificationCategory>('ALL');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'UNREAD') return !n.isRead;
    return n.category === selectedFilter;
  });

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'WORKFLOW':
        return <FileCheck className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400 shrink-0" />;
      case 'SECURITY':
        return <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
      case 'GOVERNANCE':
        return <Building2 className="w-4 h-4 text-ob-green-600 dark:text-ob-green-400 shrink-0" />;
      case 'SYSTEM':
      default:
        return <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const elapsedMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.max(1, Math.floor(elapsedMs / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Notification Center"
    >
      <div
        className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[88vh] bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-ob-indigo-50 dark:bg-ob-indigo-950/60 text-ob-indigo-700 dark:text-ob-indigo-300">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Notification Center
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Authoritative NBE regulatory alerts & workflow updates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="px-2.5 py-1 text-[11px] font-semibold text-ob-indigo-600 dark:text-ob-indigo-400 hover:bg-ob-indigo-50 dark:hover:bg-ob-indigo-950/50 rounded-lg transition-colors flex items-center gap-1 min-h-[36px] cursor-pointer"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Close notification center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-xs touch-scroll-x bg-white dark:bg-slate-900 shrink-0">
          {(
            [
              { key: 'ALL', label: 'All', count: notifications.length },
              { key: 'UNREAD', label: 'Unread', count: unreadCount },
              { key: 'WORKFLOW', label: 'Workflow' },
              { key: 'GOVERNANCE', label: 'Governance' },
              { key: 'SECURITY', label: 'Security' },
            ] as const
          ).map((item) => {
            const isActive = selectedFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedFilter(item.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors min-h-[32px] cursor-pointer ${
                  isActive
                    ? 'bg-ob-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{item.label}</span>
                {'count' in item && typeof item.count === 'number' && item.count > 0 && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1 touch-scroll-y">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                No notifications to display
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                {selectedFilter === 'UNREAD'
                  ? "You've read all your role notifications."
                  : 'All quiet! There are currently no updates in this category.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 sm:p-3.5 rounded-xl transition-colors relative flex items-start gap-3 group ${
                  notif.isRead
                    ? 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40 opacity-80 hover:opacity-100'
                    : 'bg-ob-indigo-50/30 dark:bg-ob-indigo-950/20 hover:bg-ob-indigo-50/60 dark:hover:bg-ob-indigo-950/40'
                }`}
              >
                {/* Category Icon */}
                <div className="mt-0.5 p-2 rounded-xl bg-white dark:bg-slate-800 shadow-2xs border border-slate-200/80 dark:border-slate-700/80 shrink-0">
                  {getCategoryIcon(notif.category)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {notif.title}
                      </span>
                      {notif.priority === 'HIGH' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          Urgent
                        </span>
                      )}
                    </div>
                    {!notif.isRead && (
                      <span
                        className="w-2 h-2 rounded-full bg-ob-indigo-600 dark:bg-ob-indigo-400 shrink-0"
                        title="Unread notification"
                      />
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {notif.message}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(notif.createdAt)}
                    </span>

                    <div className="flex items-center gap-2">
                      {notif.actionTab && onNavigateToTab && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!notif.isRead) onMarkAsRead(notif.id);
                            onNavigateToTab(notif.actionTab!);
                            onClose();
                          }}
                          className="font-bold text-ob-indigo-600 dark:text-ob-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}

                      {!notif.isRead && (
                        <button
                          type="button"
                          onClick={() => onMarkAsRead(notif.id)}
                          className="font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center gap-0.5 cursor-pointer"
                          title="Mark as read"
                        >
                          <Check className="w-3 h-3" />
                          <span>Mark read</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Role segregation & department isolation enforced</span>
          <span className="font-mono">BSD/03/2020</span>
        </div>
      </div>
    </div>
  );
};
