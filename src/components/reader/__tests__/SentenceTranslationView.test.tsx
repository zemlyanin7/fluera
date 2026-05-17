import React from 'react';
import { render } from '@testing-library/react-native';
import { SentenceTranslationView } from '@/components/reader/SentenceTranslationView';
import type { InlineNode } from '@/types/content';

describe('SentenceTranslationView v2', () => {
  it('renders source + translation', () => {
    const inlines: InlineNode[] = [{ type: 'text', text: 'Hello world.' }];
    const { getByText } = render(
      <SentenceTranslationView
        sourceInlines={inlines}
        sourcePlainText="Hello world."
        translatedSentence="Привет мир."
        sourceWordOffset={6}
        sourceWordLength={5}
        translatedWordOffset={7}
      />,
    );
    expect(getByText(/Hello world/)).toBeTruthy();
    expect(getByText(/Привет мир/)).toBeTruthy();
  });

  it('preserves italic from sourceInlines', () => {
    const inlines: InlineNode[] = [
      { type: 'italic', children: [{ type: 'text', text: 'She' }] },
      { type: 'text', text: ' walked away.' },
    ];
    const { getByText } = render(
      <SentenceTranslationView
        sourceInlines={inlines}
        sourcePlainText="She walked away."
        translatedSentence="Она ушла."
        sourceWordOffset={4}
        sourceWordLength={6}
        translatedWordOffset={4}
      />,
    );
    const she = getByText('She');
    const styles = Array.isArray(she.props.style)
      ? Object.assign({}, ...she.props.style)
      : she.props.style;
    expect(styles.fontStyle).toBe('italic');
  });

  it('truncated marker "…" appears when wasCapped=true', () => {
    const { getAllByText } = render(
      <SentenceTranslationView
        sourceInlines={[{ type: 'text', text: 'tail' }]}
        sourcePlainText="tail"
        translatedSentence="хвост"
        sourceWordOffset={0}
        sourceWordLength={4}
        translatedWordOffset={0}
        wasCapped={true}
      />,
    );
    const ellipsis = getAllByText('…');
    expect(ellipsis.length).toBeGreaterThanOrEqual(1);
  });
});
