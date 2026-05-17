import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MweChip } from '@/components/reader/MweChip';

describe('MweChip', () => {
  it('renders phrase type tag', () => {
    const { getByText } = render(<MweChip type="idiom" />);
    // Jest mock returns EN strings from en.json (translation.mweType.idiom = "idiom")
    expect(getByText(/idiom/i)).toBeTruthy();
  });

  it('renders phrasal_verb', () => {
    const { getByText } = render(<MweChip type="phrasal_verb" />);
    expect(getByText(/phrasal/i)).toBeTruthy();
  });

  it('tap expands explainer fallback text', () => {
    const { getByRole, queryByText } = render(<MweChip type="idiom" />);
    expect(queryByText(/не складывается/i)).toBeNull();
    fireEvent.press(getByRole('button'));
    expect(queryByText(/не складывается/i)).toBeTruthy();
  });
});
