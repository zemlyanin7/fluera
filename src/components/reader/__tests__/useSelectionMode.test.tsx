import { renderHook, act } from '@testing-library/react-native';
import { useSelectionMode } from '@/components/reader/useSelectionMode';

describe('useSelectionMode', () => {
  it('enters selection mode на enterAt + range extends', () => {
    const { result } = renderHook(() => useSelectionMode({ maxItemSpan: 50 }));
    act(() => result.current.enterAt({ chapterIdx: 0, itemIdx: 5, charOffset: 10 }));
    expect(result.current.active).toBe(true);
    expect(result.current.range).toEqual({ startItem: 5, endItem: 5, startChar: 10, endChar: 10 });
    act(() => result.current.extendTo({ itemIdx: 7, charOffset: 4 }));
    expect(result.current.range!.endItem).toBe(7);
  });

  it('caps selection при превышении maxItemSpan', () => {
    const { result } = renderHook(() => useSelectionMode({ maxItemSpan: 5 }));
    act(() => result.current.enterAt({ chapterIdx: 0, itemIdx: 0, charOffset: 0 }));
    act(() => result.current.extendTo({ itemIdx: 100, charOffset: 0 }));
    expect(result.current.overCap).toBe(true);
  });

  it('exit clears state', () => {
    const { result } = renderHook(() => useSelectionMode({ maxItemSpan: 50 }));
    act(() => result.current.enterAt({ chapterIdx: 0, itemIdx: 0, charOffset: 0 }));
    act(() => result.current.exit());
    expect(result.current.active).toBe(false);
    expect(result.current.range).toBeNull();
  });
});
