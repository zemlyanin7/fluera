import React from 'react';
import { render } from '@testing-library/react-native';
import { ExperimentalBadge } from '@/components/reader/ExperimentalBadge';

describe('ExperimentalBadge', () => {
  it('renders с warning icon + russian label', () => {
    const { getByText } = render(<ExperimentalBadge />);
    expect(getByText(/Экспериментальный/i)).toBeTruthy();
  });

  it('has accessibilityRole=alert', () => {
    const { getByRole } = render(<ExperimentalBadge />);
    expect(getByRole('alert')).toBeTruthy();
  });
});
