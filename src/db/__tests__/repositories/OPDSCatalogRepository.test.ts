import { createTestDatabase } from '@/db/testDatabase';
import {
  OPDSCatalogRepository, sanitizeOPDSUrl,
} from '@/db/repositories/OPDSCatalogRepository';
import { secureStorage } from '@/storage/secureStorage';

function newRepo() {
  return new OPDSCatalogRepository(createTestDatabase());
}

describe('sanitizeOPDSUrl', () => {
  test('reject file:// scheme', () => {
    expect(() => sanitizeOPDSUrl('file:///etc/passwd')).toThrow(/scheme/);
  });

  test('reject javascript:', () => {
    expect(() => sanitizeOPDSUrl('javascript:alert(1)')).toThrow();
  });

  test('reject malformed URL', () => {
    expect(() => sanitizeOPDSUrl('not a url')).toThrow(/Invalid/);
  });

  test('accept clean https://', () => {
    const r = sanitizeOPDSUrl('https://example.com/opds');
    expect(r.cleanUrl).toBe('https://example.com/opds');
    expect(r.extractedCreds).toBeNull();
  });

  test('strip userinfo + extract creds', () => {
    const r = sanitizeOPDSUrl('https://alice:secret@calibre.local/opds');
    expect(r.cleanUrl).not.toContain('alice');
    expect(r.cleanUrl).not.toContain('secret');
    expect(r.extractedCreds).toEqual({ username: 'alice', password: 'secret' });
  });

  test('URL-encoded creds декодируются', () => {
    const r = sanitizeOPDSUrl('https://user%40foo:pass%23bar@example.com/');
    expect(r.extractedCreds).toEqual({ username: 'user@foo', password: 'pass#bar' });
  });
});

describe('OPDSCatalogRepository', () => {
  test('create + list (no creds)', async () => {
    const repo = newRepo();
    const c = await repo.create({ name: 'StandardEbooks', url: 'https://standardebooks.org/opds' });
    expect(c.url).toBe('https://standardebooks.org/opds');
    expect(c.requiresAuth).toBe(false);
    const list = await repo.list();
    expect(list.length).toBe(1);
  });

  test('create extract creds → SecureStore + clean URL', async () => {
    const repo = newRepo();
    const c = await repo.create({
      name: 'private',
      url: 'https://alice:secret@private.example/opds',
    });
    expect(c.url).not.toContain('alice');
    expect(c.requiresAuth).toBe(true);
    const stored = await secureStorage.getOPDSCreds(c.id);
    expect(stored).toEqual({ username: 'alice', password: 'secret' });
  });

  test('create explicit creds через input', async () => {
    const repo = newRepo();
    const c = await repo.create({
      name: 'private', url: 'https://opds.example.com/',
      creds: { username: 'bob', password: 'pw' },
    });
    expect(c.requiresAuth).toBe(true);
    expect(await secureStorage.getOPDSCreds(c.id)).toEqual({ username: 'bob', password: 'pw' });
  });

  test('delete очищает creds в SecureStore', async () => {
    const repo = newRepo();
    const c = await repo.create({
      name: 'private',
      url: 'https://x:y@example.com/',
    });
    expect(await secureStorage.getOPDSCreds(c.id)).not.toBeNull();
    await repo.delete(c.id);
    expect(await repo.findById(c.id)).toBeNull();
    expect(await secureStorage.getOPDSCreds(c.id)).toBeNull();
  });

  test('updateLastFetched пишет timestamp', async () => {
    const repo = newRepo();
    const c = await repo.create({ name: 'x', url: 'https://x.com/opds' });
    expect(c.lastFetchedAt).toBeNull();
    const t = Date.now();
    await repo.updateLastFetched(c.id, t);
    expect((await repo.findById(c.id))?.lastFetchedAt).toBe(t);
  });

  test('create reject file:// — нет записи в DB', async () => {
    const repo = newRepo();
    await expect(repo.create({ name: 'evil', url: 'file:///etc/passwd' })).rejects.toThrow();
    expect((await repo.list()).length).toBe(0);
  });
});
