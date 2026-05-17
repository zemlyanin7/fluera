import React from 'react';
import { render } from '@testing-library/react-native';
import { EncounterBadge } from '@/components/reader/EncounterBadge';

describe('EncounterBadge', () => {
  it('count=0 shows first-encounter label', () => {
    const { getByText } = render(<EncounterBadge count={0} />);
    // Jest mock returns EN strings from en.json (translation.encounter.firstTime = "first encounter")
    expect(getByText(/first encounter/i)).toBeTruthy();
  });

  it('count=2 shows Nth-time label', () => {
    const { getByText } = render(<EncounterBadge count={2} />);
    // translation.encounter.nthTime = "{{ordinal}} time" → "3 time" with ordinal=3
    expect(getByText(/3/i)).toBeTruthy();
  });

  it('count=5 shows familiar label', () => {
    const { getByText } = render(<EncounterBadge count={5} />);
    // Jest mock returns EN strings from en.json (translation.encounter.familiar = "familiar")
    expect(getByText(/familiar/i)).toBeTruthy();
  });

  it('count=10 hides badge', () => {
    const { queryByRole } = render(<EncounterBadge count={10} />);
    expect(queryByRole('text')).toBeNull();
  });
});
