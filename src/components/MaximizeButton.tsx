/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Maximize2 } from 'lucide-react';

export interface MaximizeButtonProps {
  onClick: () => void;
  label?: string;
  title?: string;
  className?: string;
  size?: 'sm' | 'md';
  hideLabelOnMobile?: boolean;
}

/**
 * Standardized Maximize / Full View Trigger Button
 * Provides an accessible, touch-friendly button to trigger the MaximizedViewModal.
 */
export const MaximizeButton: React.FC<MaximizeButtonProps> = ({
  onClick,
  label = 'Maximize',
  title = 'Maximize to full view (Esc to restore)',
  className = '',
  size = 'md',
  hideLabelOnMobile = true,
}) => {
  const isSmall = size === 'sm';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-ob-indigo-50 dark:bg-slate-800 dark:hover:bg-ob-indigo-950/60 text-slate-700 hover:text-ob-indigo-700 dark:text-slate-300 dark:hover:text-ob-indigo-300 border border-slate-200 hover:border-ob-indigo-200 dark:border-slate-700 dark:hover:border-ob-indigo-800 transition-colors flex items-center justify-center gap-1.5 shadow-2xs touch-manipulation touch-press cursor-pointer focus:outline-none focus:ring-2 focus:ring-ob-indigo-400 ${
        isSmall ? 'text-[11px]' : 'text-xs'
      } font-bold ${className}`}
      title={title}
      aria-label={title}
    >
      <Maximize2 className={`${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} shrink-0 text-ob-indigo-600 dark:text-ob-indigo-400`} />
      {label && (
        <span className={hideLabelOnMobile ? 'hidden sm:inline' : 'inline'}>
          {label}
        </span>
      )}
    </button>
  );
};
