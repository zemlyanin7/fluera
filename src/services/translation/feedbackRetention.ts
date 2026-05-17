/**
 * feedbackRetention — вычисление cutoff-даты для очистки старых feedback-записей.
 * Используется при daily purge (Phase 23 polish — wire в app/_layout.tsx useEffect).
 */

export const DEFAULT_FEEDBACK_RETENTION_DAYS = 365;

/**
 * Возвращает timestamp (ms), до которого feedback-записи считаются устаревшими.
 * @param nowMs - текущий timestamp в миллисекундах
 * @param retentionDays - сколько дней хранить записи
 */
export function computeFeedbackCutoff(nowMs: number, retentionDays: number): number {
  return nowMs - retentionDays * 24 * 60 * 60 * 1000;
}
