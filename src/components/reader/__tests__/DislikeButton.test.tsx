import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DislikeButton } from '@/components/reader/DislikeButton';

describe('DislikeButton', () => {
  it('renders с label', () => {
    const { getByText } = render(<DislikeButton isDisliked={false} onToggle={() => {}} />);
    // Jest mock returns EN strings from en.json (translation.dislikeLabel)
    expect(getByText(/Bad translation/i)).toBeTruthy();
  });

  it('calls onToggle on press', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(<DislikeButton isDisliked={false} onToggle={onToggle} />);
    fireEvent.press(getByRole('button'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('accessibilityState.selected reflects isDisliked', () => {
    const { getByRole, rerender } = render(<DislikeButton isDisliked={false} onToggle={() => {}} />);
    expect(getByRole('button').props.accessibilityState?.selected).toBe(false);
    rerender(<DislikeButton isDisliked={true} onToggle={() => {}} />);
    expect(getByRole('button').props.accessibilityState?.selected).toBe(true);
  });
});
