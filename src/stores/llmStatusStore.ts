// Runtime LLM status — Zustand store. NOT persisted (status determined
// freshly от disk + SecureStore mark на каждом app start).
import { create } from 'zustand';

export type LlmStatus =
  | 'not_installed' // нет файла модели на disk
  | 'downloading' // идёт скачивание
  | 'paused' // пауза скачивания (user или background)
  | 'verifying' // SHA-256 check
  | 'installed' // файл OK, не загружен в RAM
  | 'loading' // llama.cpp загружает в RAM
  | 'warming_up' // первая dummy inference
  | 'ready' // готов
  | 'error';

interface LlmStatusStore {
  status: LlmStatus;
  progress: number; // 0..1, только во время downloading
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
        ? { errorMessage: msg, status: 'error' as LlmStatus }
        : { errorMessage: null, status: state.status },
    ),
}));
