import React from 'react';
import type { ContentItem } from '@/types/content';
import type { ScriptId } from '@/theme/scripts';
import { ParagraphRender } from './ParagraphRender';
import { HeadingRender } from './HeadingRender';
import { ImageRender } from './ImageRender';
import { BlockquoteRender } from './BlockquoteRender';
import { ListRender } from './ListRender';
import { SeparatorRender } from './SeparatorRender';
import { TableRowRender } from './TableRowRender';

interface Props {
  item: ContentItem;
  onWordTap: (word: string, sentence: string) => void;
  fontSize: number;
  script: ScriptId;
  bookId?: string;
}

export const ContentItemRenderer = React.memo(function ContentItemRenderer(props: Props) {
  switch (props.item.type) {
    case 'paragraph':
      return (
        <ParagraphRender
          inlines={props.item.inlines}
          style={props.item.style}
          onWordTap={props.onWordTap}
          fontSize={props.fontSize}
          script={props.script}
        />
      );
    case 'heading':
      return <HeadingRender level={props.item.level} inlines={props.item.inlines} />;
    case 'image':
      return (
        <ImageRender
          bookId={props.bookId ?? ''}
          src={props.item.src}
          alt={props.item.alt}
          aspectRatio={props.item.aspectRatio}
        />
      );
    case 'blockquote':
      return (
        <BlockquoteRender
          items={props.item.items}
          onWordTap={props.onWordTap}
          fontSize={props.fontSize}
          script={props.script}
          bookId={props.bookId}
        />
      );
    case 'list':
      return (
        <ListRender
          ordered={props.item.ordered}
          items={props.item.items}
          onWordTap={props.onWordTap}
          fontSize={props.fontSize}
          script={props.script}
          bookId={props.bookId}
        />
      );
    case 'separator':
      return <SeparatorRender />;
    case 'table-row':
      return (
        <TableRowRender
          cells={props.item.cells}
          onWordTap={props.onWordTap}
          fontSize={props.fontSize}
          script={props.script}
        />
      );
  }
});
