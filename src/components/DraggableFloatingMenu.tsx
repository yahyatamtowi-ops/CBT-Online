import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripHorizontal, Menu, X } from 'lucide-react';
import {
  clampFloatingPosition,
  resolveFloatingPopoverPlacement,
  type FloatingPosition,
} from '../utils/examSummaryAnalytics';

export interface FloatingNavItem<T extends string = string> {
  id: T;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
}

interface DraggableFloatingMenuProps<T extends string> {
  portalKey: string;
  portalTitle: string;
  navItems: FloatingNavItem<T>[];
  activeTab: T;
  onSelectTab: (id: T) => void;
  ariaLabel: string;
}

const BUTTON_SIZE = 54;
const EDGE_MARGIN = 14;
const TOP_MARGIN = 64;
const DRAG_THRESHOLD_PX = 6;

function getDefaultPosition(): FloatingPosition {
  if (typeof window === 'undefined') {
    return { x: 316, y: 730 };
  }
  return clampFloatingPosition({
    x: window.innerWidth - BUTTON_SIZE - EDGE_MARGIN,
    y: window.innerHeight - BUTTON_SIZE - 20,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    buttonSize: BUTTON_SIZE,
    margin: EDGE_MARGIN,
    topMargin: TOP_MARGIN,
  });
}

function loadSavedPosition(storageKey: string): FloatingPosition {
  if (typeof window === 'undefined') return getDefaultPosition();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return getDefaultPosition();
    const parsed = JSON.parse(raw) as Partial<FloatingPosition>;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return clampFloatingPosition({
        x: parsed.x,
        y: parsed.y,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        buttonSize: BUTTON_SIZE,
        margin: EDGE_MARGIN,
        topMargin: TOP_MARGIN,
      });
    }
  } catch {
    // Ignore storage read errors
  }
  return getDefaultPosition();
}

export function DraggableFloatingMenu<T extends string>({
  portalKey,
  portalTitle,
  navItems,
  activeTab,
  onSelectTab,
  ariaLabel,
}: DraggableFloatingMenuProps<T>) {
  const storageKey = `cerdasexam_floating_menu_pos_${portalKey}`;
  const [position, setPosition] = useState<FloatingPosition>(() =>
    loadSavedPosition(storageKey)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dragStateRef = useRef<{
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    moved: boolean;
  }>({
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  const totalBadgeCount = navItems.reduce(
    (sum, item) => sum + (item.badgeCount ?? 0),
    0
  );

  // Re-clamp floating position whenever viewport rotates or resizes
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) =>
        clampFloatingPosition({
          x: prev.x,
          y: prev.y,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          buttonSize: BUTTON_SIZE,
          margin: EDGE_MARGIN,
          topMargin: TOP_MARGIN,
        })
      );
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close popover on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const persistPosition = useCallback(
    (nextPos: FloatingPosition) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextPos));
      } catch {
        // Ignore storage quota errors
      }
    },
    [storageKey]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only primary mouse button or touch
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragStateRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic pointer capture error
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;

    if (!drag.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
      drag.moved = true;
      setIsDragging(true);
      setIsOpen(false);
    }

    if (drag.moved) {
      const clamped = clampFloatingPosition({
        x: drag.originX + dx,
        y: drag.originY + dy,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        buttonSize: BUTTON_SIZE,
        margin: EDGE_MARGIN,
        topMargin: TOP_MARGIN,
      });
      setPosition(clamped);
    }
  };

  const suppressNextClickRef = useRef(false);

  const finishPointerDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (drag.pointerId !== e.pointerId) return;

    const wasMoved = drag.moved;
    drag.pointerId = null;
    drag.moved = false;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }

    if (wasMoved) {
      suppressNextClickRef.current = true;
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      const finalPos = clampFloatingPosition({
        x: drag.originX + dx,
        y: drag.originY + dy,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        buttonSize: BUTTON_SIZE,
        margin: EDGE_MARGIN,
        topMargin: TOP_MARGIN,
      });
      setPosition(finalPos);
      persistPosition(finalPos);
    }
  };

  const handleButtonClick = () => {
    // Only toggle menu when user tapped without dragging
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (isDragging) return;
    setIsOpen((prev) => !prev);
  };

  const viewportWidth =
    typeof window !== 'undefined' ? window.innerWidth : 390;
  const viewportHeight =
    typeof window !== 'undefined' ? window.innerHeight : 844;
  const placement = resolveFloatingPopoverPlacement({
    x: position.x,
    y: position.y,
    viewportWidth,
    viewportHeight,
    buttonSize: BUTTON_SIZE,
  });

  return (
    <div className="lg:hidden">
      {/* Transparent backdrop to dismiss floating menu when tapping outside */}
      {isOpen && (
        <div
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[1px]"
        />
      )}

      {/* Draggable Floating Anchor Container */}
      <div
        data-testid={`floating-nav-${portalKey}`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
        }}
        className="fixed top-0 left-0 z-50 will-change-transform"
      >
        {/* Smart-Anchored Compact Floating Menu Popover */}
        {isOpen && (
          <nav
            aria-label={ariaLabel}
            data-testid={`floating-nav-panel-${portalKey}`}
            className={`absolute w-56 max-w-[calc(100vw-28px)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl p-1.5 ${
              placement.vertical === 'up' ? 'bottom-[62px]' : 'top-[62px]'
            } ${placement.horizontal === 'left' ? 'right-0' : 'left-0'}`}
          >
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">
                  {portalTitle}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Tahan & geser untuk memindah
                </div>
              </div>
              <GripHorizontal
                aria-hidden="true"
                className="h-3.5 w-3.5 text-slate-400 shrink-0"
              />
            </div>

            <div className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setIsOpen(false);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`flex w-full min-h-[40px] items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badgeCount !== undefined && item.badgeCount > 0 && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold font-mono tabular-nums shrink-0 ${
                          active
                            ? 'bg-white text-indigo-700'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {item.badgeCount > 99 ? '99+' : item.badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* Draggable Circular Menu Trigger Button */}
        <button
          type="button"
          data-testid={`floating-nav-trigger-${portalKey}`}
          aria-label={
            isOpen
              ? `Tutup ${ariaLabel}`
              : `Buka ${ariaLabel} (tahan dan geser untuk memindahkan)`
          }
          aria-expanded={isOpen}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onClick={handleButtonClick}
          style={{ touchAction: 'none' }}
          className={`relative flex h-full w-full items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/35 ring-2 ring-white/90 dark:ring-slate-900 select-none transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400 ${
            isDragging
              ? 'scale-110 cursor-grabbing bg-indigo-700'
              : 'cursor-grab hover:bg-indigo-700 active:scale-95'
          }`}
        >
          {isOpen ? (
            <X className="h-6 w-6 pointer-events-none" />
          ) : (
            <Menu className="h-6 w-6 pointer-events-none" />
          )}

          {!isOpen && totalBadgeCount > 0 && (
            <span className="pointer-events-none absolute -top-1 -right-1 min-w-[20px] rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white font-mono tabular-nums text-center ring-2 ring-white dark:ring-slate-900">
              {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
