import React from 'react';
import { render } from '@testing-library/react-native';
import { TranslationPopup, type PopupViewState } from '@/components/reader/TranslationPopup';

const baseState: PopupViewState = {
  visible: true,
  mode: 'word',
  word: 'A',
  sourceSentence: 'A B.',
  wordOffsetInSentence: 0,
  status: 'ready',
  placement: { mode: 'bottom', arrowDirection: 'right' },
  anchorRect: { x: 0, y: 0, width: 0, height: 0 },
  result: { status: 'ok', translation: 'А' } as any,
  encounterCount: 0,
  coverageHint: false,
  bookLanguage: 'en',
  nativeLanguage: 'ru',
};

describe('TranslationPopup adjacent-word switch', () => {
  it('keeps popup mounted when word changes (re-render, not unmount/remount)', () => {
    const state1: PopupViewState = baseState;
    const state2: PopupViewState = { ...state1, word: 'B', result: { status: 'ok', translation: 'Б' } as any };
    const { rerender, queryByText } = render(
      <TranslationPopup
        state={state1}
        onClose={() => {}}
        onTranslateSentence={() => {}}
        onDislike={() => {}}
      />,
    );
    rerender(
      <TranslationPopup
        state={state2}
        onClose={() => {}}
        onTranslateSentence={() => {}}
        onDislike={() => {}}
      />,
    );
    expect(queryByText('B')).toBeTruthy();
  });
});
