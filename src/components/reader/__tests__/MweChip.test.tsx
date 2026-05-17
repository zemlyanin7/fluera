import React from 'react';
import { render } from '@testing-library/react-native';
import { MweChip } from '@/components/reader/MweChip';

describe('MweChip', () => {
  it('renders phrase type tag', () => {
    const { getByText } = render(<MweChip type="idiom" />);
    expect(getByText(/идиома/i)).toBeTruthy();
  });

  it('renders phrasal_verb', () => {
    const { getByText } = render(<MweChip type="phrasal_verb" />);
    expect(getByText(/phrasal/i)).toBeTruthy();
  });
});
