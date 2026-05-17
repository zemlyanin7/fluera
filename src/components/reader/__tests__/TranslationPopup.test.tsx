import React from 'react';
import { render } from '@testing-library/react-native';
import { TranslationPopup, type PopupViewState } from '@/components/reader/TranslationPopup';

const baseState: PopupViewState = {
  visible: true,
  mode: 'word',
  word: 'spring',
  sourceSentence: 'The spring of life.',
  wordOffsetInSentence: 4,
  status: 'loading',
  placement: { mode: 'bottom', arrowDirection: 'right' },
  anchorRect: { x: 100, y: 200, width: 50, height: 20 },
  result: null,
  encounterCount: 0,
  coverageHint: false,
  bookLanguage: 'en',
  nativeLanguage: 'ru',
};

describe('TranslationPopup', () => {
  it('renders word + loading shimmer когда status=loading', () => {
    const { getByText } = render(
      <TranslationPopup
        state={baseState}
        onClose={() => {}}
        onTranslateSentence={() => {}}
        onDislike={() => {}}
      />,
    );
    expect(getByText('spring')).toBeTruthy();
  });

  it('renders translation text when result.translation defined', () => {
    const s: PopupViewState = {
      ...baseState,
      status: 'ready',
      result: { status: 'ok', translation: 'источник' } as any,
    };
    const { getByText } = render(
      <TranslationPopup
        state={s}
        onClose={() => {}}
        onTranslateSentence={() => {}}
        onDislike={() => {}}
      />,
    );
    expect(getByText('источник')).toBeTruthy();
  });

  it('sentence mode shows ExperimentalBadge', () => {
    const s: PopupViewState = {
      ...baseState,
      mode: 'sentence',
      status: 'ready',
      result: {
        status: 'ok',
        translatedSentence: 'Источник жизни.',
        experimental: true,
      } as any,
    };
    const { getByText } = render(
      <TranslationPopup
        state={s}
        onClose={() => {}}
        onTranslateSentence={() => {}}
        onDislike={() => {}}
      />,
    );
    // Jest mock returns EN strings from en.json (translation.experimentalBadge = "⚠️ Experimental translation")
    expect(getByText(/Experimental/i)).toBeTruthy();
  });
});
