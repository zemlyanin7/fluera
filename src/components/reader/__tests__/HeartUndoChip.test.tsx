import React from 'react';
import { render, act } from '@testing-library/react-native';
import { HeartUndoChip } from '@/components/reader/HeartUndoChip';

jest.useFakeTimers();

describe('HeartUndoChip', () => {
  it('renders Отменить button when visible=true', () => {
    const { getByText } = render(<HeartUndoChip onUndo={() => {}} visible={true} />);
    expect(getByText(/Отменить/i)).toBeTruthy();
  });

  it('auto-dismisses через 3000ms', () => {
    const { queryByText } = render(<HeartUndoChip onUndo={() => {}} visible={true} />);
    expect(queryByText(/Отменить/i)).toBeTruthy();
    act(() => { jest.advanceTimersByTime(3100); });
    expect(queryByText(/Отменить/i)).toBeNull();
  });
});
