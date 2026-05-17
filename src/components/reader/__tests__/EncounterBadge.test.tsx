import React from 'react';
import { render } from '@testing-library/react-native';
import { EncounterBadge } from '@/components/reader/EncounterBadge';

describe('EncounterBadge', () => {
  it('count=0 shows "впервые встречаете"', () => {
    const { getByText } = render(<EncounterBadge count={0} />);
    expect(getByText(/впервые/i)).toBeTruthy();
  });

  it('count=2 shows N-й раз label', () => {
    const { getByText } = render(<EncounterBadge count={2} />);
    expect(getByText(/3-й раз/i)).toBeTruthy();
  });

  it('count=5 shows "знакомое"', () => {
    const { getByText } = render(<EncounterBadge count={5} />);
    expect(getByText(/знакомое/i)).toBeTruthy();
  });

  it('count=10 hides badge', () => {
    const { queryByRole } = render(<EncounterBadge count={10} />);
    expect(queryByRole('text')).toBeNull();
  });
});
