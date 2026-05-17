import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FalseFriendChip } from '@/components/reader/FalseFriendChip';

describe('FalseFriendChip', () => {
  it('compact mode shows ≠ looksLike', () => {
    const { getByText } = render(
      <FalseFriendChip looksLike="magazine" actualMeaning="shop" expanded={false} onToggle={() => {}} />,
    );
    expect(getByText(/magazine/)).toBeTruthy();
  });

  it('expanded shows actualMeaning', () => {
    const { getByText } = render(
      <FalseFriendChip looksLike="magazine" actualMeaning="shop" expanded={true} onToggle={() => {}} />,
    );
    expect(getByText(/shop/i)).toBeTruthy();
  });

  it('press toggles', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(
      <FalseFriendChip looksLike="magazine" actualMeaning="shop" expanded={false} onToggle={onToggle} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onToggle).toHaveBeenCalled();
  });
});
