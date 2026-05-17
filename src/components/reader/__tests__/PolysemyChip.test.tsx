import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PolysemyChip } from '@/components/reader/PolysemyChip';

describe('PolysemyChip', () => {
  it('renders +полисемия chip', () => {
    const { getByText } = render(<PolysemyChip />);
    expect(getByText(/полисемия/i)).toBeTruthy();
  });

  it('tap expands explanation', () => {
    const { getByRole, queryByText } = render(<PolysemyChip />);
    expect(queryByText(/несколько значений/i)).toBeNull();
    fireEvent.press(getByRole('button'));
    expect(queryByText(/несколько значений/i)).toBeTruthy();
  });
});
