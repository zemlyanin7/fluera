import { choosePopupPlacement } from '@/components/reader/PopupPlacement';

// v2.2.1: choosePopupPlacement всегда возвращает modalSheet (юзер-фидбек —
// sheet снизу удобнее, чем top/bottom anchored popover). Тесты обновлены.
describe('choosePopupPlacement', () => {
  it('всегда возвращает modalSheet независимо от позиции тапа', () => {
    const top = choosePopupPlacement({ tapY: 100, screenHeight: 800, popupEstimatedHeight: 200, pageContentHeight: 800, isRTL: false });
    expect(top.mode).toBe('modalSheet');

    const bottom = choosePopupPlacement({ tapY: 700, screenHeight: 800, popupEstimatedHeight: 200, pageContentHeight: 800, isRTL: false });
    expect(bottom.mode).toBe('modalSheet');

    const narrow = choosePopupPlacement({ tapY: 200, screenHeight: 300, popupEstimatedHeight: 250, pageContentHeight: 300, isRTL: false });
    expect(narrow.mode).toBe('modalSheet');
  });

  it('RTL flips arrowDirection', () => {
    const r = choosePopupPlacement({ tapY: 100, screenHeight: 800, popupEstimatedHeight: 200, pageContentHeight: 800, isRTL: true });
    expect(r.arrowDirection).toBe('left');
    const r2 = choosePopupPlacement({ tapY: 100, screenHeight: 800, popupEstimatedHeight: 200, pageContentHeight: 800, isRTL: false });
    expect(r2.arrowDirection).toBe('right');
  });
});
