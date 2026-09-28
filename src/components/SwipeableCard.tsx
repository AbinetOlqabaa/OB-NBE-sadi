/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { Trash2, Archive } from 'lucide-react';
import { haptics, vibrate } from '../utils/haptics.ts';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  leftActionLabel?: string;
  leftActionIcon?: React.ReactNode;
  leftActionColor?: string;
  onSwipeRight?: () => void;
  rightActionLabel?: string;
  rightActionIcon?: React.ReactNode;
  rightActionColor?: string;
  threshold?: number;
  className?: string;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  onSwipeLeft,
  leftActionLabel = 'Delete',
  leftActionIcon = <Trash2 className="w-5 h-5" />,
  leftActionColor = 'bg-rose-600',
  onSwipeRight,
  rightActionLabel = 'Archive',
  rightActionIcon = <Archive className="w-5 h-5" />,
  rightActionColor = 'bg-amber-600',
  threshold = 75,
  className = '',
}) => {
  const x = useMotionValue(0);
  const [hasCrossedThreshold, setHasCrossedThreshold] = useState(false);

  // Background action opacities and scales for native feel
  const leftOpacity = useTransform(x, [-threshold, -15], [1, 0]);
  const leftScale = useTransform(x, [-threshold - 40, -threshold, 0], [1.1, 1, 0.85]);

  const rightOpacity = useTransform(x, [15, threshold], [0, 1]);
  const rightScale = useTransform(x, [0, threshold, threshold + 40], [0.85, 1, 1.1]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if ((offset < -threshold || velocity < -500) && onSwipeLeft) {
      vibrate([30, 45]);
      haptics.error();
      // Animate off-screen to left then trigger callback
      animate(x, -350, {
        type: 'spring',
        stiffness: 400,
        damping: 30,
        onComplete: () => {
          onSwipeLeft();
          x.set(0);
        },
      });
    } else if ((offset > threshold || velocity > 500) && onSwipeRight) {
      vibrate([25, 35]);
      haptics.success();
      // Animate off-screen to right then trigger callback
      animate(x, 350, {
        type: 'spring',
        stiffness: 400,
        damping: 30,
        onComplete: () => {
          onSwipeRight();
          x.set(0);
        },
      });
    } else {
      // Snap back to center
      animate(x, 0, {
        type: 'spring',
        stiffness: 500,
        damping: 35,
      });
    }
    setHasCrossedThreshold(false);
  };

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offset = Math.abs(info.offset.x);
    if (offset > threshold && !hasCrossedThreshold) {
      vibrate(15);
      haptics.medium();
      setHasCrossedThreshold(true);
    } else if (offset <= threshold && hasCrossedThreshold) {
      setHasCrossedThreshold(false);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-xl select-none ${className}`}>
      {/* Background Left Action (Reveals when swiping LEFT -> placed on the RIGHT side) */}
      {onSwipeLeft && (
        <motion.div
          style={{ opacity: leftOpacity, scale: leftScale }}
          className={`absolute inset-y-0 right-0 w-28 ${leftActionColor} text-white flex flex-col items-center justify-center p-2 rounded-r-xl z-0 transition-colors`}
        >
          <div className="flex flex-col items-center justify-center">
            {leftActionIcon}
            <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">
              {leftActionLabel}
            </span>
          </div>
        </motion.div>
      )}

      {/* Background Right Action (Reveals when swiping RIGHT -> placed on the LEFT side) */}
      {onSwipeRight && (
        <motion.div
          style={{ opacity: rightOpacity, scale: rightScale }}
          className={`absolute inset-y-0 left-0 w-28 ${rightActionColor} text-white flex flex-col items-center justify-center p-2 rounded-l-xl z-0 transition-colors`}
        >
          <div className="flex flex-col items-center justify-center">
            {rightActionIcon}
            <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">
              {rightActionLabel}
            </span>
          </div>
        </motion.div>
      )}

      {/* Foreground Swipeable Content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{
          left: onSwipeLeft ? -120 : 0,
          right: onSwipeRight ? 120 : 0,
        }}
        dragElastic={0.2}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className="relative z-10 bg-white dark:bg-slate-900 touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
};
