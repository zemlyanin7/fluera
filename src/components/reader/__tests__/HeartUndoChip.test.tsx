import React from 'react';
import { render, act } from '@testing-library/react-native';
import { HeartUndoChip } from '@/components/reader/HeartUndoChip';

jest.useFakeTimers();

describe('HeartUndoChip', () => {
  it('renders Undo button when visible=true', () => {
    const { getByText } = render(<HeartUndoChip onUndo={() => {}} visible={true} />);
    expect(getByText(/Undo/i)).toBeTruthy();
  });

  it('auto-dismisses after 3000ms', () => {
    const { queryByText } = render(<HeartUndoChip onUndo={() => {}} visible={true} />);
    expect(queryByText(/Undo/i)).toBeTruthy();
    act(() => { jest.advanceTimersByTime(3100); });
    expect(queryByText(/Undo/i)).toBeNull();
  });
});
