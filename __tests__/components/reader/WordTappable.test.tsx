import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { WordTappable } from '../../../src/components/reader/WordTappable';

// Mock Tamagui
jest.mock('tamagui', () => ({
  Text: ({ children, onPress, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text onPress={onPress} {...props}>{children}</Text>;
  },
}));

describe('WordTappable', () => {
  it('renders the word text', () => {
    const { getByText } = render(
      <WordTappable
        word="hello"
        sentenceContext="Say hello to the world."
        onWordTap={jest.fn()}
        color="#4a90d9"
      />,
    );
    expect(getByText('hello')).toBeTruthy();
  });

  it('calls onWordTap with word and sentence when pressed', () => {
    const onTap = jest.fn();
    const { getByText } = render(
      <WordTappable
        word="hello"
        sentenceContext="Say hello to the world."
        onWordTap={onTap}
        color="#4a90d9"
      />,
    );
    fireEvent.press(getByText('hello'));
    expect(onTap).toHaveBeenCalledWith('hello', 'Say hello to the world.');
  });
});
