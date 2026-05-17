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

// v2.2.1 (2026-05-17): юзер-фидбек — всегда показывать попап снизу через Sheet.
// Top/bottom anchored Popover оказался неудобным на телефоне: попап оказывается
// над словом, нужно тянуться пальцем вверх. Modal sheet снизу — natural thumb
// reach, всегда в одном месте, не зависит от позиции тапа.
//
// Параметры PlacementInput оставлены в сигнатуре для совместимости с тестами +
// будущего toggle "popup style" в Settings (v3).
export function choosePopupPlacement(input: PlacementInput): PlacementResult {
  const arrow: 'left' | 'right' = input.isRTL ? 'left' : 'right';
  return { mode: 'modalSheet', arrowDirection: arrow };
}
