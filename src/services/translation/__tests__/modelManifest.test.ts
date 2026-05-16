import { MODEL_MANIFEST, getModelLocalPath, getModelPartialPath, getModelLocalDir } from '../modelManifest';

describe('modelManifest', () => {
  it('has valid SHA-256 hex (placeholder allowed during dev)', () => {
    expect(MODEL_MANIFEST.sha256).toMatch(/^[0-9a-f]{64}$/i);
  });

  it('uses HTTPS URL', () => {
    expect(MODEL_MANIFEST.url).toMatch(/^https:\/\//);
  });

  it('has positive sizeBytes', () => {
    expect(MODEL_MANIFEST.sizeBytes).toBeGreaterThan(0);
  });

  it('getModelLocalPath ends with .gguf', () => {
    expect(getModelLocalPath()).toMatch(/\.gguf$/);
  });

  it('getModelPartialPath ends with .partial', () => {
    expect(getModelPartialPath()).toMatch(/\.partial$/);
  });

  it('getModelLocalDir ends with /', () => {
    expect(getModelLocalDir()).toMatch(/\/$/);
  });
});
