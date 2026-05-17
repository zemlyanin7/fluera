import React from 'react';
import { render } from '@testing-library/react-native';
import { EncounterBadge } from '@/components/reader/EncounterBadge';

describe('EncounterBadge thresholds (Nation 2001)', () => {
  it('count=0 → first-time label', () => {
    const { getByText } = render(<EncounterBadge count={0} />);
    expect(getByText(/first time/i)).toBeTruthy();
  });

  it('count=1 → nth-time label', () => {
    const { getByText } = render(<EncounterBadge count={1} />);
    expect(getByText(/2th time/i)).toBeTruthy();
  });

  it('count=3 → forming label', () => {
    const { getByText } = render(<EncounterBadge count={3} />);
    expect(getByText(/recognition forming/i)).toBeTruthy();
  });

  it('count=6 → consolidating label (milestone)', () => {
    const { getByText } = render(<EncounterBadge count={6} />);
    expect(getByText(/consolidating/i)).toBeTruthy();
  });

  it('count=10 → well known label', () => {
    const { getByText } = render(<EncounterBadge count={10} />);
    expect(getByText(/well known/i)).toBeTruthy();
  });

  it('count=15 → hidden', () => {
    const { queryByText } = render(<EncounterBadge count={15} />);
    expect(queryByText(/.+/)).toBeNull();
  });
});
