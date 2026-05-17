import { exceedsDragThreshold } from '@/components/reader/gestureDistance';

describe('exceedsDragThreshold', () => {
  it('false при <8px movement', () => {
    expect(exceedsDragThreshold({ startX: 100, startY: 100, currentX: 103, currentY: 105 }, 8)).toBe(false);
  });
  it('true при >8px movement', () => {
    expect(exceedsDragThreshold({ startX: 100, startY: 100, currentX: 110, currentY: 100 }, 8)).toBe(true);
  });
});
