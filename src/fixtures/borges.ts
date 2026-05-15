import type { BookChapter, InlineNode } from '@/types/content';

const text = (s: string): InlineNode => ({ type: 'text', text: s });

export const BORGES_SAMPLE: BookChapter = {
  index: 0,
  title: 'I.',
  items: [
    { type: 'paragraph', inlines: [text('On a pale October morning, the tide withdrew further than anyone could remember, leaving the wharf of Vigàta open to the sky like the page of an old atlas.')] },
    { type: 'paragraph', inlines: [text('Stephen wandered between the abandoned boats, counting the small pebbles his daughter had once arranged in the shape of a constellation. He had not been here since the autumn she left.')] },
    { type: 'paragraph', inlines: [text('It was, he thought, the kind of silence that exists only in places that have surrendered their use.')] },
  ],
};

export const BORGES_DICT: Record<string, string> = {
  on: 'на', a: '(артикль)', pale: 'бледный', october: 'октябрь',
  morning: 'утро', the: '(артикль)', tide: 'прилив', withdrew: 'отступил',
  further: 'дальше', than: 'чем', anyone: 'кто-либо', could: 'мог',
  remember: 'помнить', leaving: 'оставляя', wharf: 'пристань', of: '(предлог)',
  open: 'открытый', to: '(предлог)', sky: 'небо', like: 'как',
  page: 'страница', an: '(артикль)', old: 'старый', atlas: 'атлас',
  stephen: 'Стивен', wandered: 'бродил', between: 'между',
  abandoned: 'заброшенный', boats: 'лодки', counting: 'считая',
  small: 'маленькие', pebbles: 'галька', his: 'его', daughter: 'дочь',
  had: '(вспом.)', once: 'однажды', arranged: 'расставила', in: 'в',
  shape: 'форма', constellation: 'созвездие', he: 'он', not: 'не',
  been: 'был', here: 'здесь', since: 'с тех пор как', autumn: 'осень',
  she: 'она', left: 'ушла', it: 'это', was: 'было', thought: 'подумал',
  kind: 'вид', silence: 'тишина', that: 'который', exists: 'существует',
  only: 'только', places: 'места', have: 'имеют', surrendered: 'сдались',
  their: 'их', use: 'использование',
};
