import { render } from '@testing-library/react-native';
import { CoverThumbnail } from '../CoverThumbnail';

describe('CoverThumbnail', () => {
  it('renders Image when coverPath provided', () => {
    const { UNSAFE_root } = render(
      <CoverThumbnail coverPath="/mock/books/b/images/cover.jpg" title="My Book" />,
    );
    expect(UNSAFE_root).toBeTruthy();
  });

  it('renders letter fallback when no cover', () => {
    const { getByText } = render(<CoverThumbnail coverPath={null} title="Alchemist" />);
    expect(getByText('A')).toBeTruthy();
  });

  it('falls back to "?" for empty title', () => {
    const { getByText } = render(<CoverThumbnail coverPath={null} title="" />);
    expect(getByText('?')).toBeTruthy();
  });
});
