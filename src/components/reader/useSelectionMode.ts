import { useState, useCallback } from 'react';

export interface SelectionAnchor {
  chapterIdx?: number;
  itemIdx: number;
  charOffset: number;
}

export interface SelectionRange {
  startItem: number;
  endItem: number;
  startChar: number;
  endChar: number;
}

export interface UseSelectionModeOptions {
  maxItemSpan: number;
}

export function useSelectionMode(opts: UseSelectionModeOptions) {
  const [active, setActive] = useState(false);
  const [range, setRange] = useState<SelectionRange | null>(null);
  const [overCap, setOverCap] = useState(false);

  const enterAt = useCallback((anchor: SelectionAnchor) => {
    setActive(true);
    setOverCap(false);
    setRange({
      startItem: anchor.itemIdx,
      endItem: anchor.itemIdx,
      startChar: anchor.charOffset,
      endChar: anchor.charOffset,
    });
  }, []);

  const extendTo = useCallback(
    (anchor: SelectionAnchor) => {
      setRange((prev) => {
        if (!prev) return prev;
        const startItem = Math.min(prev.startItem, anchor.itemIdx);
        const endItem = Math.max(prev.startItem, anchor.itemIdx);
        const startChar = anchor.itemIdx >= prev.startItem ? prev.startChar : anchor.charOffset;
        const endChar = anchor.itemIdx >= prev.startItem ? anchor.charOffset : prev.startChar;
        const span = endItem - startItem;
        if (span > opts.maxItemSpan) setOverCap(true);
        return { startItem, endItem, startChar, endChar };
      });
    },
    [opts.maxItemSpan],
  );

  const exit = useCallback(() => {
    setActive(false);
    setRange(null);
    setOverCap(false);
  }, []);

  return { active, range, overCap, enterAt, extendTo, exit };
}
