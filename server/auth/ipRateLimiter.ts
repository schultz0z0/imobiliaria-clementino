export const DEFAULT_IP_RATE_LIMIT_MAX_ENTRIES = 10_000;

type IpFailureEntry = {
  failureTimes: number[];
  lastAccessedAt: number;
  accessOrder: number;
};

export type IpFailureRateLimiterOptions = {
  failureLimit: number;
  windowMs: number;
  maxEntries?: number;
  now?: () => number;
};

export class IpFailureRateLimiter {
  readonly #failureLimit: number;
  readonly #windowMs: number;
  readonly #maxEntries: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, IpFailureEntry>();
  #accessOrder = 0;

  constructor(options: IpFailureRateLimiterOptions) {
    if (
      !Number.isInteger(options.failureLimit) ||
      options.failureLimit < 1 ||
      !Number.isFinite(options.windowMs) ||
      options.windowMs <= 0 ||
      !Number.isInteger(options.maxEntries ?? DEFAULT_IP_RATE_LIMIT_MAX_ENTRIES) ||
      (options.maxEntries ?? DEFAULT_IP_RATE_LIMIT_MAX_ENTRIES) < 1
    ) {
      throw new Error('IP rate limiter limits must be positive');
    }
    this.#failureLimit = options.failureLimit;
    this.#windowMs = options.windowMs;
    this.#maxEntries = options.maxEntries ?? DEFAULT_IP_RATE_LIMIT_MAX_ENTRIES;
    this.#now = options.now ?? Date.now;
  }

  get size(): number {
    this.#sweepExpired(this.#now());
    return this.#entries.size;
  }

  isLimited(ip: string): boolean {
    const now = this.#now();
    this.#sweepExpired(now);
    const entry = this.#entries.get(ip);
    if (!entry) {
      return false;
    }
    this.#touch(entry, now);
    return entry.failureTimes.length >= this.#failureLimit;
  }

  recordFailure(ip: string): void {
    const now = this.#now();
    this.#sweepExpired(now);
    let entry = this.#entries.get(ip);
    if (!entry) {
      if (this.#entries.size >= this.#maxEntries) {
        this.#evictLeastRecentlyUsed();
      }
      entry = { failureTimes: [], lastAccessedAt: now, accessOrder: 0 };
      this.#entries.set(ip, entry);
    }
    entry.failureTimes.push(now);
    this.#touch(entry, now);
  }

  clear(ip: string): void {
    this.#entries.delete(ip);
  }

  #touch(entry: IpFailureEntry, now: number): void {
    entry.lastAccessedAt = now;
    entry.accessOrder = ++this.#accessOrder;
  }

  #sweepExpired(now: number): void {
    const cutoff = now - this.#windowMs;
    for (const [ip, entry] of this.#entries) {
      entry.failureTimes = entry.failureTimes.filter((failureTime) => failureTime > cutoff);
      if (entry.failureTimes.length === 0) {
        this.#entries.delete(ip);
      }
    }
  }

  #evictLeastRecentlyUsed(): void {
    let candidate: { ip: string; entry: IpFailureEntry } | undefined;
    for (const [ip, entry] of this.#entries) {
      if (
        !candidate ||
        entry.lastAccessedAt < candidate.entry.lastAccessedAt ||
        (entry.lastAccessedAt === candidate.entry.lastAccessedAt &&
          entry.accessOrder < candidate.entry.accessOrder)
      ) {
        candidate = { ip, entry };
      }
    }
    if (candidate) {
      this.#entries.delete(candidate.ip);
    }
  }
}
