/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { ViewTab } from '../components/Sidebar.tsx';
import { vibrate } from '../utils/haptics.ts';

export interface UseSwipeGestureOptions {
  currentTab: ViewTab;
  tabs?: ViewTab[];
  userRole?: string;
  onSelectTab: (tab: ViewTab) => void;
  enabled?: boolean;
  threshold?: number;
  maxVerticalOffset?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export interface UseSwipeGestureResult {
  containerRef: React.RefObject<HTMLElement | null>;
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent | TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent | TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent | TouchEvent) => void;
    onTouchCancel: (e: React.TouchEvent | TouchEvent) => void;
  };
  isSwiping: boolean;
  swipeOffset: number;
  swipeDirection: 'left' | 'right' | null;
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
  nextTab: ViewTab | null;
  prevTab: ViewTab | null;
  navigateToNextTab: () => boolean;
  navigateToPrevTab: () => boolean;
}

/**
 * Returns accessible tabs matching the user role in chronological sidebar order
 */
export function getRoleTabs(userRole?: string): ViewTab[] {
  switch (userRole) {
    case 'ADMIN':
      return [
        'ADMIN_DASHBOARD',
        'DEPT_REPORT_MANAGEMENT',
        'NBE_SIMULATOR',
        'PHASE2_SSOT',
        'AUDIT_TRAIL',
        'SYSTEM_HEALTH',
        'DOCUMENTATION',
      ];
    case 'CHECKER':
      return ['CHECKER_INBOX', 'AUDIT_TRAIL', 'DOCUMENTATION', 'LIBRARY'];
    case 'AUDITOR':
      return ['AUDITOR_DASHBOARD', 'AUDIT_TRAIL', 'DOCUMENTATION', 'LIBRARY'];
    case 'MAKER':
      return ['MAKER_WORKSPACE', 'AUDIT_TRAIL', 'DOCUMENTATION', 'LIBRARY'];
    default:
      return ['MAKER_WORKSPACE', 'AUDIT_TRAIL', 'DOCUMENTATION', 'LIBRARY'];
  }
}

/**
 * Hook for swipe gesture support on the main viewport.
 * Enables users to navigate between Sidebar tabs using horizontal drag gestures on mobile devices.
 */
export function useSwipeGesture({
  currentTab,
  tabs,
  userRole,
  onSelectTab,
  enabled = true,
  threshold = 55,
  maxVerticalOffset = 80,
  onSwipeLeft,
  onSwipeRight,
}: UseSwipeGestureOptions): UseSwipeGestureResult {
  const containerRef = useRef<HTMLElement | null>(null);

  // Compute active navigation tabs for gesture order
  const effectiveTabs = tabs && tabs.length > 0 ? tabs : getRoleTabs(userRole);
  const currentIndex = effectiveTabs.indexOf(currentTab);

  const canSwipeLeft = currentIndex >= 0 && currentIndex < effectiveTabs.length - 1; // Drag left -> next tab
  const canSwipeRight = currentIndex > 0; // Drag right -> previous tab

  const nextTab = canSwipeLeft ? effectiveTabs[currentIndex + 1] : null;
  const prevTab = canSwipeRight ? effectiveTabs[currentIndex - 1] : null;

  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Tracking touch coordinates
  const touchStartRef = useRef<{ x: number; y: number; time: number; ignored: boolean }>({
    x: 0,
    y: 0,
    time: 0,
    ignored: false,
  });

  const navigateToNextTab = useCallback((): boolean => {
    if (canSwipeLeft && nextTab) {
      vibrate(15);
      onSelectTab(nextTab);
      if (onSwipeLeft) onSwipeLeft();
      return true;
    }
    return false;
  }, [canSwipeLeft, nextTab, onSelectTab, onSwipeLeft]);

  const navigateToPrevTab = useCallback((): boolean => {
    if (canSwipeRight && prevTab) {
      vibrate(15);
      onSelectTab(prevTab);
      if (onSwipeRight) onSwipeRight();
      return true;
    }
    return false;
  }, [canSwipeRight, prevTab, onSelectTab, onSwipeRight]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      if (!touch) return;

      const target = e.target as HTMLElement | null;
      let shouldIgnore = false;

      // Avoid hijacking touches on form controls or scrollable tables
      if (target) {
        const tagName = target.tagName ? target.tagName.toLowerCase() : '';
        if (['input', 'textarea', 'select', 'button'].includes(tagName)) {
          shouldIgnore = true;
        }

        // Avoid stealing horizontal drag on horizontally scrollable tables
        const scrollableParent = target.closest('.overflow-x-auto, [data-swipe-ignore="true"]');
        if (scrollableParent && scrollableParent.scrollWidth > scrollableParent.clientWidth) {
          shouldIgnore = true;
        }
      }

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
        ignored: shouldIgnore,
      };

      setIsSwiping(false);
      setSwipeOffset(0);
      setSwipeDirection(null);
    },
    [enabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      if (!enabled || touchStartRef.current.ignored) return;

      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // If user is predominantly scrolling vertically, ignore swipe
      if (Math.abs(deltaY) > maxVerticalOffset && Math.abs(deltaY) > Math.abs(deltaX)) {
        setIsSwiping(false);
        setSwipeOffset(0);
        setSwipeDirection(null);
        touchStartRef.current.ignored = true;
        return;
      }

      // Check if horizontal intent is established
      if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
        setIsSwiping(true);
        setSwipeOffset(deltaX);
        setSwipeDirection(deltaX < 0 ? 'left' : 'right');
      }
    },
    [enabled, maxVerticalOffset]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      if (!enabled || touchStartRef.current.ignored) {
        setIsSwiping(false);
        setSwipeOffset(0);
        setSwipeDirection(null);
        return;
      }

      const touch = e.changedTouches ? e.changedTouches[0] : null;
      if (!touch) {
        setIsSwiping(false);
        setSwipeOffset(0);
        setSwipeDirection(null);
        return;
      }

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const elapsed = Date.now() - touchStartRef.current.time;

      // Only trigger if horizontal displacement exceeds threshold and wasn't a vertical scroll
      if (Math.abs(deltaX) >= threshold && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0 && canSwipeLeft) {
          // Swipe Left -> next tab
          navigateToNextTab();
        } else if (deltaX > 0 && canSwipeRight) {
          // Swipe Right -> prev tab
          navigateToPrevTab();
        }
      }

      setIsSwiping(false);
      setSwipeOffset(0);
      setSwipeDirection(null);
    },
    [canSwipeLeft, canSwipeRight, enabled, navigateToNextTab, navigateToPrevTab, threshold]
  );

  const handleTouchCancel = useCallback(() => {
    setIsSwiping(false);
    setSwipeOffset(0);
    setSwipeDirection(null);
  }, []);

  // Attach native listeners if containerRef is populated
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => handleTouchStart(e);
    const onMove = (e: TouchEvent) => handleTouchMove(e);
    const onEnd = (e: TouchEvent) => handleTouchEnd(e);
    const onCancel = () => handleTouchCancel();

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  return {
    containerRef,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
    isSwiping,
    swipeOffset,
    swipeDirection,
    canSwipeLeft,
    canSwipeRight,
    nextTab,
    prevTab,
    navigateToNextTab,
    navigateToPrevTab,
  };
}

// Alias for convenience
export const useSwipeNavigation = useSwipeGesture;
