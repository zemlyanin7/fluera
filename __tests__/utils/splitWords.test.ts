import { splitWords } from '@/utils/splitWords';

describe('splitWords', () => {
  test('empty → []', () => expect(splitWords('')).toEqual([]));
  test('one word', () => expect(splitWords('hello')).toEqual([{ kind: 'word', text: 'hello' }]));
  test('two words', () => expect(splitWords('hello world')).toEqual([
    { kind: 'word', text: 'hello' }, { kind: 'space', text: ' ' }, { kind: 'word', text: 'world' },
  ]));
  test('punct separate', () => expect(splitWords('Hi, you.')).toEqual([
    { kind: 'word', text: 'Hi' }, { kind: 'punct', text: ',' }, { kind: 'space', text: ' ' },
    { kind: 'word', text: 'you' }, { kind: 'punct', text: '.' },
  ]));
  test('latin diacritic', () => expect(splitWords('café')).toEqual([{ kind: 'word', text: 'café' }]));
  test('cyrillic', () => expect(splitWords('Привет мир')).toEqual([
    { kind: 'word', text: 'Привет' }, { kind: 'space', text: ' ' }, { kind: 'word', text: 'мир' },
  ]));
  test("apostrophe inside word", () => expect(splitWords("don't")).toEqual([{ kind: 'word', text: "don't" }]));
});
