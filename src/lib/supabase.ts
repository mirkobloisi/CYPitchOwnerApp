import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { rememberMeAwareStorage } from './rememberMe';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL');
}

if (!supabasePublishableKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
}

// Expo can render web routes in Node, where there is no `window` and no
// localStorage. AsyncStorage reaches for window on web, and the auth client
// reads stored sessions as soon as it is created — which crashes the render
// with "window is not defined". Only web-without-a-window means Node; native
// always has real AsyncStorage.
const isServerRendering = Platform.OS === 'web' && typeof window === 'undefined';

/** Stand-in used only during server rendering; nothing is persisted there. */
const noopStorage = {
  getItem: async (_key: string) => null,
  setItem: async (_key: string, _value: string) => {},
  removeItem: async (_key: string) => {},
};

function resolveAuthStorage() {
  if (isServerRendering) {
    return noopStorage;
  }

  // The phone app stays signed in between launches, exactly like the player
  // app: closing it is not a security event the way leaving a browser open on
  // a shared computer is.
  if (Platform.OS !== 'web') {
    return AsyncStorage;
  }

  // On the website the lifetime is the owner's choice, made with the
  // "Remember me" tick on the login form — localStorage to survive the browser
  // being quit, sessionStorage to be gone with the tab. See rememberMe.ts.
  return rememberMeAwareStorage;
}

// THE ACTUAL ROOT CAUSE OF THE PERSISTENT FREEZE:
// supabase-js serializes every auth operation — getSession(), refreshSession(),
// sign-in, sign-out, and critically its own internal auto-refresh tick that
// fires on a timer — through a single lock, so only one can run at a time.
// The default browser lock (`processLock`, which we switched to earlier
// because React Native has no Web Locks API) is a strict queue: each caller
// awaits the previous one *fully finishing* before it even starts, with no
// timeout of its own. That's fine as long as every locked call eventually
// settles — but a request can be left dangling with no resolution and no
// rejection at all, most commonly a token-refresh fetch that was in flight
// right as the tab was backgrounded, whose underlying connection quietly
// dies without ever erroring out in JS. When that happens the lock is held
// forever, and every auth call made afterwards — including the ones this
// app's own screens trigger on every mount, and the SDK's own background
// refresh tick — queues up behind it and waits forever too. That is why
// wrapping individual data queries in a cancelling timeout (see
// withTimeout.ts) didn't fully fix it: those queries aren't what's stuck,
// the shared auth lock underneath all of them is, and no per-query timeout
// can free a lock it was never given a handle to.
//
// This replaces the lock itself with one that can never be wedged
// indefinitely: it behaves exactly like a normal one-at-a-time queue in the
// ordinary case, but a new caller only waits up to LOCK_WAIT_TIMEOUT_MS for
// the previous holder — after that it proceeds anyway rather than hang. That
// gives up strict serialization in the rare stuck case (nothing in this app
// depends on two auth calls never overlapping) in exchange for a hard
// guarantee that the app can never be stuck loading forever because of this.
const LOCK_WAIT_TIMEOUT_MS = 8000;
let lockGate: Promise<void> = Promise.resolve();

async function timeoutSafeLock<R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  await Promise.race([
    lockGate,
    new Promise<void>((resolve) => setTimeout(resolve, LOCK_WAIT_TIMEOUT_MS)),
  ]);

  let release: () => void = () => {};
  lockGate = new Promise<void>((resolve) => {
    release = resolve;
  });

  try {
    return await fn();
  } finally {
    release();
  }
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: resolveAuthStorage(),
    // Nothing to refresh or persist when there is no browser to store it in.
    autoRefreshToken: !isServerRendering,
    persistSession: !isServerRendering,
    detectSessionInUrl: false,
    lock: timeoutSafeLock,
  },
  // IMPORTANT: do not wrap `global.fetch` with a client-side abort timeout
  // here. An earlier version of this file did that to fail fast on a stale
  // connection after the tab had been idle — but aborting a request that
  // happened to be the token refresh call made supabase-js treat it as a
  // failed refresh, which can clear the persisted session. That surfaced as
  // something worse than the original bug: actions failing with an error,
  // and even a hard page reload landing back at a broken/logged-out state,
  // since the corrupted session was already written to storage. Data-query
  // timeouts belong at the call site (see `withTimeout` in `withTimeout.ts`,
  // used by pitchData.ts) where a stuck request can safely surface as a
  // normal, retryable error — never inside the auth client's own fetch.
});

// On web, browsers throttle or fully pause a background tab's timers, so the
// client's own periodic auto-refresh tick can fire late, not at all, or (in
// the worst case) right as the tab is hidden and then get abandoned mid
// request. Supabase's own documented pattern for this (written for React
// Native's AppState, ported here to the DOM's visibility event since this
// app also runs on web) is to explicitly stop that timer while hidden and
// restart it when visible again, rather than let it run — or get stuck —
// somewhere in the background. The actual re-sync of this app's screens
// after the tab comes back happens once, in auth.tsx's own visibility
// listener (AuthProvider's refresh()) — this listener only manages the
// SDK's internal timer, so the two don't race each other on every tab focus.
if (!isServerRendering && Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      supabase.auth.stopAutoRefresh();
    } else {
      supabase.auth.startAutoRefresh();
    }
  });
}
