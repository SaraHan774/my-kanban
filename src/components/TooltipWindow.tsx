import { useRef, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './TooltipWindow.css';

interface TooltipWindowProps {
  anchorRect: DOMRect;
  placement?: 'left' | 'right' | 'top' | 'bottom';
  gap?: number;
  width?: number;
  maxHeight?: number;
  className?: string;
  style?: React.CSSProperties;
  pointerEvents?: boolean;
  children: React.ReactNode;
}

interface Position {
  top: number;
  left?: number;
  right?: number;
}

export function TooltipWindow({
  anchorRect,
  placement = 'left',
  gap = 4,
  width = 320,
  maxHeight = 420,
  className,
  style,
  pointerEvents = false,
  children,
}: TooltipWindowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Position | null>(null);

  useLayoutEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    let top: number;
    let left: number | undefined;
    let right: number | undefined;

    if (placement === 'left' || placement === 'right') {
      // Horizontal placement: prefer placement side, fallback to opposite, then clamp
      const spaceLeft = anchorRect.left - gap;
      const spaceRight = vw - anchorRect.right - gap;

      let resolvedSide: 'left' | 'right';

      if (placement === 'left' && spaceLeft >= width) {
        resolvedSide = 'left';
      } else if (placement === 'right' && spaceRight >= width) {
        resolvedSide = 'right';
      } else if (spaceLeft >= width) {
        resolvedSide = 'left';
      } else if (spaceRight >= width) {
        resolvedSide = 'right';
      } else {
        // Fallback: clamp with left
        resolvedSide = 'left';
        left = Math.max(margin, Math.min(anchorRect.left, vw - width - margin));
      }

      // Use CSS right for left-placement, CSS left for right-placement
      // so the edge closest to the card is always precisely positioned
      if (left === undefined) {
        if (resolvedSide === 'left') {
          right = vw - anchorRect.left + gap;
        } else {
          left = anchorRect.right + gap;
        }
      }

      // Vertically center on anchor, then clamp
      const anchorMidY = anchorRect.top + anchorRect.height / 2;
      const halfHeight = maxHeight / 2;
      top = Math.max(margin + halfHeight, Math.min(anchorMidY, vh - halfHeight - margin));
    } else {
      // Vertical placement (top/bottom)
      const elHeight = ref.current?.offsetHeight || maxHeight;
      const spaceAbove = anchorRect.top - gap;
      const spaceBelow = vh - anchorRect.bottom - gap;

      if (placement === 'top' && spaceAbove >= elHeight) {
        top = anchorRect.top - elHeight - gap;
      } else if (placement === 'bottom' && spaceBelow >= elHeight) {
        top = anchorRect.bottom + gap;
      } else if (spaceAbove >= elHeight) {
        top = anchorRect.top - elHeight - gap;
      } else if (spaceBelow >= elHeight) {
        top = anchorRect.bottom + gap;
      } else {
        top = Math.max(margin, vh - elHeight - margin);
      }

      // Horizontally center on anchor, then clamp
      const anchorMidX = anchorRect.left + anchorRect.width / 2;
      left = Math.max(margin, Math.min(anchorMidX - width / 2, vw - width - margin));
    }

    setPos({ top, left, right });
  }, [anchorRect, placement, gap, width, maxHeight]);

  const isVertical = placement === 'top' || placement === 'bottom';

  const mergedStyle: React.CSSProperties = {
    ...style,
    width,
    maxHeight,
    ...(pos
      ? {
          top: pos.top,
          ...(pos.right !== undefined ? { right: pos.right } : { left: pos.left }),
          ...(isVertical ? {} : { transform: 'translateY(-50%)' }),
        }
      : { opacity: 0 }),
  };

  return createPortal(
    <div
      ref={ref}
      className={`tooltip-window ${pointerEvents ? 'tooltip-window--interactive' : ''} ${className || ''}`}
      style={mergedStyle}
    >
      {children}
    </div>,
    document.body,
  );
}
