# Translation Engine Implementation Plan (sub-project #4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On-device LLM-перевод одного слова в контексте предложения через `llama.rn` + Hy-MT1.5-1.8B-1.25bit-GGUF. Cache hit <500ms, inference <3s (Pixel 7 / iPhone 13), 13×13 language pairs.

**Architecture:** TranslationService interface поверх LlamaContextManager (llama.rn singleton) + CacheLayer (LRU memory + WatermelonDB persist) + ModelDownloader (HuggingFace → Documents/llm) + LlmStatusStore (Zustand runtime state machine).

**Tech Stack:** llama.rn ^0.5, expo-file-system download/SHA, expo-crypto, WatermelonDB (из #2), Zustand v5, React Native 0.81.5 + Expo SDK 54.

**Spec:** `docs/superpowers/specs/2026-05-17-translation-engine-design.md`

**Branch:** `feat/translation-engine` (stack на `feat/reader-engine`)

---

## Caveats для implementer'а

1. **llama.rn API** в plan'е основан на знаниях агента. Перед Phase 3 проверить
   реальный API через `node_modules/llama.rn/lib/...d.ts` после install.
2. **Hy-MT1.5-1.8B-1.25bit-GGUF SHA-256** в manifest'е — placeholder. Заменить
   на реальный SHA с HuggingFace перед smoke (можно через `huggingface-cli`
   или curl + sha256sum).
3. Тесты mockаются от реального LlamaContext через interface — не нужна модель
   для CI.

---

## Phase 0: Dependencies + native rebuild

### Task 1: Install llama.rn

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `ios/Podfile.lock` (auto на pod install)
- Modify: `android/app/build.gradle` (auto на gradle sync if needed)

- [ ] **Step 1: Install package**

Run:
```bash
npm install llama.rn --legacy-peer-deps
```

Expected: package installed, peer deps warnings ОК.

- [ ] **Step 2: Verify package exists**

Run:
```bash
ls node_modules/llama.rn/lib && cat node_modules/llama.rn/package.json | grep version
```

Expected: directory listing + version output.

- [ ] **Step 3: iOS pod install**

Run:
```bash
cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install && cd ..
```

Expected: `Pod installation complete!` message. Возможно warnings ОК.

- [ ] **Step 4: Inspect llama.rn API**

Run:
```bash
cat node_modules/llama.rn/lib/typescript/index.d.ts | head -100
```

Document findings в `docs/superpowers/notes/2026-05-17-llama-rn-api.md`
(create file):
- Имена export'ов (initLlama, LlamaContext, completion params).
- Тип параметров completion (stop tokens, temperature, max_tokens).
- Streaming support (tokenCallback).

Эти findings нужны для следующих task'ов — если реальный API отличается от
описанного в plan, ADAPT задачи (но придерживайся spec поведения).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json ios/Podfile.lock docs/superpowers/notes/2026-05-17-llama-rn-api.md
git commit -m "feat(translation): install llama.rn + iOS pod install (Task 1)"
```

---

### Task 2: Rebuild dev-client iOS

**Files:** N/A (cleanup-only)

- [ ] **Step 1: Run iOS app**

Run:
```bash
npm run ios
```

Expected: Xcode builds, app launches in simulator. Bundle loads без llama.rn
require errors.

**Если crash на require('llama.rn'):**
- Check: pod is correctly linked in `Podfile.lock`.
- Check: `Pods/llama.rn` directory exists.
- Re-run `pod install`.

- [ ] **Step 2: Smoke test in dev-client**

В симуляторе: open existing book (любой), tap word → TranslationPopup
should still work (NoOpTranslationService fallback). Никаких регрессий
от добавления native dep.

- [ ] **Step 3: Commit** (если есть untracked .xcconfig etc — обычно нет)

Just verify clean state: `git status` → working tree clean.

---

## Phase 1: ModelManifest + utilities

### Task 3: ModelManifest constant

**Files:**
- Create: `src/services/translation/modelManifest.ts`
- Test: `src/services/translation/__tests__/modelManifest.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/modelManifest.test.ts
import { MODEL_MANIFEST, getModelLocalPath } from '../modelManifest';

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
});
```

- [ ] **Step 2: Run test → FAIL**

Run: `npx jest src/services/translation/__tests__/modelManifest.test.ts`
Expected: ERROR Cannot find module '../modelManifest'.

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/modelManifest.ts
import * as FileSystem from 'expo-file-system/legacy';

export interface ModelManifest {
  name: string;
  version: number;
  sha256: string;
  sizeBytes: number;
  url: string;
  filename: string;
}

// SHA-256 placeholder — заменить на реальный hash модели перед smoke.
// Получить через: `curl -sL <URL> | sha256sum` или HuggingFace API.
export const MODEL_MANIFEST: ModelManifest = {
  name: 'Hy-MT1.5-1.8B-1.25bit',
  version: 1,
  sha256: '0000000000000000000000000000000000000000000000000000000000000000',
  sizeBytes: 700_000_000,
  url: 'https://huggingface.co/tencent/Hunyuan-MT-1.5B-1.8B-1.25bit-GGUF/resolve/main/Hy-MT1.5-1.8B-1.25bit.gguf',
  filename: 'Hy-MT1.5-1.8B-1.25bit.gguf',
};

export function getModelLocalDir(): string {
  return `${FileSystem.documentDirectory}llm/`;
}

export function getModelLocalPath(): string {
  return `${getModelLocalDir()}${MODEL_MANIFEST.filename}`;
}

export function getModelPartialPath(): string {
  return `${getModelLocalPath()}.partial`;
}
```

- [ ] **Step 4: Run test → PASS**

Run: same. Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/services/translation/modelManifest.ts src/services/translation/__tests__/modelManifest.test.ts
git commit -m "feat(translation): ModelManifest constant + path helpers (Task 3)"
```

---

### Task 4: SHA-256 verification helper

**Files:**
- Create: `src/services/translation/verifyModel.ts`
- Test: `src/services/translation/__tests__/verifyModel.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/verifyModel.test.ts
import { verifyModelSha256 } from '../verifyModel';

// Mock expo-crypto и expo-file-system
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

describe('verifyModelSha256', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns true on hash match', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('FAKEBASE64');
    (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('abc123');
    const ok = await verifyModelSha256('/path/x.gguf', 'abc123');
    expect(ok).toBe(true);
  });

  it('returns false on hash mismatch', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('FAKEBASE64');
    (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('different');
    const ok = await verifyModelSha256('/path/x.gguf', 'abc123');
    expect(ok).toBe(false);
  });

  it('case-insensitive comparison', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('FAKEBASE64');
    (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('ABC123');
    const ok = await verifyModelSha256('/path/x.gguf', 'abc123');
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test → FAIL**

Expected: Cannot find module '../verifyModel'.

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/verifyModel.ts
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Подсчитать SHA-256 файла и сравнить с expected. Case-insensitive.
 * Для больших файлов (700MB) использует stream-style чтение через base64
 * encoding. ВАЖНО: read целиком в base64 → дешифровать → SHA-256.
 * Альтернатива — chunked hashing — потребует native module (отложено).
 */
export async function verifyModelSha256(
  filePath: string,
  expectedHexLowercase: string,
): Promise<boolean> {
  const base64 = await FileSystem.readAsStringAsync(filePath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  // digestStringAsync ожидает string. Base64 string OK для SHA-256.
  const actual = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64,
  );
  return actual.toLowerCase() === expectedHexLowercase.toLowerCase();
}
```

⚠️ **Note:** SHA-256 of base64-encoded bytes ≠ SHA-256 of raw bytes.
Это implementation limitation. Для consistency expected SHA в manifest'е
должен быть `sha256(base64(file_bytes))`. Альтернатива — native chunked
SHA через JSI (отложено в v2). Документировать в `modelManifest.ts`.

- [ ] **Step 4: Update manifest comment**

```typescript
// src/services/translation/modelManifest.ts (update comment)
// sha256: SHA-256 of base64-encoded model bytes (not raw bytes).
// Получить через: 
//   curl -sL <URL> -o model.gguf && base64 model.gguf | sha256sum
```

- [ ] **Step 5: Run test → PASS**

Expected: 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(translation): verifyModelSha256 helper + manifest doc (Task 4)"
```

---

## Phase 2: LlmStatusStore

### Task 5: Zustand LlmStatusStore

**Files:**
- Create: `src/stores/llmStatusStore.ts`
- Test: `src/stores/__tests__/llmStatusStore.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/stores/__tests__/llmStatusStore.test.ts
import { useLlmStatusStore } from '../llmStatusStore';

describe('llmStatusStore', () => {
  beforeEach(() => {
    useLlmStatusStore.setState({ status: 'not_installed', progress: 0, errorMessage: null });
  });

  it('default state is not_installed', () => {
    expect(useLlmStatusStore.getState().status).toBe('not_installed');
  });

  it('setStatus changes status', () => {
    useLlmStatusStore.getState().setStatus('downloading');
    expect(useLlmStatusStore.getState().status).toBe('downloading');
  });

  it('setProgress clamps to [0,1]', () => {
    useLlmStatusStore.getState().setProgress(-0.5);
    expect(useLlmStatusStore.getState().progress).toBe(0);
    useLlmStatusStore.getState().setProgress(1.5);
    expect(useLlmStatusStore.getState().progress).toBe(1);
    useLlmStatusStore.getState().setProgress(0.42);
    expect(useLlmStatusStore.getState().progress).toBe(0.42);
  });

  it('setError sets errorMessage and status=error if non-null', () => {
    useLlmStatusStore.getState().setError('boom');
    expect(useLlmStatusStore.getState().errorMessage).toBe('boom');
    expect(useLlmStatusStore.getState().status).toBe('error');
  });

  it('setError(null) clears error but does not change status', () => {
    useLlmStatusStore.setState({ status: 'ready', errorMessage: 'old' });
    useLlmStatusStore.getState().setError(null);
    expect(useLlmStatusStore.getState().errorMessage).toBeNull();
    expect(useLlmStatusStore.getState().status).toBe('ready');
  });
});
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/stores/llmStatusStore.ts
import { create } from 'zustand';

export type LlmStatus =
  | 'not_installed'
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'installed'
  | 'loading'
  | 'warming_up'
  | 'ready'
  | 'error';

interface LlmStatusStore {
  status: LlmStatus;
  progress: number; // 0..1
  errorMessage: string | null;
  setStatus: (s: LlmStatus) => void;
  setProgress: (p: number) => void;
  setError: (msg: string | null) => void;
}

export const useLlmStatusStore = create<LlmStatusStore>((set) => ({
  status: 'not_installed',
  progress: 0,
  errorMessage: null,
  setStatus: (s) => set({ status: s }),
  setProgress: (p) => set({ progress: Math.max(0, Math.min(1, p)) }),
  setError: (msg) =>
    set((state) =>
      msg !== null
        ? { errorMessage: msg, status: 'error' }
        : { errorMessage: null, status: state.status },
    ),
}));
```

- [ ] **Step 4: Run test → PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): LlmStatusStore Zustand state machine (Task 5)"
```

---

## Phase 3: ModelDownloader

### Task 6: ModelDownloader skeleton

**Files:**
- Create: `src/services/translation/ModelDownloader.ts`
- Test: `src/services/translation/__tests__/ModelDownloader.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/services/translation/__tests__/ModelDownloader.test.ts
import { ModelDownloader } from '../ModelDownloader';

const mockResumable = {
  downloadAsync: jest.fn(),
  pauseAsync: jest.fn(),
  resumeAsync: jest.fn(),
};

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/test/Documents/',
  createDownloadResumable: jest.fn(() => mockResumable),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: jest.fn(),
}));

describe('ModelDownloader', () => {
  beforeEach(() => jest.clearAllMocks());

  it('start() returns ok on successful download + verify', async () => {
    mockResumable.downloadAsync.mockResolvedValue({ uri: '/test/Documents/llm/model.gguf.partial' });
    const verify = jest.fn().mockResolvedValue(true);
    const onProgress = jest.fn();

    const downloader = new ModelDownloader({ verifySha256: verify });
    const res = await downloader.start({ onProgress });
    expect(res.ok).toBe(true);
  });

  it('start() returns ok=false on SHA mismatch + cleans up', async () => {
    mockResumable.downloadAsync.mockResolvedValue({ uri: '/test/Documents/llm/model.gguf.partial' });
    const verify = jest.fn().mockResolvedValue(false);
    const downloader = new ModelDownloader({ verifySha256: verify });
    const res = await downloader.start({ onProgress: () => {} });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('CHECKSUM_MISMATCH');
  });

  it('start() returns ok=false on download network error', async () => {
    mockResumable.downloadAsync.mockRejectedValue(new Error('net'));
    const downloader = new ModelDownloader({ verifySha256: jest.fn() });
    const res = await downloader.start({ onProgress: () => {} });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('NETWORK_ERROR');
  });
});
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/ModelDownloader.ts
import * as FileSystem from 'expo-file-system/legacy';
import { MODEL_MANIFEST, getModelLocalDir, getModelLocalPath, getModelPartialPath } from './modelManifest';
import { verifyModelSha256 as defaultVerify } from './verifyModel';

export type DownloadErrorCode =
  | 'NETWORK_ERROR'
  | 'CHECKSUM_MISMATCH'
  | 'DISK_FULL'
  | 'CANCELLED';

export interface DownloadResult {
  ok: boolean;
  code?: DownloadErrorCode;
  errorMessage?: string;
}

export interface DownloadOptions {
  onProgress: (fraction: number) => void;
}

export interface ModelDownloaderDeps {
  verifySha256?: typeof defaultVerify;
}

export class ModelDownloader {
  private resumable: ReturnType<typeof FileSystem.createDownloadResumable> | null = null;
  private cancelled = false;
  private verifySha256: typeof defaultVerify;

  constructor(deps: ModelDownloaderDeps = {}) {
    this.verifySha256 = deps.verifySha256 ?? defaultVerify;
  }

  async start({ onProgress }: DownloadOptions): Promise<DownloadResult> {
    this.cancelled = false;
    try {
      await FileSystem.makeDirectoryAsync(getModelLocalDir(), { intermediates: true });

      this.resumable = FileSystem.createDownloadResumable(
        MODEL_MANIFEST.url,
        getModelPartialPath(),
        {},
        (event) => {
          if (event.totalBytesExpectedToWrite > 0) {
            onProgress(event.totalBytesWritten / event.totalBytesExpectedToWrite);
          }
        },
      );

      const result = await this.resumable.downloadAsync();
      if (this.cancelled) return { ok: false, code: 'CANCELLED' };
      if (!result) return { ok: false, code: 'NETWORK_ERROR', errorMessage: 'no result' };

      const verified = await this.verifySha256(getModelPartialPath(), MODEL_MANIFEST.sha256);
      if (!verified) {
        await FileSystem.deleteAsync(getModelPartialPath(), { idempotent: true });
        return { ok: false, code: 'CHECKSUM_MISMATCH' };
      }

      await FileSystem.moveAsync({
        from: getModelPartialPath(),
        to: getModelLocalPath(),
      });
      return { ok: true };
    } catch (e) {
      await FileSystem.deleteAsync(getModelPartialPath(), { idempotent: true }).catch(() => {});
      return { ok: false, code: 'NETWORK_ERROR', errorMessage: (e as Error).message };
    }
  }

  async pause(): Promise<void> {
    if (this.resumable) await this.resumable.pauseAsync();
  }

  async resume(): Promise<void> {
    if (this.resumable) await this.resumable.resumeAsync();
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    if (this.resumable) await this.resumable.pauseAsync().catch(() => {});
    await FileSystem.deleteAsync(getModelPartialPath(), { idempotent: true }).catch(() => {});
  }
}
```

- [ ] **Step 4: Run test → PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): ModelDownloader with pause/resume/cancel (Task 6)"
```

---

### Task 7: ModelStore — check installed state

**Files:**
- Create: `src/services/translation/ModelStore.ts`
- Test: `src/services/translation/__tests__/ModelStore.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { ModelStore } from '../ModelStore';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/test/Documents/',
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';

describe('ModelStore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('isInstalled() returns true when file exists + SecureStore mark present', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 700_000_000 });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-sha');
    expect(await new ModelStore().isInstalled()).toBe(true);
  });

  it('isInstalled() returns false when file missing', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-sha');
    expect(await new ModelStore().isInstalled()).toBe(false);
  });

  it('isInstalled() returns false when SecureStore mark missing', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    expect(await new ModelStore().isInstalled()).toBe(false);
  });

  it('markInstalled() writes SecureStore', async () => {
    await new ModelStore().markInstalled('sha-hash');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('llm:model-installed-v1', 'sha-hash');
  });

  it('wipe() deletes file and clears mark', async () => {
    await new ModelStore().wipe();
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('llm:model-installed-v1');
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/ModelStore.ts
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { getModelLocalPath } from './modelManifest';

const SECURE_STORE_KEY = 'llm:model-installed-v1';

export class ModelStore {
  async isInstalled(): Promise<boolean> {
    const [info, mark] = await Promise.all([
      FileSystem.getInfoAsync(getModelLocalPath()),
      SecureStore.getItemAsync(SECURE_STORE_KEY),
    ]);
    return info.exists && mark !== null;
  }

  async markInstalled(sha256: string): Promise<void> {
    await SecureStore.setItemAsync(SECURE_STORE_KEY, sha256);
  }

  async wipe(): Promise<void> {
    await Promise.all([
      FileSystem.deleteAsync(getModelLocalPath(), { idempotent: true }),
      SecureStore.deleteItemAsync(SECURE_STORE_KEY),
    ]);
  }
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): ModelStore isInstalled/markInstalled/wipe (Task 7)"
```

---

### Task 8: useModelLifecycle hook + integration with LlmStatusStore

**Files:**
- Create: `src/services/translation/useModelLifecycle.ts`
- Test: `src/services/translation/__tests__/useModelLifecycle.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useModelLifecycle } from '../useModelLifecycle';
import { useLlmStatusStore } from '@/stores/llmStatusStore';

jest.mock('../ModelStore');
jest.mock('../ModelDownloader');
import { ModelStore } from '../ModelStore';
import { ModelDownloader } from '../ModelDownloader';

describe('useModelLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLlmStatusStore.setState({ status: 'not_installed', progress: 0, errorMessage: null });
  });

  it('checkInstalled sets status=installed if model present', async () => {
    (ModelStore as jest.Mock).mockImplementation(() => ({
      isInstalled: jest.fn().mockResolvedValue(true),
    }));
    const { result } = renderHook(() => useModelLifecycle());
    await act(async () => { await result.current.refreshStatus(); });
    expect(useLlmStatusStore.getState().status).toBe('installed');
  });

  it('checkInstalled keeps status=not_installed if model absent', async () => {
    (ModelStore as jest.Mock).mockImplementation(() => ({
      isInstalled: jest.fn().mockResolvedValue(false),
    }));
    const { result } = renderHook(() => useModelLifecycle());
    await act(async () => { await result.current.refreshStatus(); });
    expect(useLlmStatusStore.getState().status).toBe('not_installed');
  });

  it('startDownload transitions through downloading → installed', async () => {
    const downloadStart = jest.fn(({ onProgress }) => {
      onProgress(0.5);
      return Promise.resolve({ ok: true });
    });
    (ModelDownloader as jest.Mock).mockImplementation(() => ({ start: downloadStart }));
    const markInstalled = jest.fn();
    (ModelStore as jest.Mock).mockImplementation(() => ({ markInstalled }));

    const { result } = renderHook(() => useModelLifecycle());
    await act(async () => { await result.current.startDownload(); });
    expect(useLlmStatusStore.getState().status).toBe('installed');
    expect(markInstalled).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/useModelLifecycle.ts
import { useCallback, useRef } from 'react';
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import { ModelStore } from './ModelStore';
import { ModelDownloader } from './ModelDownloader';
import { MODEL_MANIFEST } from './modelManifest';

export interface UseModelLifecycleResult {
  refreshStatus: () => Promise<void>;
  startDownload: () => Promise<void>;
  pauseDownload: () => Promise<void>;
  resumeDownload: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  wipeAndRedownload: () => Promise<void>;
}

export function useModelLifecycle(): UseModelLifecycleResult {
  const downloaderRef = useRef<ModelDownloader | null>(null);
  const setStatus = useLlmStatusStore((s) => s.setStatus);
  const setProgress = useLlmStatusStore((s) => s.setProgress);
  const setError = useLlmStatusStore((s) => s.setError);

  const refreshStatus = useCallback(async () => {
    const store = new ModelStore();
    const installed = await store.isInstalled();
    setStatus(installed ? 'installed' : 'not_installed');
  }, [setStatus]);

  const startDownload = useCallback(async () => {
    const store = new ModelStore();
    const downloader = new ModelDownloader();
    downloaderRef.current = downloader;
    setStatus('downloading');
    setProgress(0);
    setError(null);

    const res = await downloader.start({
      onProgress: (p) => setProgress(p),
    });

    if (res.ok) {
      await store.markInstalled(MODEL_MANIFEST.sha256);
      setStatus('installed');
    } else {
      setError(`Download failed: ${res.code ?? 'unknown'} ${res.errorMessage ?? ''}`);
    }
  }, [setStatus, setProgress, setError]);

  const pauseDownload = useCallback(async () => {
    await downloaderRef.current?.pause();
    setStatus('paused');
  }, [setStatus]);

  const resumeDownload = useCallback(async () => {
    setStatus('downloading');
    await downloaderRef.current?.resume();
  }, [setStatus]);

  const cancelDownload = useCallback(async () => {
    await downloaderRef.current?.cancel();
    setStatus('not_installed');
    setProgress(0);
  }, [setStatus, setProgress]);

  const wipeAndRedownload = useCallback(async () => {
    await new ModelStore().wipe();
    setStatus('not_installed');
    await startDownload();
  }, [setStatus, startDownload]);

  return { refreshStatus, startDownload, pauseDownload, resumeDownload, cancelDownload, wipeAndRedownload };
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): useModelLifecycle hook (Task 8)"
```

---

## Phase 4: PromptBuilder

### Task 9: Language labels constant

**Files:**
- Create: `src/services/translation/promptLabels.ts`
- Test: `src/services/translation/__tests__/promptLabels.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { LANG_LABELS, langLabel } from '../promptLabels';

describe('promptLabels', () => {
  it('has entries for all 13 MVP languages', () => {
    const codes = ['en', 'ru', 'pl', 'uk', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'ar', 'hi'];
    for (const c of codes) expect(LANG_LABELS).toHaveProperty(c);
  });

  it('langLabel returns label', () => {
    expect(langLabel('en')).toBe('English');
    expect(langLabel('ru')).toBe('Russian');
  });

  it('langLabel throws on unsupported', () => {
    // @ts-expect-error testing runtime
    expect(() => langLabel('zz')).toThrow();
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/promptLabels.ts
import type { BookLanguage } from '@/types/settings';

export const LANG_LABELS: Record<BookLanguage, string> = {
  en: 'English',
  ru: 'Russian',
  pl: 'Polish',
  uk: 'Ukrainian',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
};

export function langLabel(code: BookLanguage): string {
  const label = LANG_LABELS[code];
  if (!label) throw new Error(`Unsupported language: ${code}`);
  return label;
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): LANG_LABELS for 13 MVP languages (Task 9)"
```

---

### Task 10: PromptBuilder

**Files:**
- Create: `src/services/translation/PromptBuilder.ts`
- Test: `src/services/translation/__tests__/PromptBuilder.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { buildPrompt, isCJKPair } from '../PromptBuilder';

describe('PromptBuilder', () => {
  it('builds basic en→ru prompt', () => {
    const p = buildPrompt({
      word: 'cat', sentence: 'The cat sat.',
      bookLanguage: 'en', nativeLanguage: 'ru',
    });
    expect(p).toContain('English');
    expect(p).toContain('Russian');
    expect(p).toContain('The cat sat.');
    expect(p).toContain('cat');
  });

  it('uses curly quotes for European source', () => {
    const p = buildPrompt({
      word: 'gato', sentence: 'El gato.', bookLanguage: 'es', nativeLanguage: 'en',
    });
    expect(p).toContain('«El gato.»');
  });

  it('uses Japanese quotes for CJK', () => {
    const p = buildPrompt({
      word: '猫', sentence: '猫がいる。', bookLanguage: 'ja', nativeLanguage: 'en',
    });
    expect(p).toContain('「猫がいる。」');
    expect(p).not.toContain('«');
  });

  it('isCJKPair returns true for ja/ko/zh sources or targets', () => {
    expect(isCJKPair('ja', 'en')).toBe(true);
    expect(isCJKPair('en', 'ko')).toBe(true);
    expect(isCJKPair('en', 'ru')).toBe(false);
  });

  it('truncates sentence at 200 chars', () => {
    const long = 'a'.repeat(500);
    const p = buildPrompt({
      word: 'x', sentence: long,
      bookLanguage: 'en', nativeLanguage: 'ru',
    });
    expect(p.length).toBeLessThan(900); // header + 200 sentence + word + footer
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/PromptBuilder.ts
import type { BookLanguage, NativeLanguage } from '@/types/settings';
import { langLabel } from './promptLabels';

const CJK_LANGS: ReadonlyArray<string> = ['ja', 'ko'];
const MAX_SENTENCE = 200;

export function isCJKPair(src: BookLanguage, dst: NativeLanguage): boolean {
  return CJK_LANGS.includes(src) || CJK_LANGS.includes(dst);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export interface BuildPromptInput {
  word: string;
  sentence: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export function buildPrompt(input: BuildPromptInput): string {
  const src = langLabel(input.bookLanguage);
  const dst = langLabel(input.nativeLanguage);
  const word = input.word.trim();
  const sentence = truncate(input.sentence.trim(), MAX_SENTENCE);
  const cjk = isCJKPair(input.bookLanguage, input.nativeLanguage);
  const openQ = cjk ? '「' : '«';
  const closeQ = cjk ? '」' : '»';

  return [
    `You are a precise translator. Given a word in ${src} and the sentence it appears in,`,
    `return the ${dst} translation of the word ONLY, in its contextual meaning.`,
    `No explanation, no transliteration, no synonyms list.`,
    ``,
    `Sentence: ${openQ}${sentence}${closeQ}`,
    `Word: ${word}`,
    ``,
    `${dst} translation of ${openQ}${word}${closeQ}:`,
  ].join('\n');
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): PromptBuilder with CJK quote handling (Task 10)"
```

---

## Phase 5: Cache layer

### Task 11: InMemoryLRU

**Files:**
- Create: `src/services/translation/InMemoryLRU.ts`
- Test: `src/services/translation/__tests__/InMemoryLRU.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { InMemoryLRU } from '../InMemoryLRU';

describe('InMemoryLRU', () => {
  it('stores and retrieves', () => {
    const lru = new InMemoryLRU<string>(3);
    lru.set('a', '1');
    expect(lru.get('a')).toBe('1');
  });

  it('returns undefined for missing', () => {
    const lru = new InMemoryLRU<string>(3);
    expect(lru.get('missing')).toBeUndefined();
  });

  it('evicts LRU entry when full', () => {
    const lru = new InMemoryLRU<string>(2);
    lru.set('a', '1');
    lru.set('b', '2');
    lru.set('c', '3');
    expect(lru.get('a')).toBeUndefined();
    expect(lru.get('b')).toBe('2');
    expect(lru.get('c')).toBe('3');
  });

  it('promotes accessed entry to most-recent', () => {
    const lru = new InMemoryLRU<string>(2);
    lru.set('a', '1');
    lru.set('b', '2');
    lru.get('a'); // promote a
    lru.set('c', '3'); // should evict b, not a
    expect(lru.get('a')).toBe('1');
    expect(lru.get('b')).toBeUndefined();
    expect(lru.get('c')).toBe('3');
  });

  it('size() returns current count', () => {
    const lru = new InMemoryLRU<string>(3);
    lru.set('a', '1');
    lru.set('b', '2');
    expect(lru.size()).toBe(2);
  });

  it('clear() wipes', () => {
    const lru = new InMemoryLRU<string>(3);
    lru.set('a', '1');
    lru.clear();
    expect(lru.size()).toBe(0);
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/InMemoryLRU.ts
export class InMemoryLRU<V> {
  private map = new Map<string, V>();

  constructor(private capacity: number) {
    if (capacity <= 0) throw new Error('LRU capacity must be > 0');
  }

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    // promote: delete and re-insert
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): InMemoryLRU with promote-on-access (Task 11)"
```

---

### Task 12: TranslationCacheRepository

**Files:**
- Create: `src/db/repositories/TranslationCacheRepository.ts`
- Test: `__tests__/db/translationCacheRepository.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { Database } from '@nozbe/watermelondb';
import { setupTestDb } from './testHelpers'; // (from #2, reuse)
import { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';

describe('TranslationCacheRepository', () => {
  let db: Database;
  let repo: TranslationCacheRepository;

  beforeEach(async () => {
    db = await setupTestDb();
    repo = new TranslationCacheRepository(db);
  });

  it('create stores translation', async () => {
    const r = await repo.create({
      cacheKey: 'abc123',
      word: 'cat',
      contextSentence: 'The cat.',
      langPair: 'en-ru',
      translation: 'кошка',
    });
    expect(r.translation).toBe('кошка');
  });

  it('findByKey returns stored translation', async () => {
    await repo.create({ cacheKey: 'k1', word: 'x', contextSentence: 'y', langPair: 'en-ru', translation: 't' });
    const found = await repo.findByKey('k1');
    expect(found?.translation).toBe('t');
  });

  it('findByKey returns null for missing', async () => {
    expect(await repo.findByKey('missing')).toBeNull();
  });

  it('count returns total', async () => {
    await repo.create({ cacheKey: 'k1', word: 'a', contextSentence: 'b', langPair: 'en-ru', translation: 'c' });
    await repo.create({ cacheKey: 'k2', word: 'a', contextSentence: 'b', langPair: 'en-ru', translation: 'c' });
    expect(await repo.count()).toBe(2);
  });

  it('deleteAll wipes table', async () => {
    await repo.create({ cacheKey: 'k1', word: 'a', contextSentence: 'b', langPair: 'en-ru', translation: 'c' });
    await repo.deleteAll();
    expect(await repo.count()).toBe(0);
  });

  it('purgeOlderThan deletes old', async () => {
    const oldRecord = await repo.create({
      cacheKey: 'old', word: 'a', contextSentence: 'b', langPair: 'en-ru', translation: 'c',
    });
    // force createdAt в прошлое — manual update
    await repo.setCreatedAt(oldRecord.id, Date.now() - 100 * 24 * 3600 * 1000);
    const newRecord = await repo.create({
      cacheKey: 'new', word: 'a', contextSentence: 'b', langPair: 'en-ru', translation: 'c',
    });
    const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
    const removed = await repo.purgeOlderThan(cutoff);
    expect(removed).toBe(1);
    expect(await repo.findByKey('old')).toBeNull();
    expect(await repo.findByKey('new')).not.toBeNull();
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/db/repositories/TranslationCacheRepository.ts
import { Database, Q } from '@nozbe/watermelondb';
import { TranslationCacheModel } from '@/db/models';

export interface TranslationCacheRecord {
  id: string;
  cacheKey: string;
  word: string;
  contextSentence: string;
  langPair: string;
  translation: string;
  createdAt: number;
}

export interface CreateTranslationInput {
  cacheKey: string;
  word: string;
  contextSentence: string;
  langPair: string;
  translation: string;
}

function toRecord(m: TranslationCacheModel): TranslationCacheRecord {
  return {
    id: m.id,
    cacheKey: m.cacheKey,
    word: m.word,
    contextSentence: m.contextSentence,
    langPair: m.langPair,
    translation: m.translation,
    createdAt: m.createdAt,
  };
}

export class TranslationCacheRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.collections.get<TranslationCacheModel>('translation_cache');
  }

  async create(input: CreateTranslationInput): Promise<TranslationCacheRecord> {
    return this.db.write(async () => {
      const m = await this.collection.create((m) => {
        m.cacheKey = input.cacheKey;
        m.word = input.word;
        m.contextSentence = input.contextSentence;
        m.langPair = input.langPair;
        m.translation = input.translation;
        m.createdAt = Date.now();
      });
      return toRecord(m);
    });
  }

  async findByKey(cacheKey: string): Promise<TranslationCacheRecord | null> {
    const matches = await this.collection.query(Q.where('cache_key', cacheKey)).fetch();
    const first = matches[0];
    return first ? toRecord(first) : null;
  }

  async count(): Promise<number> {
    return this.collection.query().fetchCount();
  }

  async deleteAll(): Promise<void> {
    await this.db.write(async () => {
      const all = await this.collection.query().fetch();
      await Promise.all(all.map((m) => m.destroyPermanently()));
    });
  }

  async purgeOlderThan(timestampMs: number): Promise<number> {
    const old = await this.collection.query(Q.where('created_at', Q.lt(timestampMs))).fetch();
    if (old.length === 0) return 0;
    await this.db.write(async () => {
      await Promise.all(old.map((m) => m.destroyPermanently()));
    });
    return old.length;
  }

  /** Test-only helper. */
  async setCreatedAt(id: string, timestamp: number): Promise<void> {
    await this.db.write(async () => {
      const m = await this.collection.find(id);
      await m.update((rec) => {
        rec.createdAt = timestamp;
      });
    });
  }
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): TranslationCacheRepository CRUD + purge (Task 12)"
```

---

### Task 13: CacheLayer (LRU memory + DB persist)

**Files:**
- Create: `src/services/translation/CacheLayer.ts`
- Test: `src/services/translation/__tests__/CacheLayer.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { CacheLayer } from '../CacheLayer';
import type { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';

function makeMockRepo(): jest.Mocked<TranslationCacheRepository> {
  return {
    findByKey: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    deleteAll: jest.fn(),
    purgeOlderThan: jest.fn(),
  } as unknown as jest.Mocked<TranslationCacheRepository>;
}

describe('CacheLayer', () => {
  it('cacheKey is deterministic and 32 chars', async () => {
    const cache = new CacheLayer(makeMockRepo(), 10);
    const k1 = await cache.cacheKey('Cat', 'The Cat.', 'en-ru');
    const k2 = await cache.cacheKey('cat', 'The Cat.', 'en-ru');
    expect(k1).toBe(k2); // case-insensitive word
    expect(k1).toHaveLength(32);
  });

  it('lookup returns memory hit without DB call', async () => {
    const repo = makeMockRepo();
    const cache = new CacheLayer(repo, 10);
    await cache.write('cat', 'ctx', 'en-ru', 'кошка');
    const res = await cache.lookup('cat', 'ctx', 'en-ru');
    expect(res?.value).toBe('кошка');
    expect(res?.source).toBe('memory');
    expect(repo.findByKey).not.toHaveBeenCalled();
  });

  it('lookup falls through to DB and populates memory', async () => {
    const repo = makeMockRepo();
    repo.findByKey.mockResolvedValue({
      id: '1', cacheKey: 'x', word: 'cat', contextSentence: 'ctx',
      langPair: 'en-ru', translation: 'кошка', createdAt: 0,
    });
    const cache = new CacheLayer(repo, 10);
    const res = await cache.lookup('cat', 'ctx', 'en-ru');
    expect(res?.source).toBe('db');
    // Second lookup should be memory hit:
    repo.findByKey.mockClear();
    const res2 = await cache.lookup('cat', 'ctx', 'en-ru');
    expect(res2?.source).toBe('memory');
    expect(repo.findByKey).not.toHaveBeenCalled();
  });

  it('lookup returns null on miss', async () => {
    const repo = makeMockRepo();
    repo.findByKey.mockResolvedValue(null);
    const cache = new CacheLayer(repo, 10);
    expect(await cache.lookup('x', 'y', 'en-ru')).toBeNull();
  });

  it('write fires repo.create (fire-and-forget)', async () => {
    const repo = makeMockRepo();
    repo.create.mockResolvedValue({} as any);
    const cache = new CacheLayer(repo, 10);
    await cache.write('cat', 'ctx', 'en-ru', 'кошка');
    // Wait для microtask
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/CacheLayer.ts
import * as Crypto from 'expo-crypto';
import { InMemoryLRU } from './InMemoryLRU';
import type { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';

export type CacheSource = 'memory' | 'db';

export interface CacheLookupResult {
  value: string;
  source: CacheSource;
}

export class CacheLayer {
  private lru: InMemoryLRU<string>;

  constructor(
    private repo: TranslationCacheRepository,
    capacity: number,
  ) {
    this.lru = new InMemoryLRU<string>(capacity);
  }

  async cacheKey(word: string, contextWindow: string, langPair: string): Promise<string> {
    const input = `${word.toLowerCase().trim()}::${contextWindow.trim()}::${langPair}`;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
    return hash.slice(0, 32);
  }

  async lookup(
    word: string,
    contextWindow: string,
    langPair: string,
  ): Promise<CacheLookupResult | null> {
    const key = await this.cacheKey(word, contextWindow, langPair);
    const mem = this.lru.get(key);
    if (mem !== undefined) return { value: mem, source: 'memory' };

    const fromDb = await this.repo.findByKey(key);
    if (fromDb) {
      this.lru.set(key, fromDb.translation);
      return { value: fromDb.translation, source: 'db' };
    }
    return null;
  }

  async write(
    word: string,
    contextWindow: string,
    langPair: string,
    translation: string,
  ): Promise<void> {
    const key = await this.cacheKey(word, contextWindow, langPair);
    this.lru.set(key, translation);
    // Fire-and-forget DB write:
    this.repo
      .create({
        cacheKey: key,
        word,
        contextSentence: contextWindow,
        langPair,
        translation,
      })
      .catch((e) => {
        if (__DEV__) console.warn('[translation] cache DB write failed:', e);
      });
  }

  clearMemory(): void {
    this.lru.clear();
  }
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): CacheLayer LRU memory + DB persist (Task 13)"
```

---

## Phase 6: LlamaContext + LlamaTranslationService

### Task 14: LlamaContext interface + adapter

**Files:**
- Create: `src/services/translation/llamaTypes.ts`
- Create: `src/services/translation/LlamaContextAdapter.ts`
- Test: `src/services/translation/__tests__/LlamaContextAdapter.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { LlamaContextAdapter } from '../LlamaContextAdapter';

const mockNativeCtx = {
  completion: jest.fn(),
  stopCompletion: jest.fn(),
  release: jest.fn(),
};

describe('LlamaContextAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('completion returns text', async () => {
    mockNativeCtx.completion.mockResolvedValue({ text: 'hello world' });
    const adapter = new LlamaContextAdapter(mockNativeCtx as any);
    const res = await adapter.completion('test', { max_tokens: 10 });
    expect(res.text).toBe('hello world');
  });

  it('completion forwards config', async () => {
    mockNativeCtx.completion.mockResolvedValue({ text: 'x' });
    const adapter = new LlamaContextAdapter(mockNativeCtx as any);
    await adapter.completion('p', { temperature: 0.5, max_tokens: 20, stop: ['.'] });
    expect(mockNativeCtx.completion).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'p', temperature: 0.5, n_predict: 20, stop: ['.'] }),
    );
  });

  it('release calls native release', async () => {
    mockNativeCtx.release.mockResolvedValue(undefined);
    const adapter = new LlamaContextAdapter(mockNativeCtx as any);
    await adapter.release();
    expect(mockNativeCtx.release).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/llamaTypes.ts
export interface InferenceConfig {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;
  max_tokens?: number;
  stop?: string[];
  n_threads?: number;
}

export interface InferenceResult {
  text: string;
}

export interface LlamaContext {
  completion(prompt: string, config: InferenceConfig): Promise<InferenceResult>;
  release(): Promise<void>;
}

/** Минимальный shape llama.rn native context. */
export interface LlamaNativeContext {
  completion(params: Record<string, unknown>): Promise<{ text: string }>;
  stopCompletion(): Promise<void>;
  release(): Promise<void>;
}
```

```typescript
// src/services/translation/LlamaContextAdapter.ts
import type { LlamaContext, LlamaNativeContext, InferenceConfig, InferenceResult } from './llamaTypes';

export class LlamaContextAdapter implements LlamaContext {
  constructor(private native: LlamaNativeContext) {}

  async completion(prompt: string, config: InferenceConfig): Promise<InferenceResult> {
    const params: Record<string, unknown> = {
      prompt,
      temperature: config.temperature ?? 0.2,
      top_p: config.top_p ?? 0.9,
      top_k: config.top_k ?? 40,
      repeat_penalty: config.repeat_penalty ?? 1.1,
      n_predict: config.max_tokens ?? 32,
      stop: config.stop ?? ['\n'],
      n_threads: config.n_threads ?? 4,
    };
    const res = await this.native.completion(params);
    return { text: res.text };
  }

  async release(): Promise<void> {
    await this.native.release();
  }
}
```

⚠️ **Note для implementer'а:** Проверь реальные имена полей llama.rn
(`n_predict` vs `max_tokens`, `stop` vs `stop_words`, etc) после Task 1 step 4.
Adapter изолирует разницу — обнови параметры в `completion()` body, тесты
останутся стабильными.

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): LlamaContext interface + adapter for llama.rn (Task 14)"
```

---

### Task 15: LlamaContextManager singleton

**Files:**
- Create: `src/services/translation/LlamaContextManager.ts`
- Test: `src/services/translation/__tests__/LlamaContextManager.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { LlamaContextManager } from '../LlamaContextManager';

describe('LlamaContextManager', () => {
  beforeEach(() => LlamaContextManager.resetForTests());

  it('singleton returns same instance', () => {
    const a = LlamaContextManager.instance();
    const b = LlamaContextManager.instance();
    expect(a).toBe(b);
  });

  it('getContext returns null before load', () => {
    expect(LlamaContextManager.instance().getContext()).toBeNull();
  });

  it('load sets context and returns it', async () => {
    const mockCtx = { completion: jest.fn(), release: jest.fn() };
    const loader = jest.fn().mockResolvedValue(mockCtx);
    const mgr = LlamaContextManager.instance();
    await mgr.load(loader);
    expect(mgr.getContext()).toBe(mockCtx);
  });

  it('unload releases context', async () => {
    const release = jest.fn().mockResolvedValue(undefined);
    const mockCtx = { completion: jest.fn(), release };
    const mgr = LlamaContextManager.instance();
    await mgr.load(jest.fn().mockResolvedValue(mockCtx));
    await mgr.unload();
    expect(release).toHaveBeenCalled();
    expect(mgr.getContext()).toBeNull();
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/LlamaContextManager.ts
import type { LlamaContext } from './llamaTypes';

export type ContextLoader = () => Promise<LlamaContext>;

export class LlamaContextManager {
  private static singleton: LlamaContextManager | null = null;
  private context: LlamaContext | null = null;
  private loading: Promise<LlamaContext> | null = null;

  private constructor() {}

  static instance(): LlamaContextManager {
    if (!this.singleton) this.singleton = new LlamaContextManager();
    return this.singleton;
  }

  /** Test-only. */
  static resetForTests(): void {
    this.singleton = null;
  }

  async load(loader: ContextLoader): Promise<LlamaContext> {
    if (this.context) return this.context;
    if (this.loading) return this.loading;
    this.loading = loader().then((ctx) => {
      this.context = ctx;
      this.loading = null;
      return ctx;
    });
    return this.loading;
  }

  getContext(): LlamaContext | null {
    return this.context;
  }

  async unload(): Promise<void> {
    const ctx = this.context;
    this.context = null;
    this.loading = null;
    if (ctx) await ctx.release();
  }
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): LlamaContextManager singleton (Task 15)"
```

---

### Task 16: InferenceQueue (serial inference)

**Files:**
- Create: `src/services/translation/InferenceQueue.ts`
- Test: `src/services/translation/__tests__/InferenceQueue.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { InferenceQueue } from '../InferenceQueue';

describe('InferenceQueue', () => {
  it('runs single task and returns result', async () => {
    const q = new InferenceQueue();
    const res = await q.run(async () => 42);
    expect(res).toBe(42);
  });

  it('serializes concurrent calls', async () => {
    const q = new InferenceQueue();
    const order: number[] = [];
    const t1 = q.run(async () => { order.push(1); await new Promise(r => setTimeout(r, 50)); order.push(2); return 1; });
    const t2 = q.run(async () => { order.push(3); return 2; });
    await Promise.all([t1, t2]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('continues even if earlier task rejects', async () => {
    const q = new InferenceQueue();
    const p1 = q.run(async () => { throw new Error('boom'); });
    const p2 = q.run(async () => 99);
    await expect(p1).rejects.toThrow('boom');
    await expect(p2).resolves.toBe(99);
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/InferenceQueue.ts
export class InferenceQueue {
  private queue: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => {});
    return next;
  }
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): InferenceQueue for serial llama.cpp calls (Task 16)"
```

---

### Task 17: cleanTranslation post-processing

**Files:**
- Create: `src/services/translation/cleanTranslation.ts`
- Test: `src/services/translation/__tests__/cleanTranslation.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { cleanTranslation } from '../cleanTranslation';

describe('cleanTranslation', () => {
  it('strips leading/trailing whitespace and punctuation', () => {
    expect(cleanTranslation('  «кошка»  ')).toBe('кошка');
  });

  it('takes first line on multi-line', () => {
    expect(cleanTranslation('кошка\nalso cat')).toBe('кошка');
  });

  it('collapses internal whitespace', () => {
    expect(cleanTranslation('кош  ка')).toBe('кош ка');
  });

  it('caps length at 200', () => {
    expect(cleanTranslation('a'.repeat(300))).toHaveLength(200);
  });

  it('returns empty on whitespace-only input', () => {
    expect(cleanTranslation('   ')).toBe('');
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/cleanTranslation.ts
const LEADING_TRAILING = /^["'«»“”:,.\s【】「」]+|["'«»“”:,.\s【】「」]+$/g;

export function cleanTranslation(raw: string): string {
  const firstLine = raw.split('\n')[0] ?? '';
  const stripped = firstLine.replace(LEADING_TRAILING, '').replace(/\s+/g, ' ').trim();
  return stripped.slice(0, 200);
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): cleanTranslation post-processing (Task 17)"
```

---

### Task 18: LlamaTranslationService

**Files:**
- Create: `src/services/translation/LlamaTranslationService.ts`
- Test: `src/services/translation/__tests__/LlamaTranslationService.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { LlamaTranslationService } from '../LlamaTranslationService';
import { CacheLayer } from '../CacheLayer';
import { InferenceQueue } from '../InferenceQueue';
import { useLlmStatusStore } from '@/stores/llmStatusStore';

function makeCtx(text: string) {
  return {
    completion: jest.fn().mockResolvedValue({ text }),
    release: jest.fn(),
  };
}

const mockRepo: any = { findByKey: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) };

describe('LlamaTranslationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLlmStatusStore.setState({ status: 'ready', progress: 0, errorMessage: null });
  });

  it('returns MODEL_NOT_INSTALLED when status != ready', async () => {
    useLlmStatusStore.setState({ status: 'not_installed' } as any);
    const svc = new LlamaTranslationService({
      contextProvider: () => makeCtx('кошка') as any,
      cache: new CacheLayer(mockRepo, 10),
      queue: new InferenceQueue(),
    });
    const res = await svc.translate({ word: 'cat', contextWindow: 'the cat', bookLanguage: 'en', nativeLanguage: 'ru' });
    expect(res.status).toBe('error');
    expect(res.errorCode).toBe('MODEL_NOT_INSTALLED');
  });

  it('returns ok with inference on cache miss', async () => {
    const ctx = makeCtx('кошка');
    const svc = new LlamaTranslationService({
      contextProvider: () => ctx as any,
      cache: new CacheLayer(mockRepo, 10),
      queue: new InferenceQueue(),
    });
    const res = await svc.translate({ word: 'cat', contextWindow: 'the cat sat', bookLanguage: 'en', nativeLanguage: 'ru' });
    expect(res.status).toBe('ok');
    expect(res.translation).toBe('кошка');
    expect(res.source).toBe('inference');
    expect(ctx.completion).toHaveBeenCalled();
  });

  it('returns cache hit without inference', async () => {
    const ctx = makeCtx('кошка');
    const cache = new CacheLayer(mockRepo, 10);
    await cache.write('cat', 'the cat sat', 'en-ru', 'кошка');
    const svc = new LlamaTranslationService({
      contextProvider: () => ctx as any,
      cache,
      queue: new InferenceQueue(),
    });
    const res = await svc.translate({ word: 'cat', contextWindow: 'the cat sat', bookLanguage: 'en', nativeLanguage: 'ru' });
    expect(res.status).toBe('ok');
    expect(res.source).toBe('memory');
    expect(ctx.completion).not.toHaveBeenCalled();
  });

  it('returns EMPTY_RESPONSE on whitespace output', async () => {
    const ctx = makeCtx('   ');
    const svc = new LlamaTranslationService({
      contextProvider: () => ctx as any,
      cache: new CacheLayer(mockRepo, 10),
      queue: new InferenceQueue(),
    });
    const res = await svc.translate({ word: 'x', contextWindow: 'y', bookLanguage: 'en', nativeLanguage: 'ru' });
    expect(res.errorCode).toBe('EMPTY_RESPONSE');
  });

  it('returns INFERENCE_TIMEOUT when completion exceeds timeout', async () => {
    const ctx = {
      completion: jest.fn(() => new Promise((r) => setTimeout(() => r({ text: 'late' }), 200))),
      release: jest.fn(),
    };
    const svc = new LlamaTranslationService({
      contextProvider: () => ctx as any,
      cache: new CacheLayer(mockRepo, 10),
      queue: new InferenceQueue(),
      timeoutMs: 50,
    });
    const res = await svc.translate({ word: 'x', contextWindow: 'y', bookLanguage: 'en', nativeLanguage: 'ru' });
    expect(res.errorCode).toBe('INFERENCE_TIMEOUT');
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/LlamaTranslationService.ts
import type { TranslationService, TranslateInput, TranslateResult, TranslationErrorCode } from './TranslationService';
import type { LlamaContext } from './llamaTypes';
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import { CacheLayer } from './CacheLayer';
import { InferenceQueue } from './InferenceQueue';
import { buildPrompt } from './PromptBuilder';
import { cleanTranslation } from './cleanTranslation';

const DEFAULT_TIMEOUT_MS = 5000;
const INFERENCE_CONFIG = {
  temperature: 0.2,
  top_p: 0.9,
  top_k: 40,
  repeat_penalty: 1.1,
  max_tokens: 32,
  stop: ['\n', '.', ',', '«', '»', '"', ':', ';', '」'],
  n_threads: 4,
};

export interface LlamaTranslationServiceDeps {
  contextProvider: () => LlamaContext | null;
  cache: CacheLayer;
  queue: InferenceQueue;
  timeoutMs?: number;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('__timeout__')), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function langPair(src: string, dst: string): string {
  return `${src}-${dst}`;
}

export class LlamaTranslationService implements TranslationService {
  private deps: LlamaTranslationServiceDeps;
  private timeoutMs: number;

  constructor(deps: LlamaTranslationServiceDeps) {
    this.deps = deps;
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async translate(input: TranslateInput): Promise<TranslateResult> {
    const status = useLlmStatusStore.getState().status;
    if (status !== 'ready') {
      const code: TranslationErrorCode =
        status === 'loading' || status === 'warming_up' ? 'MODEL_LOADING' : 'MODEL_NOT_INSTALLED';
      return { status: 'error', errorCode: code, errorMessage: `LLM not ready (${status})` };
    }

    const pair = langPair(input.bookLanguage, input.nativeLanguage);
    const cached = await this.deps.cache.lookup(input.word, input.contextWindow, pair);
    if (cached) {
      return { status: 'ok', translation: cached.value, source: cached.source };
    }

    const ctx = this.deps.contextProvider();
    if (!ctx) {
      return { status: 'error', errorCode: 'MODEL_LOADING', errorMessage: 'context null' };
    }

    const prompt = buildPrompt(input);

    try {
      const raw = await this.deps.queue.run(() =>
        withTimeout(ctx.completion(prompt, INFERENCE_CONFIG), this.timeoutMs),
      );
      const cleaned = cleanTranslation(raw.text);
      if (!cleaned) {
        return { status: 'error', errorCode: 'EMPTY_RESPONSE', errorMessage: 'whitespace output' };
      }
      await this.deps.cache.write(input.word, input.contextWindow, pair, cleaned);
      return { status: 'ok', translation: cleaned, source: 'inference' };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === '__timeout__') {
        return { status: 'error', errorCode: 'INFERENCE_TIMEOUT', errorMessage: 'timed out' };
      }
      return { status: 'error', errorCode: 'INFERENCE_FAILED', errorMessage: msg };
    }
  }
}
```

- [ ] **Step 4: Update TranslationService interface**

```typescript
// src/services/translation/TranslationService.ts (если уже существует — update)
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export interface TranslateInput {
  word: string;
  contextWindow: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export interface TranslateResult {
  status: 'ok' | 'pending' | 'error';
  translation?: string;
  source?: 'memory' | 'db' | 'inference';
  errorMessage?: string;
  errorCode?: TranslationErrorCode;
}

export type TranslationErrorCode =
  | 'MODEL_NOT_INSTALLED'
  | 'MODEL_LOADING'
  | 'INFERENCE_TIMEOUT'
  | 'INFERENCE_FAILED'
  | 'EMPTY_RESPONSE'
  | 'UNSUPPORTED_PAIR';

export interface TranslationService {
  translate(input: TranslateInput): Promise<TranslateResult>;
}
```

- [ ] **Step 5: PASS**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(translation): LlamaTranslationService + TranslationService interface (Task 18)"
```

---

### Task 19: MockTranslationService

**Files:**
- Create: `src/services/translation/MockTranslationService.ts`
- Test: `src/services/translation/__tests__/MockTranslationService.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { MockTranslationService } from '../MockTranslationService';

describe('MockTranslationService', () => {
  it('returns mapped translation', async () => {
    const svc = new MockTranslationService({ map: { cat: 'кошка' } });
    const res = await svc.translate({ word: 'cat', contextWindow: 'x', bookLanguage: 'en', nativeLanguage: 'ru' });
    expect(res.status).toBe('ok');
    expect(res.translation).toBe('кошка');
  });

  it('falls back to fake translation', async () => {
    const svc = new MockTranslationService({ map: {} });
    const res = await svc.translate({ word: 'cat', contextWindow: 'x', bookLanguage: 'en', nativeLanguage: 'ru' });
    expect(res.translation).toBe('cat-translated-ru');
  });

  it('honours delay', async () => {
    const svc = new MockTranslationService({ map: {}, delay: 50 });
    const start = Date.now();
    await svc.translate({ word: 'x', contextWindow: 'y', bookLanguage: 'en', nativeLanguage: 'ru' });
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/MockTranslationService.ts
import type { TranslationService, TranslateInput, TranslateResult } from './TranslationService';

export interface MockOptions {
  map?: Record<string, string>;
  delay?: number;
}

export class MockTranslationService implements TranslationService {
  constructor(private opts: MockOptions = {}) {}

  async translate(input: TranslateInput): Promise<TranslateResult> {
    if (this.opts.delay) await new Promise((r) => setTimeout(r, this.opts.delay));
    const direct = this.opts.map?.[input.word.toLowerCase()];
    const translation = direct ?? `${input.word}-translated-${input.nativeLanguage}`;
    return { status: 'ok', translation, source: 'inference' };
  }
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): MockTranslationService для тестов и dev (Task 19)"
```

---

## Phase 7: Warmup + integration

### Task 20: useLlmRuntime hook (load + warmup orchestration)

**Files:**
- Create: `src/services/translation/useLlmRuntime.ts`
- Test: `src/services/translation/__tests__/useLlmRuntime.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useLlmRuntime } from '../useLlmRuntime';
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import { LlamaContextManager } from '../LlamaContextManager';

describe('useLlmRuntime', () => {
  beforeEach(() => {
    LlamaContextManager.resetForTests();
    useLlmStatusStore.setState({ status: 'installed', progress: 0, errorMessage: null });
  });

  it('load() transitions installed → loading → warming_up → ready', async () => {
    const events: string[] = [];
    useLlmStatusStore.subscribe((s) => events.push(s.status));

    const loader = jest.fn().mockResolvedValue({
      completion: jest.fn().mockResolvedValue({ text: 'hi' }),
      release: jest.fn(),
    });

    const { result } = renderHook(() => useLlmRuntime({ loader }));
    await act(async () => { await result.current.load(); });
    expect(useLlmStatusStore.getState().status).toBe('ready');
    expect(events).toContain('loading');
    expect(events).toContain('warming_up');
    expect(events).toContain('ready');
  });

  it('skip load if status != installed', async () => {
    useLlmStatusStore.setState({ status: 'not_installed' } as any);
    const loader = jest.fn();
    const { result } = renderHook(() => useLlmRuntime({ loader }));
    await act(async () => { await result.current.load(); });
    expect(loader).not.toHaveBeenCalled();
  });

  it('error path sets status=error', async () => {
    const loader = jest.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useLlmRuntime({ loader }));
    await act(async () => { await result.current.load(); });
    expect(useLlmStatusStore.getState().status).toBe('error');
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/useLlmRuntime.ts
import { useCallback } from 'react';
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import { LlamaContextManager } from './LlamaContextManager';
import type { LlamaContext } from './llamaTypes';

export interface UseLlmRuntimeOptions {
  loader: () => Promise<LlamaContext>;
}

export interface UseLlmRuntimeResult {
  load: () => Promise<void>;
  unload: () => Promise<void>;
}

export function useLlmRuntime(opts: UseLlmRuntimeOptions): UseLlmRuntimeResult {
  const setStatus = useLlmStatusStore((s) => s.setStatus);
  const setError = useLlmStatusStore((s) => s.setError);

  const load = useCallback(async () => {
    const cur = useLlmStatusStore.getState().status;
    if (cur !== 'installed') return;
    setStatus('loading');
    try {
      const ctx = await LlamaContextManager.instance().load(opts.loader);
      setStatus('warming_up');
      // Warm-up: short dummy inference.
      await ctx
        .completion('Hello.', { temperature: 0.2, max_tokens: 8, stop: ['\n'] })
        .catch((e) => {
          if (__DEV__) console.warn('[llm] warmup failed', e);
        });
      setStatus('ready');
    } catch (e) {
      setError(`LLM load failed: ${(e as Error).message}`);
    }
  }, [opts.loader, setStatus, setError]);

  const unload = useCallback(async () => {
    await LlamaContextManager.instance().unload();
    setStatus('installed');
  }, [setStatus]);

  return { load, unload };
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): useLlmRuntime load/warmup/unload (Task 20)"
```

---

### Task 21: createLlamaLoader factory (real llama.rn)

**Files:**
- Create: `src/services/translation/createLlamaLoader.ts`
- No unit test (real native call — covered in smoke)

- [ ] **Step 1: Implement**

```typescript
// src/services/translation/createLlamaLoader.ts
import { initLlama, type LlamaContext as NativeLlamaContext } from 'llama.rn';
import { getModelLocalPath } from './modelManifest';
import { LlamaContextAdapter } from './LlamaContextAdapter';
import type { LlamaContext } from './llamaTypes';

/**
 * Production loader: вызывает llama.rn initLlama с локальным GGUF файлом.
 * НЕ unit-тестируем — нет mock'а native module. Покрытие через device smoke.
 */
export async function createLlamaLoader(): Promise<LlamaContext> {
  const native: NativeLlamaContext = await initLlama({
    model: getModelLocalPath(),
    n_ctx: 1024,
    n_gpu_layers: 99, // iOS Metal: offload max. Android ignored.
    n_threads: 4,
    use_mlock: false,
    use_mmap: true,
  });
  return new LlamaContextAdapter(native as any);
}
```

⚠️ **Note для implementer'а:** Проверить точные имена параметров `initLlama`
из `node_modules/llama.rn/lib/typescript/index.d.ts` (см. Task 1 step 4
notes). Параметры в этом snippet — best-guess.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Если llama.rn API отличается — adjust типы.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(translation): createLlamaLoader production factory (Task 21)"
```

---

### Task 22: RootLayout integration — auto-load on app start

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Read current `app/_layout.tsx`** to understand its structure.

- [ ] **Step 2: Add LLM lifecycle hook**

Добавить near top of `RootLayout` после существующих hooks:

```typescript
import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { useLlmRuntime } from '@/services/translation/useLlmRuntime';
import { useModelLifecycle } from '@/services/translation/useModelLifecycle';
import { createLlamaLoader } from '@/services/translation/createLlamaLoader';
import { useLlmStatusStore } from '@/stores/llmStatusStore';

function LlmBootstrap() {
  const { refreshStatus } = useModelLifecycle();
  const { load } = useLlmRuntime({ loader: createLlamaLoader });
  const status = useLlmStatusStore((s) => s.status);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (status === 'installed') {
      InteractionManager.runAfterInteractions(() => {
        load();
      });
    }
  }, [status, load]);

  return null;
}
```

Вставить `<LlmBootstrap />` внутри SafeAreaProvider (или подходящего layout
wrapper, не нарушающий tree).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(translation): RootLayout LlmBootstrap auto-load + warmup (Task 22)"
```

---

## Phase 8: Reader integration

### Task 23: Inject LlamaTranslationService через Context

**Files:**
- Create: `src/services/translation/TranslationServiceContext.tsx`
- Test: `src/services/translation/__tests__/TranslationServiceContext.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { TranslationServiceProvider, useTranslationService } from '../TranslationServiceContext';
import { MockTranslationService } from '../MockTranslationService';

function Consumer() {
  const svc = useTranslationService();
  return <Text>{svc.constructor.name}</Text>;
}

describe('TranslationServiceContext', () => {
  it('provides service to children', () => {
    const svc = new MockTranslationService();
    const { getByText } = render(
      <TranslationServiceProvider service={svc}>
        <Consumer />
      </TranslationServiceProvider>,
    );
    expect(getByText('MockTranslationService')).toBeTruthy();
  });

  it('throws outside provider', () => {
    const ConsumerOutside = () => {
      expect(() => useTranslationService()).toThrow();
      return null;
    };
    render(<ConsumerOutside />);
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/services/translation/TranslationServiceContext.tsx
import React, { createContext, useContext } from 'react';
import type { TranslationService } from './TranslationService';

const Ctx = createContext<TranslationService | null>(null);

export function TranslationServiceProvider({
  service,
  children,
}: {
  service: TranslationService;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={service}>{children}</Ctx.Provider>;
}

export function useTranslationService(): TranslationService {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTranslationService must be used within TranslationServiceProvider');
  return v;
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): TranslationServiceContext (Task 23)"
```

---

### Task 24: Wire up RootLayout TranslationServiceProvider

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add provider**

```typescript
// в _layout.tsx — добавить:
import { useMemo } from 'react';
import { TranslationServiceProvider } from '@/services/translation/TranslationServiceContext';
import { LlamaTranslationService } from '@/services/translation/LlamaTranslationService';
import { CacheLayer } from '@/services/translation/CacheLayer';
import { InferenceQueue } from '@/services/translation/InferenceQueue';
import { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';
import { LlamaContextManager } from '@/services/translation/LlamaContextManager';
import { useDatabase } from '@/db/DatabaseContext';

function TranslationProviderWrapper({ children }: { children: React.ReactNode }) {
  const db = useDatabase();
  const service = useMemo(() => {
    const repo = new TranslationCacheRepository(db);
    const cache = new CacheLayer(repo, 500);
    const queue = new InferenceQueue();
    return new LlamaTranslationService({
      contextProvider: () => LlamaContextManager.instance().getContext(),
      cache,
      queue,
    });
  }, [db]);
  return <TranslationServiceProvider service={service}>{children}</TranslationServiceProvider>;
}
```

Обернуть main app tree в `<TranslationProviderWrapper>`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(translation): wire TranslationServiceProvider in RootLayout (Task 24)"
```

---

### Task 25: Update Reader screen to use real service

**Files:**
- Modify: `app/reader/[bookId].tsx`

- [ ] **Step 1: Replace NoOp with context**

```typescript
// app/reader/[bookId].tsx
// Удалить: const translation = new NoOpTranslationService();
// Добавить:
import { useTranslationService } from '@/services/translation/TranslationServiceContext';
const translation = useTranslationService();
```

Остальной код `onWordTap` остаётся без изменений.

- [ ] **Step 2: Smoke test (manual)**

Run iOS dev-client. Open EPUB → tap word → popup появится в `opening` →
`pending` (model loading) или `success` (cache hit if seeded).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(translation): reader screen uses real TranslationService (Task 25)"
```

---

### Task 26: TranslationPopup — show source badge + states

**Files:**
- Modify: `src/components/reader/TranslationPopup.tsx`

- [ ] **Step 1: Read current TranslationPopup** (из #3).

- [ ] **Step 2: Extend state type + UI**

```typescript
// TranslationPopupState (add `source` to success):
| { kind: 'success'; word: string; translation: string; source?: 'memory' | 'db' | 'inference' };

// В render success state:
{state.source === 'memory' || state.source === 'db' ? (
  <Text style={styles.badge}>cached</Text>
) : null}
```

Update reader screen `onWordTap`:

```typescript
} else if (res.status === 'ok' && res.translation) {
  setPopup({ kind: 'success', word, translation: res.translation, source: res.source });
}
```

- [ ] **Step 3: Visual smoke**

Open same word twice → second time → `cached` badge.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(translation): TranslationPopup shows cached badge (Task 26)"
```

---

### Task 27: TranslationPopup — pending reason

**Files:**
- Modify: `src/components/reader/TranslationPopup.tsx`
- Modify: `app/reader/[bookId].tsx`

- [ ] **Step 1: Extend pending state**

```typescript
| { kind: 'pending'; word: string; sentence: string; reason?: 'loading_model' | 'inferring' };
```

В reader `onWordTap`, при `res.errorCode === 'MODEL_LOADING'`:

```typescript
} else if (res.errorCode === 'MODEL_LOADING') {
  setPopup({ kind: 'pending', word, sentence, reason: 'loading_model' });
}
```

- [ ] **Step 2: Render reason**

```tsx
{state.reason === 'loading_model' ? (
  <Text>Загружается модель перевода…</Text>
) : (
  <ActivityIndicator />
)}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(translation): TranslationPopup pending reason — loading_model (Task 27)"
```

---

## Phase 9: Settings + Onboarding placeholders

### Task 28: Settings — Translation section placeholder

**Files:**
- Modify: `src/components/reader/ReaderControlsSheet.tsx` OR new `src/components/settings/TranslationSection.tsx`

⚠️ **Note:** Полноценный Settings screen — sub-project #8. В #4 добавим
секцию в ReaderControlsSheet (или Settings tab если уже есть).

- [ ] **Step 1: Check существующий Settings UI**

```bash
grep -rn "Settings" app/ src/ --include="*.tsx" | head -10
```

Решить: добавить в существующий Settings screen или в ReaderControlsSheet.

- [ ] **Step 2: Создать TranslationSection component**

```typescript
// src/components/settings/TranslationSection.tsx
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import { useModelLifecycle } from '@/services/translation/useModelLifecycle';
import { useDatabase } from '@/db/DatabaseContext';
import { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';
import { useUnistyles } from 'react-native-unistyles';

export function TranslationSection() {
  const { theme } = useUnistyles();
  const status = useLlmStatusStore((s) => s.status);
  const progress = useLlmStatusStore((s) => s.progress);
  const { startDownload, wipeAndRedownload } = useModelLifecycle();
  const db = useDatabase();

  const clearCache = async () => {
    await new TranslationCacheRepository(db).deleteAll();
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ color: theme.ink, fontSize: 16, fontWeight: '600' }}>
        Translation Model
      </Text>
      <Text style={{ color: theme.ink2 }}>Status: {status}</Text>
      {status === 'downloading' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator />
          <Text style={{ color: theme.ink3 }}>{Math.floor(progress * 100)}%</Text>
        </View>
      )}
      {status === 'not_installed' && (
        <Pressable onPress={startDownload} style={{ padding: 12, backgroundColor: theme.accent }}>
          <Text style={{ color: theme.paper }}>Download model (~700MB)</Text>
        </Pressable>
      )}
      {status === 'ready' && (
        <Pressable onPress={wipeAndRedownload} style={{ padding: 12, backgroundColor: theme.paper2 }}>
          <Text style={{ color: theme.ink }}>Re-download model</Text>
        </Pressable>
      )}
      <Pressable onPress={clearCache} style={{ padding: 12, backgroundColor: theme.paper2 }}>
        <Text style={{ color: theme.ink }}>Clear translation history</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Mount in Settings**

Если есть `app/(tabs)/settings.tsx` или Settings tab — добавить
`<TranslationSection />` туда. Если нет — пока в ReaderControlsSheet как
expandable section.

- [ ] **Step 4: Manual smoke**

Open Settings → see "Translation Model" section → status shows
`not_installed`, button visible.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(translation): Settings section placeholder (Task 28)"
```

---

### Task 29: Onboarding placeholder — model download CTA

**Files:**
- Modify: existing onboarding screen OR create `src/components/onboarding/ModelDownloadScreen.tsx`

⚠️ Полная onboarding — #8. В #4 — минимальный flow.

- [ ] **Step 1: Check onboarding existence**

```bash
ls app/onboarding 2>/dev/null && echo "exists" || echo "missing"
grep -rn "onboardingCompleted" src/stores src/components 2>&1 | head -5
```

- [ ] **Step 2: Если onboarding нет — отложить до #8**

Создать стуб TODO в комментарии в `LlmBootstrap`:
```typescript
// TODO(#8): после онбординга показать ModelDownloadScreen если status='not_installed'.
```

- [ ] **Step 3: Commit (если изменения есть)**

```bash
git add -A
git commit -m "chore(translation): TODO note for #8 onboarding integration (Task 29)"
```

---

## Phase 10: Cache maintenance + lifecycle

### Task 30: TranslationCache purge on app start

**Files:**
- Modify: `app/_layout.tsx` or `src/db/database.ts`

- [ ] **Step 1: Add purge call**

В `LlmBootstrap` (или DatabaseContext init):

```typescript
useEffect(() => {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 3600 * 1000;
  new TranslationCacheRepository(db).purgeOlderThan(ninetyDaysAgo).catch((e) => {
    if (__DEV__) console.warn('[translation] purge failed', e);
  });
}, [db]);
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(translation): purge translation cache >90 days on app start (Task 30)"
```

---

### Task 31: backup-exclusion marker для model file

**Files:**
- Create: `src/services/translation/excludeFromBackup.ts` (best-effort wrapper)
- Modify: `useModelLifecycle.ts` — call after install

- [ ] **Step 1: Реализовать helper**

```typescript
// src/services/translation/excludeFromBackup.ts
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Best-effort backup-exclusion. iOS: NSURLIsExcludedFromBackupKey.
 * Android: native config XML экранирует Android Auto Backup, но
 * этот вызов no-op (просто логирует).
 *
 * expo-file-system SDK 54 не экспортирует setItemValueAsync — exclusion
 * требует custom native module. В v1 best-effort через RN bridge fallback.
 */
export async function excludeFromBackup(path: string): Promise<void> {
  if (Platform.OS !== 'ios') return;
  // TODO: реальный exclusion требует native module. На SDK 54 нет API.
  // Placeholder для будущей интеграции (v2: expo-file-system v2 API или dev plugin).
  if (__DEV__) console.log('[backup] would exclude', path);
}
```

- [ ] **Step 2: Call after install**

В `useModelLifecycle.startDownload()` после `markInstalled`:

```typescript
await excludeFromBackup(getModelLocalPath());
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(translation): excludeFromBackup placeholder + invoke after install (Task 31)"
```

---

## Phase 11: Final verification + PR

### Task 32: Full test suite + typecheck

- [ ] **Step 1: Run all checks**

```bash
npx tsc --noEmit && npx jest && npx expo lint
```

Expected: all clean. Если падает — fix перед PR.

- [ ] **Step 2: Update spec done-criteria**

Mark items в `docs/superpowers/specs/2026-05-17-translation-engine-design.md`
§19 как `[x]` те что выполнены.

- [ ] **Step 3: Commit (если spec обновлён)**

```bash
git add -A
git commit -m "docs(translation): tick done-criteria in spec"
```

---

### Task 33: Push branch + open PR #4

- [ ] **Step 1: Push**

```bash
git push -u origin feat/translation-engine
```

- [ ] **Step 2: Open PR stacked on feat/reader-engine**

```bash
gh pr create --base feat/reader-engine --head feat/translation-engine \
  --title "feat: Translation engine (sub-project #4) — on-device LLM via llama.rn" \
  --body "..." # see template
```

PR body should reference:
- Spec link.
- Stacked on PR #3.
- Test plan (typecheck, jest, manual smoke).
- ⚠️ Smoke на устройстве — отдельно после реального model SHA-256 update.

- [ ] **Step 3: Tag**

```bash
git tag translation-engine-done-2026-05-17
git push origin translation-engine-done-2026-05-17
```

---

### Task 34: Manual smoke checklist (post-merge или standalone)

**Не входит в PR — отдельный smoke на устройстве:**

- [ ] Download model на симуляторе iOS (Wi-Fi).
- [ ] Wait `ready` status.
- [ ] Open book → tap word → translation appears <3s.
- [ ] Tap same word → translation appears <500ms with `cached` badge.
- [ ] Force-quit app → reopen → cache survives.
- [ ] Settings → Clear translation history → re-tap → fresh inference.
- [ ] Settings → Re-download model → progress → re-installed.
- [ ] Theme switch не ломает popup.
- [ ] 13 language pairs — smoke 3 random: en→ru, ja→en, ar→en.

---

## Notes для implementer'а

1. **llama.rn API verification** в Task 1 step 4 — критично. Реальный API
   может отличаться от plan. Adapter pattern (Task 14) изолирует разницу.

2. **SHA-256 manifest** placeholder заменить перед smoke. Реальный hash
   получить из HuggingFace или после download.

3. **iOS Metal vs Android CPU** — Hy-MT1.5-1.8B-1.25bit инференс на Pixel 7
   может быть >3s. Если реальные measurements хуже targets — open follow-up
   issue, не блокировать PR.

4. **Хранилище**: `FileSystem.documentDirectory` на Android может оказаться
   на external storage в некоторых device configs. Если AppSize limit
   проблема — рассмотреть `cacheDirectory` в #8 (но cache очищается ОС, не
   ideal для модели).

5. **iOS App Transport Security:** HuggingFace HTTPS → должно работать без
   ATS exceptions.

6. **Build time:** первая iOS build после `llama.rn` install — ~5-10 минут
   (компиляция llama.cpp Metal sources). Не пугаться.

---

## Done criteria summary

После выполнения plan:
- ✅ 34 tasks completed.
- ✅ ~300 unit tests (новые + регрессионные).
- ✅ Typecheck clean.
- ✅ PR #4 opened.
- ⏳ Device smoke (отдельно, после real model SHA).

Production-ready перевод одного слова в контексте, on-device, offline,
13×13 language pairs.
