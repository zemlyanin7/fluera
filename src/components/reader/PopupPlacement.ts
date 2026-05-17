export interface PlacementInput {
  tapY: number;
  screenHeight: number;
  popupEstimatedHeight: number;
  pageContentHeight: number;
  isRTL: boolean;
}

export interface PlacementResult {
  mode: 'top' | 'bottom' | 'modalSheet';
  arrowDirection: 'left' | 'right';
}

export function choosePopupPlacement(input: PlacementInput): PlacementResult {
  const topSpace = input.tapY;
  const bottomSpace = input.screenHeight - input.tapY;
  const fitsAbove = topSpace >= input.popupEstimatedHeight;
  const fitsBelow = bottomSpace >= input.popupEstimatedHeight;
  const arrow: 'left' | 'right' = input.isRTL ? 'left' : 'right';

  if (!fitsAbove && !fitsBelow) {
    return { mode: 'modalSheet', arrowDirection: arrow };
  }
  if (fitsBelow && bottomSpace >= topSpace) {
    return { mode: 'bottom', arrowDirection: arrow };
  }
  if (fitsAbove) {
    return { mode: 'top', arrowDirection: arrow };
  }
  return { mode: bottomSpace >= topSpace ? 'bottom' : 'top', arrowDirection: arrow };
}
