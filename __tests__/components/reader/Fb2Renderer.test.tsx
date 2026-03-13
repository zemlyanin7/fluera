// Mock Tamagui and React Native to avoid DOM/browser API requirements in Node
jest.mock('tamagui', () => ({
  Text: ({ children }: any) => children,
  YStack: ({ children }: any) => children,
  XStack: ({ children }: any) => children,
}));

jest.mock('../../../src/components/reader/WordTappable', () => ({
  WordTappable: ({ word }: any) => word,
}));

import { tokenizeIntoWords, extractSentence } from '../../../src/components/reader/Fb2Renderer';

describe('Fb2Renderer utilities', () => {
  describe('tokenizeIntoWords', () => {
    it('splits text into words preserving spaces', () => {
      const tokens = tokenizeIntoWords('Hello world');
      expect(tokens).toEqual([
        { word: 'Hello', trailing: ' ' },
        { word: 'world', trailing: '' },
      ]);
    });

    it('handles punctuation attached to words', () => {
      const tokens = tokenizeIntoWords('Hello, world!');
      expect(tokens).toEqual([
        { word: 'Hello,', trailing: ' ' },
        { word: 'world!', trailing: '' },
      ]);
    });
  });

  describe('extractSentence', () => {
    it('extracts sentence containing the word', () => {
      const text = 'First sentence. Second sentence with target word. Third sentence.';
      const sentence = extractSentence(text, 'target');
      expect(sentence).toBe('Second sentence with target word.');
    });

    it('returns full text if no sentence boundary found', () => {
      const text = 'Just one long text without period';
      const sentence = extractSentence(text, 'long');
      expect(sentence).toBe('Just one long text without period');
    });
  });
});
