import React from 'react';
import { render } from '@testing-library/react-native';
import { FeedbackList } from '@/components/settings/FeedbackList';

describe('FeedbackList', () => {
  it('empty state shows placeholder', () => {
    const { getByText } = render(<FeedbackList items={[]} onClearAll={() => {}} />);
    expect(getByText(/Жалоб пока нет|No feedback yet/i)).toBeTruthy();
  });

  it('renders items source+translated', () => {
    const items = [
      { id: '1', sourceSentence: 'Hello.', translatedSentence: 'Привет.', bookLanguage: 'en', nativeLanguage: 'ru', modelVersion: 'mv1', kernelBuildId: null, bookId: null, createdAt: 1000 },
    ];
    const { getByText } = render(<FeedbackList items={items} onClearAll={() => {}} />);
    expect(getByText(/Hello\./)).toBeTruthy();
    expect(getByText(/Привет\./)).toBeTruthy();
  });
});
