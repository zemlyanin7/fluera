export interface DragInput {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function exceedsDragThreshold(input: DragInput, thresholdPx: number): boolean {
  const dx = input.currentX - input.startX;
  const dy = input.currentY - input.startY;
  return Math.sqrt(dx * dx + dy * dy) > thresholdPx;
}
