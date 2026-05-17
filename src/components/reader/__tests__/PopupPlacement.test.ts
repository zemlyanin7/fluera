import { choosePopupPlacement } from '@/components/reader/PopupPlacement';

describe('choosePopupPlacement', () => {
  it('bottom when more space below', () => {
    const r = choosePopupPlacement({ tapY: 100, screenHeight: 800, popupEstimatedHeight: 200, pageContentHeight: 800, isRTL: false });
    expect(r.mode).toBe('bottom');
  });

  it('top when more space above', () => {
    const r = choosePopupPlacement({ tapY: 700, screenHeight: 800, popupEstimatedHeight: 200, pageContentHeight: 800, isRTL: false });
    expect(r.mode).toBe('top');
  });

  it('modalSheet когда popup не помещается ни вверху, ни внизу', () => {
    const r = choosePopupPlacement({ tapY: 200, screenHeight: 300, popupEstimatedHeight: 250, pageContentHeight: 300, isRTL: false });
    expect(r.mode).toBe('modalSheet');
  });

  it('RTL flips arrowDirection', () => {
    const r = choosePopupPlacement({ tapY: 100, screenHeight: 800, popupEstimatedHeight: 200, pageContentHeight: 800, isRTL: true });
    expect(r.arrowDirection).toBe('left');
    const r2 = choosePopupPlacement({ tapY: 100, screenHeight: 800, popupEstimatedHeight: 200, pageContentHeight: 800, isRTL: false });
    expect(r2.arrowDirection).toBe('right');
  });
});
