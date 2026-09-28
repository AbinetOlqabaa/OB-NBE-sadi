/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown, Check } from 'lucide-react';
import { vibrate } from '../utils/haptics.ts';

export interface InputAccessoryViewProps {
  isVisible?: boolean;
  currentIndex?: number;
  totalFields?: number;
  currentCode?: string;
  currentLabel?: string;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onDone?: () => void;
}

/**
 * Mobile Input Accessory View that listens for document focus events.
 * Features a custom theme-aware background matching the Oromia Bank color palette
 * and tactile haptic feedback integration using the 'vibrate' utility whenever
 * the 'Previous', 'Next', or 'Done' actions are triggered.
 */
export const InputAccessoryView: React.FC<InputAccessoryViewProps> = ({
  isVisible: controlledVisible,
  currentIndex: controlledIndex,
  totalFields: controlledTotal,
  currentCode: controlledCode,
  currentLabel: controlledLabel,
  hasPrevious: controlledHasPrevious,
  hasNext: controlledHasNext,
  onPrevious: controlledOnPrevious,
  onNext: controlledOnNext,
  onDone: controlledOnDone,
}) => {
  const [keyboardBottomOffset, setKeyboardBottomOffset] = useState<number>(0);
  const [internalFocused, setInternalFocused] = useState<boolean>(false);
  const [activeInput, setActiveInput] = useState<HTMLElement | null>(null);
  const [fieldIndex, setFieldIndex] = useState<number>(0);
  const [fieldCount, setFieldCount] = useState<number>(0);
  const [fieldLabel, setFieldLabel] = useState<string>('');
  const [fieldCode, setFieldCode] = useState<string>('');

  const blurTimeoutRef = useRef<number | null>(null);

  // Helper to query all focusable, interactive inputs currently in the document
  const getNavigableInputs = useCallback((): (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[] => {
    if (typeof document === 'undefined') return [];
    const selector =
      'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled]):not([readonly])';
    const elements = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)
    );
    return elements.filter((el) => {
      // Must be visible in viewport/layout
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
    });
  }, []);

  // Helper to resolve a friendly label or code for the focused element
  const resolveElementInfo = useCallback((el: HTMLElement) => {
    const code =
      el.getAttribute('data-code') ||
      el.getAttribute('name') ||
      el.getAttribute('id') ||
      '';

    let label =
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('data-description') ||
      '';

    if (!label && el.id) {
      const labelEl = document.querySelector(`label[for="${el.id}"]`);
      if (labelEl && labelEl.textContent) {
        label = labelEl.textContent.trim();
      }
    }

    if (!label) {
      const parentLabel = el.closest('label');
      if (parentLabel && parentLabel.textContent) {
        label = parentLabel.textContent.trim();
      }
    }

    return { code, label };
  }, []);

  // 1. Listen for document focus events (focusin and focusout)
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleFocusIn = (e: FocusEvent) => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName ? target.tagName.toLowerCase() : '';
      const isInput =
        tagName === 'input' || tagName === 'textarea' || tagName === 'select';

      // Check that it is not a button-like input or disabled/readonly
      if (isInput) {
        const inputType = (target as HTMLInputElement).type?.toLowerCase();
        if (['button', 'submit', 'reset', 'hidden', 'file'].includes(inputType)) {
          return;
        }

        const isReadOnly = (target as any).readOnly;
        const isDisabled = (target as any).disabled;
        if (isReadOnly || isDisabled) return;

        setActiveInput(target);
        setInternalFocused(true);

        const allInputs = getNavigableInputs();
        const idx = allInputs.indexOf(target as any);
        setFieldIndex(idx >= 0 ? idx : 0);
        setFieldCount(allInputs.length);

        const { code, label } = resolveElementInfo(target);
        setFieldCode(code);
        setFieldLabel(label);
      }
    };

    const handleFocusOut = () => {
      // Debounce blur so quickly tapping between inputs doesn't cause a flicker
      blurTimeoutRef.current = window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active) {
          setInternalFocused(false);
          setActiveInput(null);
          return;
        }

        const activeTag = active.tagName ? active.tagName.toLowerCase() : '';
        const isStillInput =
          activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

        if (!isStillInput) {
          setInternalFocused(false);
          setActiveInput(null);
        }
      }, 150);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, [getNavigableInputs, resolveElementInfo]);

  // 2. Track mobile virtual keyboard offset using VisualViewport API
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const updatePosition = () => {
      if (!window.visualViewport) return;
      const offsetFromBottom = Math.max(
        0,
        window.innerHeight - (window.visualViewport.height + window.visualViewport.offsetTop)
      );
      setKeyboardBottomOffset(offsetFromBottom);
    };

    window.visualViewport.addEventListener('resize', updatePosition);
    window.visualViewport.addEventListener('scroll', updatePosition);
    updatePosition();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updatePosition);
        window.visualViewport.removeEventListener('scroll', updatePosition);
      }
    };
  }, []);

  // Determine effective visibility
  const isVisible = controlledVisible !== undefined ? controlledVisible : internalFocused;

  // Determine values (either controlled via props or computed via document focus)
  const allInputs = getNavigableInputs();
  const currentIndex = controlledIndex !== undefined ? controlledIndex : fieldIndex;
  const totalFields = controlledTotal !== undefined ? controlledTotal : fieldCount || allInputs.length;
  const currentCode = controlledCode !== undefined ? controlledCode : fieldCode;
  const currentLabel = controlledLabel !== undefined ? controlledLabel : fieldLabel;

  const hasPrevious =
    controlledHasPrevious !== undefined ? controlledHasPrevious : currentIndex > 0;
  const hasNext =
    controlledHasNext !== undefined ? controlledHasNext : currentIndex < allInputs.length - 1;

  // Handlers with haptic feedback integration using the 'vibrate' utility
  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault();
    // Trigger tactile haptic pulse on mobile devices
    vibrate(15);

    if (controlledOnPrevious) {
      controlledOnPrevious();
      return;
    }

    const inputs = getNavigableInputs();
    const curr = activeInput || (document.activeElement as any);
    const currIdx = inputs.indexOf(curr);
    const prevIdx = currIdx > 0 ? currIdx - 1 : inputs.length - 1;

    if (inputs[prevIdx]) {
      inputs[prevIdx].focus();
      try {
        inputs[prevIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    // Trigger tactile haptic pulse on mobile devices
    vibrate(15);

    if (controlledOnNext) {
      controlledOnNext();
      return;
    }

    const inputs = getNavigableInputs();
    const curr = activeInput || (document.activeElement as any);
    const currIdx = inputs.indexOf(curr);
    const nextIdx = currIdx >= 0 && currIdx < inputs.length - 1 ? currIdx + 1 : 0;

    if (inputs[nextIdx]) {
      inputs[nextIdx].focus();
      try {
        inputs[nextIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
    }
  };

  const handleDone = (e: React.MouseEvent) => {
    e.preventDefault();
    // Trigger celebratory haptic confirmation pattern on mobile devices
    vibrate([25, 40, 30]);

    if (controlledOnDone) {
      controlledOnDone();
    }

    if (document.activeElement && typeof (document.activeElement as HTMLElement).blur === 'function') {
      (document.activeElement as HTMLElement).blur();
    }
    setInternalFocused(false);
    setActiveInput(null);
  };

  if (!isVisible) return null;

  return (
    <aside
      role="toolbar"
      aria-label="Mobile Financial Form Input Navigation"
      style={{ bottom: `${keyboardBottomOffset}px` }}
      className="fixed left-0 right-0 z-50 bg-gradient-to-r from-ob-indigo-50/95 via-white/95 to-ob-indigo-50/95 dark:from-[#0D0F1F]/95 dark:via-ob-indigo-950/95 dark:to-[#0D0F1F]/95 backdrop-blur-md border-t border-ob-indigo-200/90 dark:border-ob-indigo-800/80 text-slate-800 dark:text-slate-100 shadow-[0_-8px_30px_rgba(89,98,171,0.18)] dark:shadow-[0_-8px_30px_rgba(18,20,40,0.85)] px-3 py-2 flex items-center justify-between gap-2 pb-safe transition-all duration-150 ease-out animate-in slide-in-from-bottom-2 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:bg-gradient-to-r before:from-ob-indigo-500 before:via-ob-green-500 before:to-ob-indigo-500 before:opacity-90"
    >
      {/* Navigation Buttons: Previous / Next */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={!hasPrevious}
          onClick={handlePrevious}
          aria-label="Previous Input"
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation touch-press ${
            hasPrevious
              ? 'bg-white dark:bg-ob-indigo-900/60 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-800/80 text-ob-indigo-900 dark:text-ob-indigo-100 border border-ob-indigo-200 dark:border-ob-indigo-700/60 active:scale-95 cursor-pointer shadow-2xs'
              : 'bg-slate-100/60 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600 border border-transparent cursor-not-allowed opacity-50'
          }`}
        >
          <ChevronUp className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-300" />
          <span className="hidden sm:inline font-bold">Previous</span>
        </button>

        <button
          type="button"
          disabled={!hasNext}
          onClick={handleNext}
          aria-label="Next Input"
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation touch-press ${
            hasNext
              ? 'bg-white dark:bg-ob-indigo-900/60 hover:bg-ob-indigo-100 dark:hover:bg-ob-indigo-800/80 text-ob-indigo-900 dark:text-ob-indigo-100 border border-ob-indigo-200 dark:border-ob-indigo-700/60 active:scale-95 cursor-pointer shadow-2xs'
              : 'bg-slate-100/60 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600 border border-transparent cursor-not-allowed opacity-50'
          }`}
        >
          <ChevronDown className="w-4 h-4 text-ob-indigo-600 dark:text-ob-indigo-300" />
          <span className="hidden sm:inline font-bold">Next</span>
        </button>
      </div>

      {/* Center Indicator (Field details or code) */}
      <div className="flex-1 min-w-0 px-2 text-center">
        {currentCode && (
          <div className="flex items-center justify-center gap-1.5 truncate">
            <span className="font-mono text-[11px] font-bold text-ob-indigo-900 dark:text-ob-indigo-200 bg-ob-indigo-100/90 dark:bg-ob-indigo-950/90 px-1.5 py-0.5 rounded border border-ob-indigo-300/80 dark:border-ob-indigo-800/80 truncate max-w-[120px] shadow-2xs">
              {currentCode}
            </span>
            {totalFields > 0 && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                ({currentIndex + 1}/{totalFields})
              </span>
            )}
          </div>
        )}
        {currentLabel && (
          <p className="text-[10px] text-slate-700 dark:text-slate-300 font-medium truncate max-w-[180px] sm:max-w-xs mx-auto">
            {currentLabel}
          </p>
        )}
      </div>

      {/* Done Action with Oromia Bank Brand Colors & Haptic Feedback */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={handleDone}
          aria-label="Done Editing"
          className="min-h-[44px] min-w-[68px] px-3.5 py-1.5 bg-ob-indigo-600 hover:bg-ob-indigo-500 active:bg-ob-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-ob-indigo-950/30 border border-ob-indigo-500/50 active:scale-95 touch-manipulation touch-press flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Check className="w-4 h-4 text-ob-green-300 stroke-[3]" />
          <span>Done</span>
        </button>
      </div>
    </aside>
  );
};
