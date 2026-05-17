// Идентификатор текущей сборки llama.rn + STQ-патча.
// Включается в cache key для инвалидации кэша при смене kernel.
// Версия в формате только [a-z0-9-] — dots и underscores заменены на дефисы
// для совместимости с cache key regex /^[a-z0-9-]+$/.
const LLAMA_RN_VERSION = '0-12-0';
const STQ_PATCH_ID = 'pr22836-stq1-0';

export function getKernelBuildId(): string {
  return `${LLAMA_RN_VERSION}-${STQ_PATCH_ID}`;
}
