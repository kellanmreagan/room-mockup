/**
 * Serialized promise-queue limiter. Creators API initial limit is 1 req/sec
 * (8,640/day). AMAZON_CREATORS_RPS defaults to 1.
 */

function minIntervalMs(): number {
  const rps = Number(process.env.AMAZON_CREATORS_RPS ?? "1");
  const safe = Number.isFinite(rps) && rps > 0 ? rps : 1;
  return Math.ceil(1000 / safe);
}

class SerializedLimiter {
  private tail: Promise<void> = Promise.resolve();
  private lastStartedAt = 0;

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const wait = minIntervalMs() - (Date.now() - this.lastStartedAt);
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      this.lastStartedAt = Date.now();
      return fn();
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

const amazonLimiter = new SerializedLimiter();

export function scheduleAmazon<T>(fn: () => Promise<T>): Promise<T> {
  return amazonLimiter.schedule(fn);
}
