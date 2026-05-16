import { assertSafeXml, assertSafeXmlPermissive } from '@/services/xml/safeParser';

describe('assertSafeXml', () => {
  test('reject ANY DOCTYPE (даже без ENTITY)', () => {
    expect(() => assertSafeXml('<!DOCTYPE foo><foo/>')).toThrow(/DOCTYPE/);
  });

  test('reject case-insensitive DOCTYPE', () => {
    expect(() => assertSafeXml('<!doctype html><x/>')).toThrow(/DOCTYPE/);
  });

  test('reject DOCTYPE с ENTITY (billion laughs attempt)', () => {
    const xml = '<!DOCTYPE foo [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><foo>&lol2;</foo>';
    expect(() => assertSafeXml(xml)).toThrow(/DOCTYPE/);
  });

  test('reject DOCTYPE с SYSTEM URI', () => {
    const xml = '<!DOCTYPE foo SYSTEM "file:///etc/passwd"><foo/>';
    expect(() => assertSafeXml(xml)).toThrow(/DOCTYPE/);
  });

  test('reject xml-stylesheet PI', () => {
    expect(() => assertSafeXml('<?xml-stylesheet href="evil.xsl"?><x/>')).toThrow(/stylesheet/i);
  });

  test('reject payload > maxBytes', () => {
    expect(() => assertSafeXml('a'.repeat(11), { maxBytes: 10 })).toThrow(/too large/i);
  });

  test('default cap 50MB не блокирует small XML', () => {
    expect(() => assertSafeXml('<root/>')).not.toThrow();
  });

  test('accept clean XML', () => {
    expect(() => assertSafeXml('<root><item/></root>')).not.toThrow();
  });

  test('accept XML с xml declaration', () => {
    expect(() => assertSafeXml('<?xml version="1.0" encoding="UTF-8"?><root/>')).not.toThrow();
  });

  test('кастомный maxBytes 5MB для OPDS', () => {
    const big = '<root>' + 'a'.repeat(6 * 1024 * 1024) + '</root>';
    expect(() => assertSafeXml(big, { maxBytes: 5 * 1024 * 1024 })).toThrow(/too large/i);
  });
});

describe('assertSafeXmlPermissive', () => {
  test('allows HTML5 DOCTYPE', () => {
    expect(() => assertSafeXmlPermissive('<!DOCTYPE html><html><body/></html>')).not.toThrow();
  });

  test('rejects DOCTYPE with inline ENTITY', () => {
    expect(() => assertSafeXmlPermissive('<!DOCTYPE foo [<!ENTITY x "y">]><html/>')).toThrow(/Unsafe DOCTYPE/);
  });

  test('rejects DOCTYPE PUBLIC with inline ENTITY subset', () => {
    expect(() => assertSafeXmlPermissive(
      '<!DOCTYPE html PUBLIC "-//W3C" "x.dtd" [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><html/>',
    )).toThrow(/Unsafe DOCTYPE/);
  });

  test('allows DOCTYPE PUBLIC без inline ENTITY (XHTML 1.1)', () => {
    // xmldom не fetch'ит external DTD, безопасно для XHTML stack.
    expect(() => assertSafeXmlPermissive(
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html/>',
    )).not.toThrow();
  });

  test('allows DOCTYPE SYSTEM без inline ENTITY', () => {
    expect(() => assertSafeXmlPermissive('<!DOCTYPE html SYSTEM "x.dtd"><html/>')).not.toThrow();
  });

  test('rejects xml-stylesheet PI', () => {
    expect(() => assertSafeXmlPermissive('<?xml-stylesheet href="evil.xsl"?><x/>')).toThrow(/stylesheet/i);
  });

  test('accepts XHTML без doctype', () => {
    expect(() => assertSafeXmlPermissive('<html xmlns="http://www.w3.org/1999/xhtml"><body><p>hi</p></body></html>')).not.toThrow();
  });
});
