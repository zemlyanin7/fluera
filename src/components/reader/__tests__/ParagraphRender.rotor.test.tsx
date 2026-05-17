import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import { ParagraphRender } from '@/components/reader/ParagraphRender';

describe('ParagraphRender rotor actions', () => {
  it('translateSentence action calls onTranslateSentence', () => {
    const handler = jest.fn();
    const item = { type: 'paragraph', inlines: [{ type: 'text', text: 'Hello world.' }] };
    const { UNSAFE_getAllByType } = render(
      <ParagraphRender
        inlines={item.inlines as any}
        onWordTap={() => {}}
        onWordLongPress={() => {}}
        onTranslateSentence={handler}
        onEnterSelectionMode={() => {}}
        fontSize={16}
        script="latin"
      />,
    );
    const views = UNSAFE_getAllByType(View);
    // Find View with accessibilityActions prop
    const rotorView = views.find((v: any) => v.props.accessibilityActions);
    expect(rotorView).toBeDefined();
    fireEvent(rotorView!, 'accessibilityAction', { nativeEvent: { actionName: 'translateSentence' } });
    expect(handler).toHaveBeenCalled();
  });

  it('extendSelection action calls onEnterSelectionMode', () => {
    const handler = jest.fn();
    const item = { type: 'paragraph', inlines: [{ type: 'text', text: 'Hello world.' }] };
    const { UNSAFE_getAllByType } = render(
      <ParagraphRender
        inlines={item.inlines as any}
        onWordTap={() => {}}
        onTranslateSentence={() => {}}
        onEnterSelectionMode={handler}
        fontSize={16}
        script="latin"
      />,
    );
    const views = UNSAFE_getAllByType(View);
    const rotorView = views.find((v: any) => v.props.accessibilityActions);
    expect(rotorView).toBeDefined();
    fireEvent(rotorView!, 'accessibilityAction', { nativeEvent: { actionName: 'extendSelection' } });
    expect(handler).toHaveBeenCalled();
  });
});
