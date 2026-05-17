import React from 'react';
import { render } from '@testing-library/react-native';
import { ExperimentalBadge } from '@/components/reader/ExperimentalBadge';

describe('ExperimentalBadge', () => {
  it('renders с warning icon + translation key label', () => {
    const { getByText } = render(<ExperimentalBadge />);
    // Jest mock returns EN strings from en.json (translation.experimentalBadge)
    expect(getByText(/Experimental/i)).toBeTruthy();
  });

  it('has accessibilityRole=alert', () => {
    const { getByRole } = render(<ExperimentalBadge />);
    expect(getByRole('alert')).toBeTruthy();
  });
});
