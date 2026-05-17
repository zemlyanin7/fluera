import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PolysemyChip } from '@/components/reader/PolysemyChip';

describe('PolysemyChip', () => {
  it('renders +polysemy chip', () => {
    const { getByText } = render(<PolysemyChip />);
    expect(getByText(/polysemy/i)).toBeTruthy();
  });

  it('tap expands explanation', () => {
    const { getByRole, queryByText } = render(<PolysemyChip />);
    expect(queryByText(/multiple meanings/i)).toBeNull();
    fireEvent.press(getByRole('button'));
    expect(queryByText(/multiple meanings/i)).toBeTruthy();
  });
});
