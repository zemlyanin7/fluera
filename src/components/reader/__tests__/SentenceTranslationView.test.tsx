import React from 'react';
import { render } from '@testing-library/react-native';
import { SentenceTranslationView } from '@/components/reader/SentenceTranslationView';

describe('SentenceTranslationView', () => {
  it('renders source + translation', () => {
    const { getByText } = render(
      <SentenceTranslationView
        sourceSentence="The spring of life."
        translatedSentence="Источник жизни."
        sourceWordOffset={4}
        sourceWord="spring"
        translatedWordOffset={0}
      />,
    );
    expect(getByText(/The spring of life/)).toBeTruthy();
    expect(getByText(/Источник жизни/)).toBeTruthy();
  });

  it('renders без highlight when translatedWordOffset is undefined (fail-safe)', () => {
    const { queryByLabelText } = render(
      <SentenceTranslationView
        sourceSentence="The spring of life."
        translatedSentence="Источник жизни."
        sourceWordOffset={4}
        sourceWord="spring"
        translatedWordOffset={undefined}
      />,
    );
    expect(queryByLabelText(/aligned/i)).toBeNull();
  });
});
