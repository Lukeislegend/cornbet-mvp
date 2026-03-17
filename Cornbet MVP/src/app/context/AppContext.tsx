import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { projectId, publicAnonKey } from '@supabase/info';
import { API_BASE } from '../lib/apiBase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BetLeg {
  id: string;
  type: string;
  selection: string;
  odds: string;
  game: string;
  team: string;
}

export interface PlacedBet {
  id: string;           // local id (prefixed: bet_xxx / parlay_xxx / futures_xxx)
  type: string;         // 'Moneyline' | 'Spread' | 'Over/Under' | 'Futures' | 'Parlay'
  legs: BetLeg[];
  combinedOdds: string;
  stake: number;
  status: 'pending' | 'won' | 'lost';
  payout?: number;
  placedAt: number;
  // DB metadata (populated after save)
  _dbId?: string | number;
  _dbType?: 'bet' | 'parlay' | 'futures';
}

// ─── Game results (fetched from API, used for bet resolution) ─────────────────

export type GameResultsMap = Record<string, { winner: string; total: number; spreadWinners: string[] }>;

// ─── Odds helpers ─────────────────────────────────────────────────────────────

export const americanToDecimal = (american: string): number => {
  const n = parseInt(american);
  if (isNaN(n)) return 1;
  if (n > 0) return 1 + n / 100;
  return 1 + 100 / Math.abs(n);
};

export const decimalToAmerican = (decimal: number): string => {
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
  return `${Math.round(-100 / (decimal - 1))}`;
};

export const calcCombinedOdds = (odds: string[]): string => {
  if (odds.length === 0) return '+100';
  const combined = odds.reduce((acc, o) => acc * americanToDecimal(o), 1);
  return decimalToAmerican(combined);
};

export const calcPayout = (stake: number, odds: string): number =>
  stake * americanToDecimal(odds);

// ─── Resolution ───────────────────────────────────────────────────────────────

function parseOverUnderLine(selection: string): { isOver: boolean; line: number } | null {
  const s = (selection || '').toLowerCase();
  const over = s.includes('over');
  const under = s.includes('under');
  const numMatch = s.match(/(\d+\.?\d*)/);
  if (numMatch && (over || under)) {
    const line = parseFloat(numMatch[1]);
    return { isOver: over, line };
  }
  return null;
}

const checkLegResult = (leg: BetLeg, gameResults: GameResultsMap): 'won' | 'lost' | 'pending' => {
  if (leg.type === 'Futures') return 'pending';
  const result = gameResults[leg.game];
  if (!result) return 'pending';
  if (leg.type === 'Moneyline') return leg.team === result.winner ? 'won' : 'lost';
  if (leg.type === 'Spread')    return result.spreadWinners.includes(leg.team) ? 'won' : 'lost';
  if (leg.type === 'Over/Under') {
    const parsed = parseOverUnderLine(leg.selection);
    if (!parsed) return 'pending';
    const overHit = result.total > parsed.line;
    return parsed.isOver === overHit ? 'won' : 'lost';
  }
  return 'pending';
};

export const resolveBetOutcome = (bet: PlacedBet, gameResults: GameResultsMap, champion: string | null): 'won' | 'lost' | 'pending' => {
  if (bet.type === 'Futures') {
    if (!champion?.trim() || bet.legs.length === 0) return 'pending';
    const leg = bet.legs[0];
    const betTeam = (leg.team ?? leg.selection?.replace(/\s+to Win.*$/i, '') ?? '').trim();
    const champNorm = champion.trim().toLowerCase();
    const teamNorm = betTeam.toLowerCase();
    if (!teamNorm) return 'pending';
    return teamNorm === champNorm ? 'won' : 'lost';
  }
  const legResults = bet.legs.map(leg => checkLegResult(leg, gameResults));
  if (legResults.some(r => r === 'pending')) return 'pending';
  if (bet.type === 'Parlay') return legResults.every(r => r === 'won') ? 'won' : 'lost';
  return legResults[0] ?? 'pending';
};

// ─── API base ─────────────────────────────────────────────────────────────────

const BASE = API_BASE;

// ─── KV key schema (mirrors the server) ──────────────────────────────────────

const KV_TABLE   = 'kv_store_55aa94ce';
const BALANCE_DEFAULT = 500;

const kvKeys = {
  balance:   (uid: string)             => `cornbet:u:${uid}:balance`,
  bet:       (uid: string, id: string) => `cornbet:u:${uid}:bet:${id}`,
  parlay:    (uid: string, id: string) => `cornbet:u:${uid}:parlay:${id}`,
  future:    (uid: string, id: string) => `cornbet:u:${uid}:future:${id}`,
  betPfx:    (uid: string)             => `cornbet:u:${uid}:bet:%`,
  parlayPfx: (uid: string)             => `cornbet:u:${uid}:parlay:%`,
  futurePfx: (uid: string)             => `cornbet:u:${uid}:future:%`,
};

// ─── Direct Supabase KV helpers ───────────────────────────────────────────────
// These bypass the custom API server entirely.  The Supabase client
// automatically attaches the user's JWT to every table request, so no manual
// token handling is required.

async function kvRead(key: string): Promise<any> {
  const { data, error } = await supabase
    .from(KV_TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`KV read failed for key "${key}": ${error.message}`);
  return data?.value ?? null;
}

async function kvWrite(key: string, value: any): Promise<void> {
  const { error } = await supabase
    .from(KV_TABLE)
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw new Error(`KV write failed for key "${key}": ${error.message}`);
}

async function kvReadByPrefix(prefix: string): Promise<any[]> {
  const { data, error } = await supabase
    .from(KV_TABLE)
    .select('value')
    .like('key', prefix);
  if (error) throw new Error(`KV prefix read failed for "${prefix}": ${error.message}`);
  return (data ?? []).map(row => row.value).filter(Boolean);
}

function newUid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Refresh throttle ─────────────────────────────────────────────────────────
// apiFetch is allowed to attempt a session refresh at most once every 5 minutes.
// This prevents a cascade of refresh calls when the server is temporarily
// unreachable or the token is genuinely invalid.
const REFRESH_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

// ─── JWT helpers ──────────────────────────────────────────────────────────────

/**
 * Returns true if the JWT's `exp` claim is in the past (or the token is
 * malformed). We use this to decide whether to wait for TOKEN_REFRESHED
 * before bootstrapping rather than sending an expired token to the API
 * gateway (which would return 401 "Invalid JWT").
 */
function isJwtExpired(jwt: string): boolean {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    // Give a 30-second buffer so a nearly-expired token is treated as expired
    return typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000) + 30;
  } catch {
    return true; // treat malformed tokens as expired
  }
}

// ─── Context interface ────────────────────────────────────────────────────────

interface AppState {
  // Auth
  user:         User | null;
  session:      Session | null;
  isLoading:    boolean;
  authError:    string | null;
  dbError:      string | null;
  signIn:       (email: string, password: string) => Promise<void>;
  signUp:       (email: string, password: string, displayName: string) => Promise<void>;
  signOut:      () => Promise<void>;
  // App data
  displayName:  string | null;
  playWallet:   number;
  groupBank:    number;
  placedBets:   PlacedBet[];
  gameResults:  GameResultsMap;
  champion:     string | null;
  refreshGameResults: () => Promise<void>;
  refreshChampion:    () => Promise<void>;
  setPlayWallet:      (value: number) => void;
  setGroupBank:       (value: number) => void;
  addBet:             (bet: PlacedBet) => Promise<void>;
  resolveGameResults: () => Promise<void>;
  resetBets:          () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  // ── Auth state ────────────────────────────────────────────────────────────
  const [user,        setUser]        = useState<User | null>(null);
  const [session,     setSession]     = useState<Session | null>(null);
  const [isLoading,       setIsLoading]       = useState(true);
  // State (not ref) so clearLoading triggers re-renders — refs don't cause React to re-render
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [authError,        setAuthError]       = useState<string | null>(null);
  const [dbError,     setDbError]     = useState<string | null>(null);

  // ── App data ──────────────────────────────────────────────────────────────
  const [displayName,    setDisplayName]    = useState<string | null>(null);
  const [playWallet,     setPlayWalletLocal] = useState(500);
  const [groupBank,      setGroupBankLocal]  = useState(1000);
  const [placedBets,     setPlacedBets]      = useState<PlacedBet[]>([]);
  const [gameResults,    setGameResults]     = useState<GameResultsMap>({});
  const [champion,       setChampion]        = useState<string | null>(null);

  // Latest access token — updated whenever auth state changes so apiFetch
  // always uses the current token without stale closure issues.
  const tokenRef = useRef<string>(publicAnonKey);

  // Timestamp (ms) of the last token refresh attempt inside apiFetch.
  // Starts at 0 — meaning no refresh has been attempted yet.
  const lastRefreshAtRef = useRef<number>(0);

  // Guards against double-bootstrap when both getSession() and onAuthStateChange
  // could theoretically trigger the bootstrap flow.
  const bootstrappedRef = useRef(false);

  const clearLoading = useCallback(() => {
    setLoadingComplete(true);
    setIsLoading(false);
  }, []);

  // ─── apiFetch — always uses the live session token ─────────────────────────
  //
  // getSession() reads from the Supabase client's in-memory / localStorage
  // cache synchronously (no network hop) and returns the currently-valid
  // access_token.  Because autoRefreshToken:true is set on the singleton
  // client, Supabase keeps the token fresh in the background, so getSession()
  // here always returns a non-expired token for a logged-in user.
  //
  // On a 401 the function attempts one manual refreshSession() (throttled to
  // once per 5 minutes) then retries.  No further loops are possible.
  const apiFetch = useCallback(async (path: string, options?: RequestInit) => {
    // ── 1. Retrieve the current session token via getSession() ─────────────
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const freshToken = currentSession?.access_token ?? publicAnonKey;

    // Keep tokenRef in sync so the rest of the context (e.g. sign-out reset)
    // always reflects the live token.
    if (currentSession?.access_token) {
      tokenRef.current = currentSession.access_token;
    }

    // ── 2. Build the authenticated request ─────────────────────────────────
    const makeRequest = (token: string) =>
      fetch(`${BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          // Authorization: Bearer <access_token> — required by all protected routes
          Authorization: `Bearer ${token}`,
        },
      });

    let res = await makeRequest(freshToken);

    // ── 401 handling ─────────────────────────────────────────────────────
    if (res.status === 401) {
      const now = Date.now();
      const msSinceLast = now - lastRefreshAtRef.current;

      if (msSinceLast < REFRESH_THROTTLE_MS) {
        // Refresh throttled — do not retry, mark offline immediately.
        const minAgo = Math.round(msSinceLast / 60000);
        console.warn(
          `CornBet apiFetch ${path}: 401 — refresh throttled ` +
          `(last attempt ${minAgo}min ago). Marking API offline.`
        );
        // setDbError is a stable React setter — safe to call here.
        setDbError('Session error — please reload the page to reconnect.');
        const body = await res.text().catch(() => '');
        throw new Error(`API ${path} failed (401): ${body || 'Unauthorized'}`);
      }

      // Attempt one throttled refresh.
      console.warn(`CornBet apiFetch ${path}: 401 — attempting session refresh…`);
      lastRefreshAtRef.current = now; // stamp BEFORE the async call to prevent parallel refreshes

      try {
        const { data, error: refreshErr } = await supabase.auth.refreshSession();

        if (refreshErr || !data.session?.access_token) {
          console.error(
            `CornBet apiFetch ${path}: refreshSession() returned no token —`,
            refreshErr?.message ?? 'unknown'
          );
          setDbError('Session expired — please sign in again.');
          throw new Error(`API ${path} failed (401): session could not be refreshed`);
        }

        // Update the shared token ref and retry once.
        tokenRef.current = data.session.access_token;
        res = await makeRequest(data.session.access_token);

        if (!res.ok) {
          // Retry still failed — mark offline, no further loops.
          const body = await res.text().catch(() => '');
          console.error(
            `CornBet apiFetch ${path}: still failed after refresh ` +
            `(${res.status}) — marking API offline.`
          );
          setDbError('API temporarily offline — please reload the page.');
          throw new Error(`API ${path} failed (${res.status}): ${body}`);
        }

        console.log(`CornBet apiFetch ${path}: retry succeeded after token refresh`);
      } catch (err) {
        // Re-throw errors we generated above; wrap unexpected ones.
        if (err instanceof Error && err.message.startsWith('API ')) throw err;
        console.error(`CornBet apiFetch ${path}: unexpected refresh error:`, err);
        setDbError('API temporarily offline — session refresh failed.');
        throw new Error(`API ${path} failed (401): ${String(err)}`);
      }
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }, []); // stable: supabase singleton, tokenRef, lastRefreshAtRef, setDbError are all stable references

  // ─── Bootstrap data for an authenticated user ──────────────────────────────
  //
  // player-balance and maize-bank still use the server API (they work fine).
  // Bets are fetched directly from the KV table via the Supabase client so
  // the /bets API route is never called — eliminating the JWT 401 path.
  const bootstrapData = useCallback(async (freshToken: string) => {
    tokenRef.current = freshToken;
    setDbError(null);
    console.log('CornBet: bootstrapping data…');

    // Get current user id for direct KV queries
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const uid = authUser?.id;

    const [playerResult, bankResult, betsResult, gameResultsResult, championResult] = await Promise.allSettled([
      apiFetch('/player-balance'),
      apiFetch('/maize-bank'),
      // Fetch bets directly from kv_store — no custom API route involved
      uid
        ? Promise.all([
            kvReadByPrefix(kvKeys.betPfx(uid)),
            kvReadByPrefix(kvKeys.parlayPfx(uid)),
            kvReadByPrefix(kvKeys.futurePfx(uid)),
          ]).then(([bets, parlays, futures]) =>
            [...bets, ...parlays, ...futures]
              .filter(Boolean)
              .sort((a: any, b: any) => (b.placedAt ?? 0) - (a.placedAt ?? 0))
          )
        : Promise.resolve([]),
      apiFetch('/game-results'),
      apiFetch('/futures/champion'),
    ]);

    if (playerResult.status === 'fulfilled') {
      const d = playerResult.value;
      if (typeof d.balance === 'number') setPlayWalletLocal(d.balance);
      if (typeof d.displayName === 'string' && d.displayName) setDisplayName(d.displayName);
    } else {
      console.warn('CornBet bootstrap: /player-balance failed —', playerResult.reason);
    }

    if (bankResult.status === 'fulfilled') {
      const d = bankResult.value;
      if (typeof d.balance === 'number') setGroupBankLocal(d.balance);
    } else {
      console.warn('CornBet bootstrap: /maize-bank failed —', bankResult.reason);
    }

    if (betsResult.status === 'fulfilled') {
      if (Array.isArray(betsResult.value)) setPlacedBets(betsResult.value);
    } else {
      console.warn('CornBet bootstrap: bets fetch failed —', betsResult.reason);
    }

    if (gameResultsResult.status === 'fulfilled') {
      const gr = gameResultsResult.value;
      if (gr && typeof gr === 'object' && !Array.isArray(gr)) setGameResults(gr as GameResultsMap);
    } else {
      console.warn('CornBet bootstrap: game-results fetch failed —', gameResultsResult.reason);
    }

    if (championResult.status === 'fulfilled') {
      const ch = championResult.value as { champion?: string | null };
      const val = typeof ch?.champion === 'string' && ch.champion.trim() ? ch.champion.trim() : null;
      setChampion(val);
    } else {
      console.warn('CornBet bootstrap: futures/champion fetch failed —', championResult.reason);
    }

    const allOk = [playerResult, bankResult, betsResult, gameResultsResult, championResult].every(r => r.status === 'fulfilled');
    if (allOk) {
      const p    = (playerResult as PromiseFulfilledResult<any>).value;
      const b    = (bankResult   as PromiseFulfilledResult<any>).value;
      const bets = (betsResult   as PromiseFulfilledResult<any>).value;
      const gr   = (gameResultsResult as PromiseFulfilledResult<any>).value;
      console.log(
        `CornBet bootstrap OK — balance: $${p.balance}, ` +
        `name: ${p.displayName}, bank: $${b.balance}, bets: ${bets.length}, games: ${gr && typeof gr === 'object' ? Object.keys(gr).length : 0}`
      );
    } else {
      console.log('CornBet bootstrap completed with some fetch errors (see warnings above).');
    }
  }, [apiFetch]);

  // ── On mount: bootstrap then subscribe to future changes ──────────────────
  //
  // ⚠️  Lock-safety rule:
  //     Supabase v2 uses the browser Web Locks API to serialise writes to the
  //     "sb-*-auth-token" localStorage key.  Every call to getSession() or
  //     refreshSession() acquires this lock.  If two callers try to acquire it
  //     simultaneously the second one times out after 5 000 ms and logs:
  //
  //       Lock "sb-*-auth-token" was not released within 5000ms
  //
  //     The culprit is calling getSession() and onAuthStateChange() in the
  //     same synchronous tick: onAuthStateChange internally calls getSession()
  //     itself for the INITIAL_SESSION event, producing two concurrent holders.
  //
  //  Solution — sequence everything inside a single async IIFE:
  //
  //   1. await supabase.auth.getSession()  ← lock acquired → released
  //   2. (if expired) await supabase.auth.refreshSession()  ← sequential
  //   3. await bootstrapData(...)          ← pure fetch, no locks
  //   4. supabase.auth.onAuthStateChange() ← registered AFTER lock is free
  //      (its internal INITIAL_SESSION getSession() now runs uncontested)
  //
  //  The subscription ref lets the useEffect cleanup unsubscribe even though
  //  the listener is registered asynchronously.
  //
  useEffect(() => {
    let mounted = true;
    // Holds the subscription so the cleanup function can unsubscribe even
    // though it is created asynchronously inside the IIFE below.
    const subRef = {
      current: null as null | ReturnType<
        typeof supabase.auth.onAuthStateChange
      >['data']['subscription'],
    };

    (async () => {
      // ── Step 1: one getSession() call — the only lock acquisition at startup
      try {
        const { data: { session: initial } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!initial) {
          console.log('CornBet: no stored session at startup');
        } else if (isJwtExpired(initial.access_token)) {
          // Token expired — attempt one proactive refresh (sequential, lock safe)
          console.log('CornBet: stored token expired at startup — refreshing…');
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (!mounted) return;

          if (refreshed.session?.access_token) {
            lastRefreshAtRef.current = Date.now();
            tokenRef.current = refreshed.session.access_token;
            setSession(refreshed.session);
            setUser(refreshed.session.user);
            bootstrappedRef.current = true;
            await bootstrapData(refreshed.session.access_token);
          } else {
            // Cannot refresh — sign out so the user lands on the Login screen
            console.warn('CornBet: could not refresh expired token — signing out');
            await supabase.auth.signOut();
          }
        } else {
          // Valid token — bootstrap immediately
          console.log('CornBet: restoring session for', initial.user.email);
          tokenRef.current = initial.access_token;
          setSession(initial);
          setUser(initial.user);
          bootstrappedRef.current = true;
          await bootstrapData(initial.access_token);
        }
      } catch (err) {
        console.error('CornBet: startup getSession() error:', err);
      } finally {
        if (mounted) clearLoading();
      }

      // ── Step 2: subscribe to FUTURE auth changes only ─────────────────────
      //
      // Registered AFTER all lock-acquiring calls above have resolved, so
      // onAuthStateChange's internal INITIAL_SESSION getSession() call runs
      // uncontested.  We explicitly skip INITIAL_SESSION here because Step 1
      // already handled the initial state.
      if (!mounted) return;

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          if (!mounted) return;

          // Skip — initial session state was read by getSession() in Step 1.
          if (event === 'INITIAL_SESSION') return;

          // ── Signed out ──────────────────────────────────────────────────
          if (event === 'SIGNED_OUT') {
            bootstrappedRef.current = false;
            setLoadingComplete(false);
            setIsLoading(false);
            lastRefreshAtRef.current = 0;
            tokenRef.current = publicAnonKey;
            setSession(null);
            setUser(null);
            setDisplayName(null);
            setPlayWalletLocal(500);
            setGroupBankLocal(1000);
            setPlacedBets([]);
            setGameResults({});
            return;
          }

          if (!newSession) return;

          // Sync token ref and React auth state for all remaining events
          tokenRef.current = newSession.access_token;
          setSession(newSession);
          setUser(newSession.user);

          // ── TOKEN_REFRESHED ───────────────────────────────────────────
          // Supabase's autoRefreshToken ran — record the timestamp so
          // apiFetch's 5-minute throttle stays accurate.
          if (event === 'TOKEN_REFRESHED') {
            lastRefreshAtRef.current = Date.now();
            console.log('CornBet: Supabase autoRefreshToken fired — token updated');
            // Second-chance bootstrap in case the startup refresh failed
            if (!bootstrappedRef.current) {
              console.log('CornBet: bootstrapping with autoRefreshed token…');
              bootstrappedRef.current = true;
              await bootstrapData(newSession.access_token);
              if (mounted) clearLoading();
            }
            return;
          }

          // ── SIGNED_IN safety net ──────────────────────────────────────
          // signIn() calls bootstrapData directly, so bootstrappedRef is
          // already true when this fires.  This handles unexpected paths
          // (e.g. OAuth redirect) where signIn() wasn't called explicitly.
          if (event === 'SIGNED_IN') {
            if (!bootstrappedRef.current) {
              console.log('CornBet: SIGNED_IN safety-net bootstrap');
              bootstrappedRef.current = true;
              await bootstrapData(newSession.access_token);
            }
            if (mounted) clearLoading();
          }
        }
      );

      subRef.current = subscription;
    })();

    // Cleanup: unmount flag + unsubscribe (works even if subscription is set
    // asynchronously, because unsubscribe() is idempotent and subRef will be
    // populated by the time the component actually unmounts in normal usage).
    return () => {
      mounted = false;
      subRef.current?.unsubscribe();
    };
  }, [bootstrapData, clearLoading]);

  // ── Sign In ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('CornBet signIn error:', error.message);
      throw new Error(error.message);
    }

    if (!data.session || !data.user) {
      throw new Error('Sign-in succeeded but no session returned. Please try again.');
    }

    console.log('CornBet: signed in as', data.user.email);

    // signInWithPassword always returns a brand-new access token — guaranteed fresh.
    // Reset the refresh timestamp so apiFetch's throttle starts clean.
    tokenRef.current = data.session.access_token;
    lastRefreshAtRef.current = 0;
    setSession(data.session);
    setUser(data.user);
    bootstrappedRef.current = true;

    await bootstrapData(data.session.access_token);
  }, [bootstrapData]);

  // ── Sign Up ───────────────────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setAuthError(null);

    // Create user via server (service role → email_confirm: true + init balance)
    const signupRes = await fetch(`${BASE}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ email, password, displayName }),
    });

    if (!signupRes.ok) {
      const body = await signupRes.json().catch(() => ({ error: 'Signup failed' }));
      console.error('CornBet signUp server error:', body.error);
      throw new Error(body.error ?? 'Signup failed');
    }

    const signupData = await signupRes.json();
    console.log('CornBet: account created for', email, '— userId:', signupData.userId);

    // Auto sign-in after successful signup
    await signIn(email, password);
  }, [signIn]);

  // ── Sign Out ─────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    tokenRef.current = publicAnonKey;
    setSession(null);
    setUser(null);
    setPlayWalletLocal(500);
    setGroupBankLocal(1000);
    setPlacedBets([]);
    setGameResults({});
    console.log('CornBet: signed out');
  }, []);

  // ── Sync player balance to DB ─────────────────────────────────────────────
  const setPlayWallet = useCallback((value: number) => {
    setPlayWalletLocal(value);
    apiFetch('/player-balance', {
      method: 'PUT',
      body: JSON.stringify({ balance: value }),
    }).catch(err => console.error('Failed to sync player balance:', err));
  }, [apiFetch]);

  // ── Sync group bank to DB ─────────────────────────────────────────────────
  const setGroupBank = useCallback((value: number) => {
    setGroupBankLocal(value);
    apiFetch('/maize-bank', {
      method: 'PUT',
      body: JSON.stringify({ balance: value }),
    }).catch(err => console.error('Failed to sync maize bank:', err));
  }, [apiFetch]);

  // ── Add bet — direct Supabase (no custom API) ─────────────────────────────
  //
  // Flow:
  //   1. Get authenticated user from supabase.auth.getUser()
  //   2. Read current balance directly from kv_store_55aa94ce
  //   3. Validate wager ≤ balance  (reject with "Insufficient balance" if not)
  //   4. Insert bet record into kv_store_55aa94ce  (status = "pending")
  //   5. Update player balance in kv_store_55aa94ce
  //
  // The Supabase client automatically includes the user's JWT in every
  // table request — no manual token extraction or forwarding required.
  const addBet = useCallback(async (bet: PlacedBet) => {
    // ── Basic shape checks ──────────────────────────────────────────────────
    if (!bet.legs || bet.legs.length === 0) {
      throw new Error('Bet must have at least one selection.');
    }
    if (typeof bet.stake !== 'number' || bet.stake <= 0) {
      throw new Error('Wager must be greater than $0.');
    }
    if (bet.stake < 1) {
      throw new Error('Minimum wager is $1.');
    }

    // ── 1. Get authenticated user ───────────────────────────────────────────
    const { data: { user: authUser }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !authUser) {
      throw new Error('You must be signed in to place a bet.');
    }
    const userId = authUser.id;

    // ── 2. Read current balance from KV table ───────────────────────────────
    let currentBalance: number;
    try {
      const raw = await kvRead(kvKeys.balance(userId));
      currentBalance = typeof raw === 'number' ? raw : BALANCE_DEFAULT;
    } catch (err) {
      console.error('addBet: failed to read balance —', err);
      throw new Error('Could not verify your balance. Please try again.');
    }

    // ── 3. Validate wager against balance ──────────────────────────────────
    if (bet.stake > currentBalance) {
      throw new Error('Insufficient balance to place this bet.');
    }

    // ── 4. Insert bet record with status = "pending" ────────────────────────
    const uid = newUid();
    let kvKey: string;
    let dbType: 'bet' | 'parlay' | 'futures';

    if (bet.type === 'Parlay') {
      kvKey  = kvKeys.parlay(userId, uid);
      dbType = 'parlay';
    } else if (bet.type === 'Futures') {
      kvKey  = kvKeys.future(userId, uid);
      dbType = 'futures';
    } else {
      kvKey  = kvKeys.bet(userId, uid);
      dbType = 'bet';
    }

    const record = {
      ...bet,
      status:  'pending',
      _kvKey:  kvKey,
      _dbId:   uid,
      _dbType: dbType,
      userId,
    };

    try {
      await kvWrite(kvKey, record);
    } catch (err) {
      console.error('addBet: failed to insert bet record —', err);
      throw new Error('Failed to save bet. Please try again.');
    }

    // ── 5. Update player balance (deduct wager) ─────────────────────────────
    const newBalance = Math.round((currentBalance - bet.stake) * 100) / 100;
    try {
      await kvWrite(kvKeys.balance(userId), newBalance);
    } catch (err) {
      console.error('addBet: failed to update balance —', err);
      // Bet was saved but balance update failed — still update local state
      // so the UI reflects the deduction; server will reconcile on next load.
    }

    // ── Update local React state ────────────────────────────────────────────
    setPlayWalletLocal(newBalance);
    setPlacedBets(prev => [...prev, { ...bet, _dbId: uid, _dbType: dbType }]);

    console.log(
      `addBet OK (direct Supabase): type=${bet.type} stake=$${bet.stake} ` +
      `newBalance=$${newBalance}`
    );
  }, []);  // no apiFetch dependency — uses direct KV helpers

  // ── Refresh game results (for Admin after entering scores) ─────────────────
  const refreshGameResults = useCallback(async () => {
    try {
      const gr = await apiFetch('/game-results');
      if (gr && typeof gr === 'object' && !Array.isArray(gr)) setGameResults(gr as GameResultsMap);
    } catch (err) {
      console.warn('refreshGameResults failed:', err);
    }
  }, [apiFetch]);

  const refreshChampion = useCallback(async () => {
    try {
      const ch = await apiFetch('/futures/champion');
      if (ch && typeof ch === 'object' && typeof ch.champion === 'string') {
        setChampion(ch.champion.trim() || null);
      } else {
        setChampion(null);
      }
    } catch (err) {
      console.warn('refreshChampion failed:', err);
    }
  }, [apiFetch]);

  // ── Resolve game results ──────────────────────────────────────────────────
  //
  // 1. Compute outcomes locally using fetched game results
  // 2. POST /bets/resolve-batch — server applies balance / bank changes
  // 3. Re-fetch balances from server for accuracy
  // 4. Update local bet state
  const resolveGameResults = useCallback(async () => {
    const resolutions: { bet: PlacedBet; outcome: 'won' | 'lost'; payout: number }[] = [];

    const updatedBets = placedBets.map(bet => {
      if (bet.status !== 'pending') return bet;

      const outcome = resolveBetOutcome(bet, gameResults, champion);
      if (outcome === 'pending') return bet;

      const payout = outcome === 'won' ? calcPayout(bet.stake, bet.combinedOdds) : 0;
      resolutions.push({ bet, outcome, payout });

      return { ...bet, status: outcome as 'won' | 'lost', payout };
    });

    if (resolutions.length === 0) {
      console.log('resolveGameResults: no pending bets to resolve');
      return;
    }

    // Optimistically update local bet list for instant UI feedback
    setPlacedBets(updatedBets);

    // Build the batch payload for the server
    const batchPayload = resolutions
      .filter(r => r.bet._dbId && r.bet._dbType)
      .map(r => ({
        dbId:   r.bet._dbId!,
        dbType: r.bet._dbType!,
        status: r.outcome,
        payout: r.payout,
      }));

    if (batchPayload.length === 0) {
      console.log('resolveGameResults: no DB-persisted bets to resolve (local only)');
      return;
    }

    try {
      const result = await apiFetch('/bets/resolve-batch', {
        method: 'POST',
        body: JSON.stringify(batchPayload),
      });

      // Update local balances from the authoritative server response
      if (typeof result.newBalance === 'number') setPlayWalletLocal(result.newBalance);
      if (typeof result.newBank    === 'number') setGroupBankLocal(result.newBank);

      console.log(
        `resolveGameResults: ${result.resolved} bets resolved — ` +
        `balance=$${result.newBalance} bank=$${result.newBank}`
      );
    } catch (err) {
      console.error('resolveGameResults: batch resolve failed:', err);
      // Re-fetch balances as a fallback to stay in sync
      try {
        const [playerData, bankData] = await Promise.all([
          apiFetch('/player-balance'),
          apiFetch('/maize-bank'),
        ]);
        if (typeof playerData.balance === 'number') setPlayWalletLocal(playerData.balance);
        if (typeof bankData.balance   === 'number') setGroupBankLocal(bankData.balance);
      } catch (fetchErr) {
        console.error('resolveGameResults: balance re-fetch also failed:', fetchErr);
      }
    }
  }, [placedBets, apiFetch, gameResults, champion]);

  const resetBets = useCallback(() => setPlacedBets([]), []);

  // Once loadingComplete is true, never show spinner — fixes race where
  // setIsLoading(false) is called but SIGNED_IN fires after and React batches oddly
  const effectiveIsLoading = loadingComplete ? false : isLoading;

  return (
    <AppContext.Provider value={{
      user, session, isLoading: effectiveIsLoading, authError, dbError,
      signIn, signUp, signOut,
      displayName, playWallet, groupBank, placedBets,
      setPlayWallet, setGroupBank,
      addBet, resolveGameResults, resetBets,
      gameResults, champion, refreshGameResults, refreshChampion,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}