import { generateBridgeScript } from '../../../src/services/reader/epubBridgeScript';

describe('epubBridgeScript', () => {
  it('generates valid JavaScript string', () => {
    const script = generateBridgeScript();
    expect(typeof script).toBe('string');
    expect(script.length).toBeGreaterThan(100);
  });

  it('contains wordTap message handler', () => {
    const script = generateBridgeScript();
    expect(script).toContain('wordTap');
    expect(script).toContain('postMessage');
  });

  it('contains phraseSelect handler', () => {
    const script = generateBridgeScript();
    expect(script).toContain('phraseSelect');
    expect(script).toContain('getSelection');
  });

  it('contains locationChange handler', () => {
    const script = generateBridgeScript();
    expect(script).toContain('locationChange');
  });
});
