import React from 'react';
import { render } from '@testing-library/react-native';
import { TranslationSection } from '@/components/settings/TranslationSection';

describe('TranslationSection', () => {
  it('shows top-level controls (sentence gesture + smart hints toggle)', () => {
    const { getByText } = render(<TranslationSection />);
    expect(getByText(/Перевод предложения|Sentence/i)).toBeTruthy();
    expect(getByText(/Умные подсказки|Smart hints/i)).toBeTruthy();
  });
});
