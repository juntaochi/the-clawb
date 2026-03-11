export class PerKeyRateLimiter {
  private timestamps = new Map<string, number>();

  constructor(private minIntervalMs: number) {}

  /**
   * Returns true if the action is allowed, false if rate-limited.
   * Updates the timestamp on success.
   */
  allow(key: string): boolean {
    const now = Date.now();
    const last = this.timestamps.get(key) ?? 0;
    if (now - last < this.minIntervalMs) return false;
    this.timestamps.set(key, now);
    return true;
  }

  /** Remove a key (e.g., on disconnect) */
  remove(key: string): void {
    this.timestamps.delete(key);
  }
}
