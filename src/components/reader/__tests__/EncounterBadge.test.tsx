import React from 'react';
import { render } from '@testing-library/react-native';
import { EncounterBadge } from '@/components/reader/EncounterBadge';

describe('EncounterBadge thresholds (Nation 2001)', () => {
  it('count=0 → "впервые встречаете"', () => {
    const { getByText } = render(<EncounterBadge count={0} />);
    expect(getByText(/впервые встречаете/i)).toBeTruthy();
  });

  it('count=1 → "2-й раз"', () => {
    const { getByText } = render(<EncounterBadge count={1} />);
    expect(getByText(/2-й раз/i)).toBeTruthy();
  });

  it('count=3 → "4-й раз, формируется узнавание"', () => {
    const { getByText } = render(<EncounterBadge count={3} />);
    expect(getByText(/4-й раз/i)).toBeTruthy();
    expect(getByText(/формируется/i)).toBeTruthy();
  });

  it('count=6 → "7-й раз — закрепляется" (milestone)', () => {
    const { getByText } = render(<EncounterBadge count={6} />);
    expect(getByText(/закрепляется/i)).toBeTruthy();
  });

  it('count=10 → "хорошо знакомо"', () => {
    const { getByText } = render(<EncounterBadge count={10} />);
    expect(getByText(/хорошо знакомо/i)).toBeTruthy();
  });

  it('count=15 → hidden', () => {
    const { queryByText } = render(<EncounterBadge count={15} />);
    expect(queryByText(/.+/)).toBeNull();
  });
});
