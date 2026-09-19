/**
 * Races a promise against a timeout so a stuck request surfaces as a normal,
 * catchable error instead of hanging the UI forever (e.g. a stale connection
 * after the tab was idle for a while).
 *
 * IMPORTANT — this does NOT cancel the underlying request, it only stops
 * waiting for it. That gap turned out to matter: a browser caps how many
 * concurrent connections it will open to one host (Chrome: 6). A handful of
 * requests that stall without ever being aborted — e.g. after a laptop sleeps
 * or a tab sits backgrounded long enough for a TCP connection to go dead
 * without either side noticing — can occupy every one of those slots
 * forever. Once that happens, EVERY later request queues behind them and
 * never even starts, which looks exactly like "it keeps loading forever, and
 * clicking anything doesn't help" — no matter how short a timeout wraps the
 * new click's own request, because that request never gets a connection to
 * run on in the first place.
 *
 * So this plain, non-cancelling version is now used ONLY for
 * `supabase.auth.*` calls, where the previous incident showed that aborting
 * the underlying fetch is dangerous: if the abort happens to land on the
 * internal token-refresh request, supabase-js can treat it as a failed
 * refresh and corrupt the persisted session. See supabase.ts for that story.
 *
 * Every data query (`.from()` / `.rpc()`) should use `withAbortableTimeout`
 * below instead, which actually frees the connection.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms. Please try again.`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/** A Supabase query/RPC builder — supports `.abortSignal()`, unlike `supabase.auth.*` calls. */
type Abortable<T> = {
  abortSignal: (signal: AbortSignal) => PromiseLike<T>;
};

/**
 * Same purpose as `withTimeout`, but for Supabase data queries specifically:
 * on timeout it actually cancels the in-flight HTTP request via
 * `AbortController`, freeing the browser connection slot it was holding
 * instead of leaving a zombie request behind. This is the fix for the
 * connection-pool-exhaustion failure mode described in `withTimeout`'s own
 * doc comment above.
 *
 * Usage: wrap the query builder itself, before it's awaited —
 *   `await withAbortableTimeout(supabase.from('x').select('y'), 10000, 'loadX')`
 * — never a `supabase.auth.*` call (those don't support `.abortSignal()`,
 * and shouldn't be aborted regardless; use `withTimeout` for those).
 */
export function withAbortableTimeout<T>(
  builder: Abortable<T>,
  ms: number,
  label: string
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  return Promise.resolve(builder.abortSignal(controller.signal))
    .then((value) => {
      clearTimeout(timer);
      return value;
    })
    .catch((error) => {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        throw new Error(`${label} timed out after ${ms}ms and was cancelled. Please try again.`);
      }
      throw error;
    });
}
