import type { ContentItem } from '@/types/content';
import { extractSentence } from '../extractSentence';

const para = (text: string): ContentItem => ({
  type: 'paragraph',
  inlines: [{ type: 'text', text }],
});

describe('extractSentence', () => {
  it('returns the sentence containing word', () => {
    const p = para('First sentence. Second one. Third.');
    expect(extractSentence(p, 'Second')).toBe('Second one.');
  });

  it('returns full text when single sentence', () => {
    const p = para('Just one thing');
    expect(extractSentence(p, 'thing')).toBe('Just one thing');
  });

  it('handles question and exclamation marks', () => {
    const p = para('Hello! How are you? Fine.');
    expect(extractSentence(p, 'you')).toBe('How are you?');
  });

  it('returns empty for non-paragraph', () => {
    expect(extractSentence({ type: 'separator' }, 'x')).toBe('');
  });

  it('falls back to full paragraph when word not found', () => {
    const p = para('Lorem ipsum dolor.');
    expect(extractSentence(p, 'missing')).toBe('Lorem ipsum dolor.');
  });
});
