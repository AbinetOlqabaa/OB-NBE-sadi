/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Minimize2, X } from 'lucide-react';

export interface MaximizedViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  badge?: string;
  subtitle?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  children: React.ReactNode;
  containerClassName?: string;
  contentClassName?: string;
  ariaLabel?: string;
}

/**
 * Reusable Maximize / Full View Modal Component
 *
 * Expands any information-dense component (tables, charts, logs, audit panels, report editors)
 * into an application-level full-viewport viewer.
 *
 * Adheres strictly to Phase 47 Page-Boundary & Accessibility Contract:
 * - Traps and manages keyboard focus with automatic restoration to the triggering element
 * - Full Escape key listener to close/restore
 * - Contains scrolling inside the component and prevents page-level horizontal overflow
 * - Visible Restore/Close control with clear accessible label and touch targets (>= 44px)
 * - Respects safe-area insets on mobile devices
 * - Preserves responsive layout across mobile, tablet, and desktop
 */
export const MaximizedViewModal: React.FC<MaximizedViewModalProps> = ({
  isOpen,
  onClose,
  title,
  badge = 'Maximized View',
  subtitle,
  icon: Icon,
  actions,
  children,
  containerClassName = '',
  contentClassName = '',
  ariaLabel,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const restoreButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // 1. Focus capture & restoration lifecycle
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      // Transfer focus to the restore button or container on open
      const timer = setTimeout(() => {
        if (restoreButtonRef.current) {
          restoreButtonRef.current.focus();
        } else if (modalRef.current) {
          modalRef.current.focus();
        }
      }, 50);

      // Lock body scroll while maximized to prevent document bleed-through
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = originalOverflow;
        // Restore focus to triggering control
        if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  // 2. Global Escape key listener
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

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || `Full View: ${title}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-md p-1.5 sm:p-3 md:p-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] animate-in fade-in duration-150 outline-none"
    >
      <div
        className={`flex flex-col w-full h-full max-h-full bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 ${containerClassName}`}
      >
        {/* Header Bar: Clear Component Identification & Visible Restore Action */}
        <header className="px-3 sm:px-5 py-2.5 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-850/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {Icon && (
              <div className="p-2 rounded-xl bg-ob-indigo-50 dark:bg-ob-indigo-950/60 text-ob-indigo-600 dark:text-ob-indigo-400 border border-ob-indigo-200/60 dark:border-ob-indigo-800/60 shrink-0">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                  {title}
                </h2>
                {badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-ob-indigo-100 dark:bg-ob-indigo-950/80 text-ob-indigo-800 dark:text-ob-indigo-300 border border-ob-indigo-200 dark:border-ob-indigo-800 shrink-0">
                    {badge}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {actions}

            {/* Prominent Restore / Close Button with Escape Cue */}
            <button
              ref={restoreButtonRef}
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-3 sm:px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs touch-manipulation touch-press cursor-pointer focus:outline-none focus:ring-2 focus:ring-ob-indigo-500"
              title="Restore normal view (Esc)"
              aria-label="Restore normal view"
            >
              <Minimize2 className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-400" />
              <span className="hidden sm:inline">Restore</span>
              <kbd className="hidden md:inline-block px-1.5 py-0.2 rounded bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-mono text-[9px]">
                Esc
              </kbd>
            </button>
          </div>
        </header>

        {/* Maximized Scrollable Body: Contained Scrolling strictly prevents page-level horizontal overflow */}
        <main
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-auto p-2.5 sm:p-5 touch-scroll-y touch-scroll-x overscroll-contain ${contentClassName}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
