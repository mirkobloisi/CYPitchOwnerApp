/**
 * "Remember me" decides how long a signed-in session survives in a browser.
 *
 * Supabase is handed its storage once, when the client is created, long before
 * anyone has ticked anything — so the choice cannot be made by building two
 * different clients. Instead there is one adapter that reads the flag on every
 * access and routes to whichever store is currently chosen:
 *
 *   Remember me ON  -> localStorage.   The session outlives the browser being
 *                                      quit; the owner returns already signed in.
 *   Remember me OFF -> sessionStorage. The session belongs to that one tab and
 *                                      dies with it, which is what protects a
 *                                      shared or public computer.
 *
 * Only the flag itself is ever written to localStorage — never an email, never
 * a password. Saving credentials is the browser password manager's job (Google
 * Password Manager, iCloud Keychain, 1Password), which is what the autocomplete
 * hints on the login and signup forms are there to trigger.
 *
 * None of this applies to the native builds: those keep their AsyncStorage
 * session and stay signed in, exactly like the player app.
 */

const REMEMBER_KEY = 'mypitch.rememberMe';

/** Supabase stores the session under `sb-<project-ref>-auth-token`. */
const SUPABASE_KEY_PREFIX = 'sb-';

// Reading a Storage can throw outright (Safari private mode, blocked cookies,
// an embedded webview). Probe each one once and remember the answer rather
// than wrapping every single read in a try/catch on a hot path.
let localAvailable: boolean | null = null;
let sessionAvailable: boolean | null = null;

function probe(store: Storage): boolean {
  try {
    const key = '__mypitch_probe__';
    store.setItem(key, '1');
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function local(): Storage | null {
  if (typeof window === 'undefined') return null;
  if (localAvailable === null) localAvailable = probe(window.localStorage);
  return localAvailable ? window.localStorage : null;
}

function session(): Storage | null {
  if (typeof window === 'undefined') return null;
  if (sessionAvailable === null) sessionAvailable = probe(window.sessionStorage);
  return sessionAvailable ? window.sessionStorage : null;
}

export function getRememberMe(): boolean {
  try {
    return local()?.getItem(REMEMBER_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Record the choice. Call this immediately BEFORE signing in, so that the
 * session Supabase is about to write lands in the right store from the start.
 */
export function setRememberMe(value: boolean) {
  try {
    local()?.setItem(REMEMBER_KEY, value ? 'true' : 'false');
  } catch {
    // A browser that refuses to store the flag simply gets the stricter
    // default (tab-scoped), which is the safe way to fail.
  }

  // Drop any session left in the store we are no longer using, so that an
  // earlier "remember me" login can never quietly outlive this choice.
  clearSupabaseKeys(value ? session() : local());
}

function clearSupabaseKeys(store: Storage | null) {
  if (!store) return;

  try {
    const keys: string[] = [];
    for (let index = 0; index < store.length; index++) {
      const key = store.key(index);
      if (key && key.startsWith(SUPABASE_KEY_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // Nothing to clean up if the store cannot be read.
  }
}

function activeStore(): Storage | null {
  return getRememberMe() ? local() : session();
}

/** The storage adapter handed to `createClient`. */
export const rememberMeAwareStorage = {
  getItem: async (key: string) => {
    try {
      return activeStore()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      activeStore()?.setItem(key, value);
      // Never leave a second copy behind in the other store.
      const other = getRememberMe() ? session() : local();
      other?.removeItem(key);
    } catch {
      // Losing the write means the person has to sign in again later, which
      // is far better than the app failing here.
    }
  },
  removeItem: async (key: string) => {
    try {
      local()?.removeItem(key);
      session()?.removeItem(key);
    } catch {
      // Nothing to do.
    }
  },
};
