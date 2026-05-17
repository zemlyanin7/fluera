// Race-safe generation token manager для translateSentence.
// Каждый новый вызов получает новый токен через next(). Старые токены
// становятся stale — caller проверяет isStale() после инференса и
// выбрасывает результат если пользователь уже тапнул другое слово.
// abort() отменяет конкретный токен без инкремента счётчика.

export class GenerationTokenManager {
  private current = 0;
  private aborted = new Set<number>();

  next(): number {
    this.current += 1;
    return this.current;
  }

  isStale(token: number): boolean {
    return token !== this.current || this.aborted.has(token);
  }

  abort(token: number): void {
    this.aborted.add(token);
  }
}
