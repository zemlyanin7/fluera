import { sanitizeImageId } from '../shared/sanitizeImageId';

describe('sanitizeImageId', () => {
  it('keeps safe identifiers unchanged', () => {
    expect(sanitizeImageId('cover.jpg')).toBe('cover.jpg');
    expect(sanitizeImageId('img_001.png')).toBe('img_001.png');
    expect(sanitizeImageId('a-b_c.JPEG')).toBe('a-b_c.JPEG');
  });

  it('replaces path separators', () => {
    expect(sanitizeImageId('../etc/passwd')).toBe('___etc_passwd');
    expect(sanitizeImageId('images/cover.jpg')).toBe('images_cover.jpg');
    expect(sanitizeImageId('\\windows\\system32')).toBe('_windows_system32');
  });

  it('replaces non-ascii and special chars', () => {
    // 'обложка' = 7 chars → 7 underscores + '.jpg'
    expect(sanitizeImageId('обложка.jpg')).toBe('_______.jpg');
    expect(sanitizeImageId('img?.png')).toBe('img_.png');
  });

  it('handles empty string', () => {
    expect(sanitizeImageId('')).toBe('');
  });

  it('strips leading dot', () => {
    expect(sanitizeImageId('.htaccess')).toBe('_htaccess');
    expect(sanitizeImageId('..hidden')).toBe('__hidden');
  });
});
