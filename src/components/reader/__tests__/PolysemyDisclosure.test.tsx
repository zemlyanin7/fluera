import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PolysemyDisclosure } from '@/components/reader/PolysemyDisclosure';

describe('PolysemyDisclosure', () => {
  it('renders count label collapsed', () => {
    const { getByText } = render(
      <PolysemyDisclosure senses={[{ sense: 'noun', translation: 'значение' }, { sense: 'verb', translation: 'действие' }]} />,
    );
    expect(getByText(/2/)).toBeTruthy();
  });

  it('toggles expanded on press', () => {
    const { getByRole, queryByText } = render(
      <PolysemyDisclosure senses={[{ sense: 'noun', translation: 'значение' }]} />,
    );
    expect(queryByText('значение')).toBeNull();
    fireEvent.press(getByRole('button'));
    expect(queryByText('значение')).toBeTruthy();
  });

  it('returns null when no senses', () => {
    const { queryByRole } = render(<PolysemyDisclosure senses={[]} />);
    expect(queryByRole('button')).toBeNull();
  });
});
