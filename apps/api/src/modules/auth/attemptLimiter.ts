/** Counts failed confirmations per key and blocks after too many in a time window. */
export function createAttemptLimiter({ max, windowMs }: { max: number; windowMs: number }) {
  const failures = new Map<string, { count: number; resetAt: number }>();

  const current = (key: string) => {
    const entry = failures.get(key);
    if (entry && entry.resetAt > Date.now()) return entry;
    failures.delete(key);
    return undefined;
  };

  return {
    isBlocked: (key: string) => (current(key)?.count ?? 0) >= max,
    fail(key: string) {
      const entry = current(key) ?? { count: 0, resetAt: Date.now() + windowMs };
      entry.count += 1;
      failures.set(key, entry);
    },
    reset: (key: string) => failures.delete(key),
  };
}
