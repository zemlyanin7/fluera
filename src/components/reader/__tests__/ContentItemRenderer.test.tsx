import { fireEvent, render } from '@testing-library/react-native';
import { ContentItemRenderer } from '../ContentItemRenderer';

describe('ContentItemRenderer', () => {
  it('routes paragraph type and fires word tap', () => {
    const onTap = jest.fn();
    const { getByText } = render(
      <ContentItemRenderer
        item={{ type: 'paragraph', inlines: [{ type: 'text', text: 'hello world' }] }}
        onWordTap={onTap}
        fontSize={17}
        script="latin"
      />,
    );
    expect(getByText('hello')).toBeTruthy();
    fireEvent.press(getByText('hello'));
    expect(onTap).toHaveBeenCalledWith('hello', expect.any(String));
  });

  it('routes heading type', () => {
    const { getByText } = render(
      <ContentItemRenderer
        item={{ type: 'heading', level: 1, inlines: [{ type: 'text', text: 'Title' }] }}
        onWordTap={jest.fn()}
        fontSize={17}
        script="latin"
      />,
    );
    expect(getByText('Title')).toBeTruthy();
  });

  it('routes separator type', () => {
    const { toJSON } = render(
      <ContentItemRenderer
        item={{ type: 'separator' }}
        onWordTap={jest.fn()}
        fontSize={17}
        script="latin"
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('routes blockquote type with nested content', () => {
    const { getByText } = render(
      <ContentItemRenderer
        item={{
          type: 'blockquote',
          items: [{ type: 'paragraph', inlines: [{ type: 'text', text: 'quoted text' }] }],
        }}
        onWordTap={jest.fn()}
        fontSize={17}
        script="latin"
      />,
    );
    expect(getByText('quoted')).toBeTruthy();
  });

  it('routes list type ordered with numbers', () => {
    const { getByText } = render(
      <ContentItemRenderer
        item={{
          type: 'list',
          ordered: true,
          items: [[{ type: 'paragraph', inlines: [{ type: 'text', text: 'first' }] }]],
        }}
        onWordTap={jest.fn()}
        fontSize={17}
        script="latin"
      />,
    );
    expect(getByText('1.')).toBeTruthy();
    expect(getByText('first')).toBeTruthy();
  });
});
