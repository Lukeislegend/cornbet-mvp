import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// ─── Logging & CORS ──────────────────────────────────────────────────────────
app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

const PREFIX = "/make-server-55aa94ce";

// ─── Supabase client factories ────────────────────────────────────────────────
// Only the admin client (service role) is used server-side.
// The service role key bypasses RLS and is never exposed to the frontend.

function adminSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ─── JWT → userId ─────────────────────────────────────────────────────────────
// Creates a per-request Supabase client initialised with the ANON_KEY and the
// caller's JWT forwarded in the Authorization header.  Calling getUser() with
// no argument lets Supabase's auth service validate the signature — the server
// never decodes the JWT manually.

async function getUserId(authHeader: string | null | undefined): Promise<string | null> {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  // Reject the anon key immediately — it is not a user session token.
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (token === anonKey) {
    console.log("JWT check: received anon key — not a user session, rejecting");
    return null;
  }

  try {
    // Per-request client: anon key + user JWT forwarded via global header.
    // supabase.auth.getUser() (no argument) validates the JWT server-side
    // using the project JWT secret — no manual verification needed.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      anonKey,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth:   { persistSession: false },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.id) {
      console.log("getUser failed:", error?.message ?? "no user returned");
      return null;
    }
    return user.id;
  } catch (err) {
    console.log("getUserId exception:", err);
    return null;
  }
}

async function requireAuth(c: any): Promise<string | Response> {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized — valid session token required" }, 401);
  return userId;
}

// ─── KV key schema (per-user) ─────────────────────────────────────────────────
//
//   cornbet:u:{userId}:balance        → number   (player wallet)
//   cornbet:bank:main                 → number   (shared group bank)
//   cornbet:u:{userId}:bet:{id}       → BetRecord
//   cornbet:u:{userId}:parlay:{id}    → ParlayRecord
//   cornbet:u:{userId}:future:{id}    → FutureRecord

const KEY_BANK         = "cornbet:bank:main";
const KEY_REGISTRY     = "cornbet:registry";   // maps userId → { displayName, joinedAt }
const KEY_GAME_RESULTS = "cornbet:games:results";
const BANK_DEFAULT    = 1000;
const BALANCE_DEFAULT = 500;

const keys = {
  balance:     (uid: string)              => `cornbet:u:${uid}:balance`,
  displayName: (uid: string)              => `cornbet:u:${uid}:displayName`,
  bet:         (uid: string, id: string)  => `cornbet:u:${uid}:bet:${id}`,
  parlay:      (uid: string, id: string)  => `cornbet:u:${uid}:parlay:${id}`,
  future:      (uid: string, id: string)  => `cornbet:u:${uid}:future:${id}`,
  betPfx:    (uid: string)              => `cornbet:u:${uid}:bet:`,
  parlayPfx: (uid: string)              => `cornbet:u:${uid}:parlay:`,
  futurePfx: (uid: string)              => `cornbet:u:${uid}:future:`,
};

// ─── KV atomic helpers ────────────────────────────────────────────────────────
// KV has no real transactions; we read→modify→write sequentially.

async function readBalance(userId: string): Promise<number> {
  const raw = await kv.get(keys.balance(userId));
  return typeof raw === "number" ? raw : BALANCE_DEFAULT;
}

async function writeBalance(userId: string, amount: number): Promise<void> {
  // Round to 2 decimal places to avoid floating-point drift
  await kv.set(keys.balance(userId), Math.round(amount * 100) / 100);
}

async function readDisplayName(userId: string): Promise<string | null> {
  const raw = await kv.get(keys.displayName(userId));
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

async function writeDisplayName(userId: string, name: string): Promise<void> {
  await kv.set(keys.displayName(userId), name.trim().slice(0, 32));
}

// ��── Player registry ──────────────────────────────────────────────────────────
// A single KV record mapping userId → { displayName, joinedAt }.
// Enables the leaderboard to list ALL registered players without a SQL table.

interface RegistryEntry { displayName: string; joinedAt: number; }
type Registry = Record<string, RegistryEntry>;

async function readRegistry(): Promise<Registry> {
  const raw = await kv.get(KEY_REGISTRY);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Registry;
  return {};
}

async function addToRegistry(userId: string, displayName: string): Promise<void> {
  const registry = await readRegistry();
  // Only set joinedAt on first registration; skip update if already present
  if (!registry[userId]) {
    registry[userId] = { displayName: displayName.trim().slice(0, 32), joinedAt: Date.now() };
  } else {
    // Update display name if user re-registers (e.g. after account reset)
    registry[userId] = { ...registry[userId], displayName: displayName.trim().slice(0, 32) };
  }
  await kv.set(KEY_REGISTRY, registry);
}

async function readBank(): Promise<number> {
  const raw = await kv.get(KEY_BANK);
  return typeof raw === "number" ? raw : BANK_DEFAULT;
}

async function writeBank(amount: number): Promise<void> {
  await kv.set(KEY_BANK, Math.round(amount * 100) / 100);
}

// ─── Game results (for bet resolution) ───────────────────────────────────────
// Format: { "Away vs Home": { winner, total, spreadWinners } }

interface GameResult {
  winner: string;
  total: number;
  spreadWinners: string[];
}

type GameResultsMap = Record<string, GameResult>;

async function readGameResults(): Promise<GameResultsMap> {
  const raw = await kv.get(KEY_GAME_RESULTS);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as GameResultsMap;
  return {};
}

async function writeGameResults(results: GameResultsMap): Promise<void> {
  await kv.set(KEY_GAME_RESULTS, results);
}

// ─── Futures champion (for championship winner bets) ───────────────────────────
const KEY_FUTURES_CHAMPION = "cornbet:futures:champion";

async function readFuturesChampion(): Promise<string | null> {
  const raw = await kv.get(KEY_FUTURES_CHAMPION);
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

async function writeFuturesChampion(team: string): Promise<void> {
  await kv.set(KEY_FUTURES_CHAMPION, team.trim());
}

// ─── NCAA Tournament team filter ─────────────────────────────────────────────
// Fetches team names currently in the NCAA Tournament bracket via ESPN's
// groups=100 endpoint. Returns an empty set on failure (show all as fallback).

async function fetchTournamentTeams(): Promise<Set<string>> {
  const teams = new Set<string>();
  try {
    const now = new Date();
    // Fetch today + next 7 days to capture full current round + next round
    const fetches = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      return fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&dates=${dateStr}&limit=50`
      )
        .then(r => r.ok ? r.json() : { events: [] })
        .catch(() => ({ events: [] }));
    });
    const results = await Promise.all(fetches);
    for (const data of results) {
      for (const event of (data.events ?? [])) {
        for (const comp of (event.competitions ?? [])) {
          for (const c of (comp.competitors ?? [])) {
            const dn: string | undefined = c.team?.displayName;
            const sn: string | undefined = c.team?.shortDisplayName;
            if (dn) teams.add(dn.toLowerCase());
            if (sn) teams.add(sn.toLowerCase());
          }
        }
      }
    }
    console.log(`Tournament teams fetched: ${teams.size}`);
  } catch (e) {
    console.log("fetchTournamentTeams error:", e);
  }
  return teams;
}

function isInTournament(teamName: string, tournamentTeams: Set<string>): boolean {
  const normalized = teamName.toLowerCase();
  if (tournamentTeams.has(normalized)) return true;
  for (const t of tournamentTeams) {
    if (normalized.includes(t) || t.includes(normalized)) return true;
  }
  return false;
}

// ─── ESPN results fetch ───────────────────────────────────────────────────────
// Fetches completed NCAAB games from the free ESPN scoreboard API.
// Checks today + last 2 days so games played the previous night are caught.

interface ESPNGame {
  winner:    string;
  homeScore: number;
  awayScore: number;
  homeTeam:  string;
  awayTeam:  string;
}

async function fetchESPNResults(): Promise<Record<string, ESPNGame>> {
  const results: Record<string, ESPNGame> = {};

  // Build YYYYMMDD strings for today and the prior 2 days
  const dates: string[] = [];
  for (let d = 0; d <= 2; d++) {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    dates.push(dt.toISOString().slice(0, 10).replace(/-/g, ""));
  }

  await Promise.all(dates.map(async (dateStr) => {
    try {
      const url =
        `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${dateStr}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(t));
      if (!res.ok) return;

      const data = await res.json();
      for (const event of data.events ?? []) {
        const competition = event.competitions?.[0];
        if (!competition?.status?.type?.completed) continue;

        const comps = (competition.competitors ?? []) as any[];
        const home  = comps.find((c: any) => c.homeAway === "home");
        const away  = comps.find((c: any) => c.homeAway === "away");
        if (!home || !away) continue;

        const homeTeam  = home.team.displayName as string;
        const awayTeam  = away.team.displayName as string;
        const homeScore = parseInt(home.score ?? "0");
        const awayScore = parseInt(away.score ?? "0");
        const winner    = home.winner ? homeTeam : awayTeam;

        // Game key matches how bets are stored: "Away vs Home"
        const gameKey = `${awayTeam} vs ${homeTeam}`;
        results[gameKey] = { winner, homeScore, awayScore, homeTeam, awayTeam };
      }
    } catch (err) {
      console.log(`fetchESPNResults: error for date ${dateStr}:`, err);
    }
  }));

  console.log(`fetchESPNResults: ${Object.keys(results).length} completed games found`);
  return results;
}

// Parse the point spread from a leg label like "Duke -5.5 (-110)" → -5.5
function parseSpreadPoints(label: string, teamName: string): number | null {
  const rest  = label.slice(teamName.length).trim();
  const match = rest.match(/^([+-]?\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

// Returns true if teamName covered their spread given the final scores
function coveredSpread(
  teamName: string, spread: number,
  homeTeam: string, homeScore: number, awayScore: number
): boolean {
  const isHome = teamName === homeTeam;
  const margin = isHome ? (homeScore - awayScore) : (awayScore - homeScore);
  // Covers if: actual margin + spread > 0
  // e.g. Duke -5.5 wins by 10 → 10 + (-5.5) = 4.5 > 0 ✓
  // e.g. Duke -5.5 wins by  3 →  3 + (-5.5) = -2.5   ✗
  return (margin + spread) > 0;
}

// Server-side leg resolution — mirrors AppContext checkLegResult
function resolveServerLeg(leg: any, gr: GameResultsMap): "won" | "lost" | "pending" {
  if (!leg || leg.type === "Futures") return "pending";
  const result = gr[leg.game as string];
  if (!result) return "pending";

  if (leg.type === "Moneyline") {
    return (leg.team as string) === result.winner ? "won" : "lost";
  }
  if (leg.type === "Spread") {
    return result.spreadWinners.includes(leg.team as string) ? "won" : "lost";
  }
  if (leg.type === "Over/Under") {
    const sel      = ((leg.selection ?? leg.team) as string ?? "").toLowerCase();
    const isOver   = sel.includes("over");
    const isUnder  = sel.includes("under");
    const numMatch = sel.match(/(\d+\.?\d*)/);
    if (!numMatch || (!isOver && !isUnder)) return "pending";
    const line = parseFloat(numMatch[1]);
    if (isNaN(line)) return "pending";
    return isOver ? (result.total > line ? "won" : "lost") : (result.total < line ? "won" : "lost");
  }
  return "pending";
}

// Server-side bet resolution — mirrors AppContext resolveBetOutcome
function resolveServerBet(
  bet: any, gr: GameResultsMap, champion: string | null
): "won" | "lost" | "pending" {
  if (bet.type === "Futures") {
    if (!champion?.trim()) return "pending";
    const leg = (bet.legs as any[])?.[0];
    if (!leg) return "pending";
    const betTeam = ((leg.team ?? leg.selection) as string ?? "").trim().toLowerCase();
    return betTeam === champion.trim().toLowerCase() ? "won" : "lost";
  }
  const legs    = (bet.legs as any[]) ?? [];
  const results = legs.map((leg: any) => resolveServerLeg(leg, gr));
  if (results.some((r: string) => r === "pending")) return "pending";
  if (bet.type === "Parlay") return results.every((r: string) => r === "won") ? "won" : "lost";
  return results[0] ?? "pending";
}

// ─── Bet validation ───────────────────────────────────────────────────────────

interface ValidationError { field: string; message: string; }

function validateBet(bet: any): ValidationError | null {
  // Wager must be a positive number
  if (typeof bet.stake !== "number" || isNaN(bet.stake)) {
    return { field: "stake", message: "Wager must be a number." };
  }
  if (bet.stake <= 0) {
    return { field: "stake", message: "Wager must be greater than $0." };
  }
  if (bet.stake < 1) {
    return { field: "stake", message: "Minimum wager is $1." };
  }

  // Legs must be present and non-empty
  if (!Array.isArray(bet.legs) || bet.legs.length === 0) {
    return { field: "legs", message: "Bet must have at least one selection." };
  }

  // Each leg must have required fields
  for (const leg of bet.legs) {
    if (!leg.selection || String(leg.selection).trim() === "") {
      return { field: "selection", message: "Each bet leg must have a valid selection." };
    }
    if (!leg.type || String(leg.type).trim() === "") {
      return { field: "type", message: "Each bet leg must have a valid bet type." };
    }
    if (!leg.odds || String(leg.odds).trim() === "") {
      return { field: "odds", message: "Each bet leg must have valid odds." };
    }
  }

  // Parlay must have at least 2 legs
  if (bet.type === "Parlay" && bet.legs.length < 2) {
    return { field: "legs", message: "A parlay requires at least 2 legs." };
  }

  // combinedOdds must be present
  if (!bet.combinedOdds || String(bet.combinedOdds).trim() === "") {
    return { field: "combinedOdds", message: "Bet must have valid combined odds." };
  }

  return null; // valid
}

// ─── Unique record ID ─────────────────────────────────────────────────────────

function newUid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Health / Ping ────────────────────────────────────────────────────────────
// Both routes are intentionally open — neither calls requireAuth.
//
// /db-ping works by creating its own Supabase client directly from
// SUPABASE_SERVICE_ROLE_KEY (server-to-server, no user JWT involved).
// It performs a minimal SELECT on the KV table to confirm DB reachability,
// then returns { status: "ok" }.  It never reads the Authorization header.

app.get(`${PREFIX}/health`, (c) => c.json({ status: "ok" }));

app.get(`${PREFIX}/db-ping`, async (c) => {
  try {
    // Build a fresh admin client from the service role key.
    // SUPABASE_SERVICE_ROLE_KEY bypasses RLS — no user JWT needed for this query.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Lightweight existence check — equivalent to "SELECT 1 FROM kv_store LIMIT 1".
    // If the database is unreachable this will throw or return a Supabase error.
    const { error } = await supabaseAdmin
      .from("kv_store_55aa94ce")
      .select("key")
      .limit(1);

    if (error) {
      console.log("db-ping: query returned error —", error.message);
      return c.json({ status: "error", error: error.message }, 500);
    }

    console.log("db-ping: database reachable");
    return c.json({ status: "ok" });
  } catch (err) {
    console.log("db-ping: unexpected error —", String(err));
    return c.json({ status: "error", error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH — POST /auth/signup
// Creates user with email_confirm:true, initialises $500 balance in KV.
// ══════════════════════════════════════════════════════════════════════════════

app.post(`${PREFIX}/auth/signup`, async (c) => {
  try {
    const { email, password, displayName } = await c.req.json() ?? {};
    if (!email || !password) return c.json({ error: "email and password are required" }, 400);
    if (password.length < 6)  return c.json({ error: "Password must be at least 6 characters" }, 400);

    const trimmedName = typeof displayName === "string" ? displayName.trim() : "";
    if (!trimmedName)            return c.json({ error: "Display name is required" }, 400);
    if (trimmedName.length < 2)  return c.json({ error: "Display name must be at least 2 characters" }, 400);
    if (trimmedName.length > 20) return c.json({ error: "Display name must be 20 characters or fewer" }, 400);

    // MVP: limit to 10 users
    const registry = await readRegistry();
    if (Object.keys(registry).length >= 10) {
      console.log("Signup rejected: CornBet MVP is full (10 users)");
      return c.json({ error: "CornBet MVP is full. This group is limited to 10 members." }, 400);
    }

    const admin = adminSupabase();
    const { data, error } = await admin.auth.admin.createUser({
      email, password,
      user_metadata: { app: "cornbet", displayName: trimmedName },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.log("Signup error:", error.message);
      return c.json({ error: error.message }, 400);
    }

    const userId = data.user.id;

    // Write all player data atomically (sequential to avoid races)
    await writeBalance(userId, BALANCE_DEFAULT);
    await writeDisplayName(userId, trimmedName);
    await addToRegistry(userId, trimmedName);

    console.log(`Signup OK: userId=${userId} email=${email} displayName="${trimmedName}" balance=$${BALANCE_DEFAULT}`);
    return c.json({ userId, displayName: trimmedName, message: "Account created. Starting balance: $500." });

  } catch (err) {
    console.log("Unexpected error in POST /auth/signup:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PLAYER BALANCE  (auth required)
// ══════════════════════════════════════════════════════════════════════════════

app.get(`${PREFIX}/player-balance`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    // Read balance and display name in parallel
    const [balance, kvDisplayName] = await Promise.all([
      readBalance(userId),
      readDisplayName(userId),
    ]);

    let displayName = kvDisplayName;

    // Fallback: if KV doesn't have a display name (legacy account created before
    // this feature), check user_metadata stored in Supabase Auth.
    if (!displayName) {
      try {
        const { data: { user } } = await adminSupabase().auth.admin.getUserById(userId);
        const metaName = user?.user_metadata?.displayName;
        if (typeof metaName === "string" && metaName.trim()) {
          displayName = metaName.trim();
          // Backfill KV and registry so future reads are faster
          await writeDisplayName(userId, displayName);
          await addToRegistry(userId, displayName);
          console.log(`Backfilled displayName from user_metadata for userId=${userId}: "${displayName}"`);
        }
      } catch (metaErr) {
        console.log(`Could not read user_metadata for userId=${userId}:`, metaErr);
      }
    }

    // Always ensure user is in the registry (handles accounts that bypassed signup endpoint)
    if (displayName) {
      const registry = await readRegistry();
      if (!registry[userId]) {
        await addToRegistry(userId, displayName);
        console.log(`Auto-registered userId=${userId} in registry with name "${displayName}"`);
      }
    }

    console.log(`GET /player-balance userId=${userId} → $${balance} name="${displayName}"`);
    return c.json({ balance, displayName });
  } catch (err) {
    console.log("Error in GET /player-balance:", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.put(`${PREFIX}/player-balance`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const { balance } = await c.req.json();
    if (typeof balance !== "number") return c.json({ error: "balance must be a number" }, 400);

    await writeBalance(userId, balance);
    console.log(`PUT /player-balance userId=${userId} → $${balance}`);
    return c.json({ balance });
  } catch (err) {
    console.log("Error in PUT /player-balance:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// MAIZE BANK
// ═════════════════════════════════════════════════════════════════════════════

app.get(`${PREFIX}/maize-bank`, async (c) => {
  try {
    const balance = await readBank();
    console.log(`GET /maize-bank → $${balance}`);
    return c.json({ balance });
  } catch (err) {
    console.log("Error in GET /maize-bank:", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.put(`${PREFIX}/maize-bank`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const { balance } = await c.req.json();
    if (typeof balance !== "number") return c.json({ error: "balance must be a number" }, 400);

    await writeBank(balance);
    console.log(`PUT /maize-bank userId=${userId} → $${balance}`);
    return c.json({ balance });
  } catch (err) {
    console.log("Error in PUT /maize-bank:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GAME RESULTS — GET/PUT (for bet resolution)
// Format: { "Away vs Home": { winner, total, spreadWinners } }
// PUT requires auth (MVP: any authenticated user can update)
// ══════════════════════════════════════════════════════════════════════════════

app.get(`${PREFIX}/game-results`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const results = await readGameResults();
    console.log(`GET /game-results userId=${userId} → ${Object.keys(results).length} games`);
    return c.json(results);
  } catch (err) {
    console.log("Error in GET /game-results:", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.put(`${PREFIX}/game-results`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const body = await c.req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return c.json({ error: "Body must be an object mapping game keys to results" }, 400);
    }

    const current = await readGameResults();
    for (const [gameKey, result] of Object.entries(body)) {
      const r = result as any;
      if (r && typeof r === "object" && typeof r.winner === "string" && typeof r.total === "number" && Array.isArray(r.spreadWinners)) {
        current[String(gameKey).trim()] = {
          winner: String(r.winner).trim(),
          total: Number(r.total),
          spreadWinners: (r.spreadWinners as any[]).map((s: any) => String(s).trim()).filter(Boolean),
        };
      }
    }
    await writeGameResults(current);
    console.log(`PUT /game-results userId=${userId}: ${Object.keys(current).length} games`);
    return c.json(current);
  } catch (err) {
    console.log("Error in PUT /game-results:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// FUTURES CHAMPION — GET/PUT (for championship winner bet resolution)
// ══════════════════════════════════════════════════════════════════════════════

app.get(`${PREFIX}/futures/champion`, async (c) => {
  try {
    const champion = await readFuturesChampion();
    return c.json({ champion });
  } catch (err) {
    console.log("Error in GET /futures/champion:", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.put(`${PREFIX}/futures/champion`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const { champion } = await c.req.json();
    const team = typeof champion === "string" ? champion.trim() : "";
    if (!team) return c.json({ error: "Champion team name is required" }, 400);

    await writeFuturesChampion(team);
    console.log(`PUT /futures/champion userId=${userId} → "${team}"`);
    return c.json({ champion: team });
  } catch (err) {
    console.log("Error in PUT /futures/champion:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD — GET /leaderboard
// Returns all registered players with live balances, sorted by balance desc.
// Marks the requesting user's row with isCurrentUser: true.
// ══════════════════════════════════════════════════════════════════════════════

app.get(`${PREFIX}/leaderboard`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const registry = await readRegistry();
    const entries = Object.entries(registry);

    if (entries.length === 0) {
      return c.json([]);
    }

    // Fetch all balances in parallel
    const players = await Promise.all(
      entries.map(async ([uid, profile]) => ({
        userId:        uid,
        displayName:   profile.displayName,
        balance:       await readBalance(uid),
        joinedAt:      profile.joinedAt,
        isCurrentUser: uid === userId,
      }))
    );

    // Sort by balance descending, then by joinedAt ascending (earliest first as tiebreak)
    players.sort((a, b) => b.balance - a.balance || a.joinedAt - b.joinedAt);

    console.log(`GET /leaderboard: ${players.length} players, requested by userId=${userId}`);
    return c.json(players);

  } catch (err) {
    console.log("Error in GET /leaderboard:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PLAYER PROFILE — GET/PUT display name  (auth required)
// ══════════════════════════════════════════════════════════════════════════════

app.get(`${PREFIX}/player-profile`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const displayName = await readDisplayName(userId);
    return c.json({ displayName });
  } catch (err) {
    console.log("Error in GET /player-profile:", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.put(`${PREFIX}/player-profile`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const { displayName } = await c.req.json();
    const trimmed = typeof displayName === "string" ? displayName.trim() : "";
    if (!trimmed)            return c.json({ error: "Display name is required" }, 400);
    if (trimmed.length < 2)  return c.json({ error: "Display name must be at least 2 characters" }, 400);
    if (trimmed.length > 20) return c.json({ error: "Display name must be 20 characters or fewer" }, 400);

    await writeDisplayName(userId, trimmed);
    await addToRegistry(userId, trimmed);
    console.log(`PUT /player-profile userId=${userId} displayName="${trimmed}"`);
    return c.json({ displayName: trimmed });
  } catch (err) {
    console.log("Error in PUT /player-profile:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /bets — return all bets for the authenticated user
// ══════════════════════════════════════════════════════════════════════════════

app.get(`${PREFIX}/bets`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const [straightRaw, parlayRaw, futureRaw] = await Promise.all([
      kv.getByPrefix(keys.betPfx(userId)),
      kv.getByPrefix(keys.parlayPfx(userId)),
      kv.getByPrefix(keys.futurePfx(userId)),
    ]);

    const all = [
      ...(straightRaw as any[]).filter(Boolean),
      ...(parlayRaw  as any[]).filter(Boolean),
      ...(futureRaw  as any[]).filter(Boolean),
    ].sort((a, b) => (b.placedAt ?? 0) - (a.placedAt ?? 0));

    console.log(`GET /bets userId=${userId}: ${all.length} total`);
    return c.json(all);
  } catch (err) {
    console.log("Error in GET /bets:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /bets — place a new bet
//
// Server-side validation order (all run before any DB write):
//   1. Auth  — valid user session required (requireAuth)
//   2. Shape — bet structure + leg fields + combinedOdds (validateBet)
//   3. Balance — query player balance; reject if wager > balance
//
// On success:
//   • Subtracts wager from player balance  (KV write)
//   • Inserts bet record with status = "pending"  (KV write)
//   • Returns { dbId, dbType, newBalance }
// ══════════════════════════════════════════════════════════════════════════════

app.post(`${PREFIX}/bets`, async (c) => {
  try {
    // ── 1. Auth ────────────────────────────────────────────────────────────
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const bet = await c.req.json();

    // ── 2. Validate bet shape ──────────────────────────────────────────────
    const validationError = validateBet(bet);
    if (validationError) {
      console.log(`POST /bets validation error userId=${userId}:`, validationError.message);
      return c.json({
        error: validationError.message,
        field: validationError.field,
        code: "VALIDATION_ERROR",
      }, 422);
    }

    const stake = bet.stake as number;

    // ── 3. Balance check — query server-side balance, reject if insufficient
    const currentBalance = await readBalance(userId);
    if (stake > currentBalance) {
      const msg = "Insufficient balance to place this bet.";
      console.log(
        `POST /bets insufficient balance userId=${userId}: ` +
        `stake=$${stake} balance=$${currentBalance.toFixed(2)}`
      );
      return c.json({ error: msg, code: "INSUFFICIENT_BALANCE", currentBalance }, 422);
    }

    // ── 4. Deduct wager from player balance ────────────────────────────────
    const newBalance = currentBalance - stake;
    await writeBalance(userId, newBalance);

    // ── 5. Insert bet record with status = "pending" ───────────────────────
    const uid = newUid();
    let kvKey: string;
    let dbType: "bet" | "parlay" | "futures";

    if (bet.type === "Parlay") {
      kvKey  = keys.parlay(userId, uid);
      dbType = "parlay";
    } else if (bet.type === "Futures") {
      kvKey  = keys.future(userId, uid);
      dbType = "futures";
    } else {
      kvKey  = keys.bet(userId, uid);
      dbType = "bet";
    }

    const payout = calcExpectedPayout(stake, bet.combinedOdds);

    const record = {
      ...bet,
      status:  "pending",
      _kvKey:  kvKey,
      _dbId:   uid,
      _dbType: dbType,
      userId,
      payout,
    };

    await kv.set(kvKey, record);

    console.log(
      `POST /bets OK: userId=${userId} type=${dbType} stake=$${stake} ` +
      `newBalance=$${newBalance} key=${kvKey}`
    );

    return c.json({ dbId: uid, dbType, newBalance });

  } catch (err) {
    console.log("Error in POST /bets:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /bets/:id — resolve a bet (won or lost)
//
// On win:  player_balances += payout  (return winnings to player)
// On loss: maize_bank += wager        (lost wager goes to Group Bank)
//
// The wager amount is read from the stored KV record (not trusted from client).
// Returns { ok, newBalance, newBank }
// ══════════════════════════════════════════════════════════════════════════════

app.put(`${PREFIX}/bets/:id`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const body = await c.req.json();
    const { dbId, dbType, status, payout: clientPayout } = body;

    if (!dbId || !dbType || !status) {
      return c.json({ error: "dbId, dbType, and status are required" }, 400);
    }
    if (status !== "won" && status !== "lost") {
      return c.json({ error: `Invalid status "${status}" — must be "won" or "lost"` }, 400);
    }

    // ── Resolve the KV key ─────────────────────────────────────────────────
    let kvKey: string;
    if (dbType === "parlay")       kvKey = keys.parlay(userId, dbId);
    else if (dbType === "futures") kvKey = keys.future(userId, dbId);
    else                           kvKey = keys.bet(userId, dbId);

    // ── Read stored record (stake is authoritative from storage) ───────────
    const existing = await kv.get(kvKey) as any;
    if (!existing) {
      console.log(`PUT /bets/${dbId}: record not found at ${kvKey}`);
      return c.json({ error: "Bet record not found" }, 404);
    }

    // Prevent double-resolution
    if (existing.status !== "pending") {
      console.log(`PUT /bets/${dbId}: already resolved (${existing.status}), skipping`);
      const balance = await readBalance(userId);
      const bank    = await readBank();
      return c.json({ ok: true, alreadyResolved: true, newBalance: balance, newBank: bank });
    }

    const stake = typeof existing.stake === "number" ? existing.stake : 0;

    // ── Apply balance / bank changes ───────────────────────────────────────
    let newBalance: number;
    let newBank: number;

    if (status === "won") {
      // Winning bet: payout comes FROM Maize Bank TO player
      const winPayout = typeof existing.payout === "number" && existing.payout > 0
        ? existing.payout
        : (typeof clientPayout === "number" && clientPayout > 0 ? clientPayout : stake);

      const currentBalance = await readBalance(userId);
      const currentBank = await readBank();
      newBalance = currentBalance + winPayout;
      newBank = Math.round((currentBank - winPayout) * 100) / 100;
      await writeBalance(userId, newBalance);
      await writeBank(newBank);

      if (currentBank < winPayout) {
        console.warn(
          `PUT /bets/${dbId} WON: Maize Bank was $${currentBank} before payout $${winPayout} — allowed negative for MVP`
        );
      }

      console.log(
        `PUT /bets/${dbId} WON: userId=${userId} payout=$${winPayout} ` +
        `newBalance=$${newBalance} newBank=$${newBank}`
      );

    } else {
      // Lost bet: stake goes to the MaizeBank (Group Bank)
      const currentBank = await readBank();
      newBank    = currentBank + stake;
      await writeBank(newBank);
      newBalance = await readBalance(userId);

      console.log(
        `PUT /bets/${dbId} LOST: userId=${userId} stake=$${stake} ` +
        `newBank=$${newBank}`
      );
    }

    // ── Update stored bet record ───────────────────────────────────────────
    const resolvedAt = Date.now();
    const resolvedPayout = status === "won"
      ? (typeof existing.payout === "number" && existing.payout > 0 ? existing.payout : clientPayout ?? 0)
      : 0;

    await kv.set(kvKey, {
      ...existing,
      status,
      payout:     resolvedPayout,
      resolvedAt,
    });

    return c.json({ ok: true, newBalance, newBank });

  } catch (err) {
    console.log("Error in PUT /bets/:id:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /bets/resolve-batch — resolve multiple bets in one call
//
// Body: [{ dbId, dbType, status, payout }]
// Processes sequentially to avoid KV race conditions.
// Returns { ok, newBalance, newBank, resolved: number }
// ══════════════════════════════════════════════════════════════════════════════

app.post(`${PREFIX}/bets/resolve-batch`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const items = await c.req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ error: "Body must be a non-empty array of bet resolutions" }, 400);
    }

    let resolved = 0;
    const errors: string[] = [];

    // Process sequentially to avoid concurrent read-modify-write conflicts
    for (const item of items) {
      const { dbId, dbType, status, payout: clientPayout } = item;

      try {
        if (!dbId || !dbType || !status) continue;
        if (status !== "won" && status !== "lost") continue;

        let kvKey: string;
        if (dbType === "parlay")       kvKey = keys.parlay(userId, dbId);
        else if (dbType === "futures") kvKey = keys.future(userId, dbId);
        else                           kvKey = keys.bet(userId, dbId);

        const existing = await kv.get(kvKey) as any;
        if (!existing || existing.status !== "pending") continue;

        const stake = typeof existing.stake === "number" ? existing.stake : 0;

        if (status === "won") {
          const winPayout = typeof existing.payout === "number" && existing.payout > 0
            ? existing.payout
            : (typeof clientPayout === "number" && clientPayout > 0 ? clientPayout : stake);

          const curBal = await readBalance(userId);
          const curBank = await readBank();
          await writeBalance(userId, curBal + winPayout);
          await writeBank(Math.round((curBank - winPayout) * 100) / 100);

          console.log(`batch-resolve WON dbId=${dbId} userId=${userId} payout=$${winPayout}`);

        } else {
          const cur = await readBank();
          await writeBank(cur + stake);

          console.log(`batch-resolve LOST dbId=${dbId} userId=${userId} stake=$${stake}`);
        }

        // Mark bet as resolved
        const resolvedPayout = status === "won"
          ? (typeof existing.payout === "number" && existing.payout > 0 ? existing.payout : clientPayout ?? 0)
          : 0;

        await kv.set(kvKey, {
          ...existing,
          status,
          payout:     resolvedPayout,
          resolvedAt: Date.now(),
        });

        resolved++;

      } catch (itemErr) {
        const msg = `Failed to resolve dbId=${dbId}: ${itemErr}`;
        console.log(msg);
        errors.push(msg);
      }
    }

    const newBalance = await readBalance(userId);
    const newBank    = await readBank();

    console.log(
      `batch-resolve complete userId=${userId}: ${resolved} resolved, ` +
      `newBalance=$${newBalance}, newBank=$${newBank}`
    );

    return c.json({ ok: true, resolved, errors, newBalance, newBank });

  } catch (err) {
    console.log("Error in POST /bets/resolve-batch:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /bets/resolve-all
//
// Admin-level endpoint: resolves pending bets for ALL registered users using
// the game results already stored in KV. Called from the admin page after
// game results are entered manually.
// ══════════════════════════════════════════════════════════════════════════════

app.post(`${PREFIX}/bets/resolve-all`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    const gameResults = await readGameResults();
    const champion    = await readFuturesChampion();

    if (Object.keys(gameResults).length === 0 && !champion) {
      return c.json({ ok: true, resolved: 0, users: 0, message: "No game results stored yet" });
    }

    const registry = await readRegistry();
    const userIds  = Object.keys(registry);
    let totalResolved = 0;
    const errors: string[] = [];

    for (const uid of userIds) {
      const [straightRaw, parlayRaw, futureRaw] = await Promise.all([
        kv.getByPrefix(keys.betPfx(uid)),
        kv.getByPrefix(keys.parlayPfx(uid)),
        kv.getByPrefix(keys.futurePfx(uid)),
      ]);

      const pendingBets = [
        ...(straightRaw as any[]),
        ...(parlayRaw   as any[]),
        ...(futureRaw   as any[]),
      ].filter(b => b?.status === "pending");

      for (const bet of pendingBets) {
        const outcome = resolveServerBet(bet, gameResults, champion);
        if (outcome === "pending") continue;

        const kvKey = (bet as any)._kvKey as string | undefined;
        if (!kvKey) continue;

        try {
          const existing = await kv.get(kvKey) as any;
          if (!existing || existing.status !== "pending") continue;

          const stake = typeof existing.stake === "number" ? existing.stake : 0;

          if (outcome === "won") {
            const winPayout = typeof existing.payout === "number" && existing.payout > 0
              ? existing.payout : stake;
            const [curBal, curBank] = await Promise.all([readBalance(uid), readBank()]);
            await writeBalance(uid, curBal + winPayout);
            await writeBank(Math.round((curBank - winPayout) * 100) / 100);
            await kv.set(kvKey, { ...existing, status: "won", payout: winPayout, resolvedAt: Date.now() });
            console.log(`resolve-all WON uid=${uid} payout=$${winPayout}`);
          } else {
            const curBank = await readBank();
            await writeBank(curBank + stake);
            await kv.set(kvKey, { ...existing, status: "lost", payout: 0, resolvedAt: Date.now() });
            console.log(`resolve-all LOST uid=${uid} stake=$${stake}`);
          }
          totalResolved++;
        } catch (itemErr) {
          errors.push(`${uid}/${kvKey}: ${itemErr}`);
        }
      }
    }

    const newBank = await readBank();
    console.log(`resolve-all: ${totalResolved} bets resolved across ${userIds.length} users, bank=$${newBank}`);
    return c.json({ ok: true, resolved: totalResolved, users: userIds.length, newBank, errors });

  } catch (err) {
    console.log("Error in POST /bets/resolve-all:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /bets/auto-resolve
//
// Fetches completed NCAAB games from ESPN, populates the game-results KV store,
// and resolves all pending bets for the requesting user automatically.
// Called on app load whenever the user has pending bets.
// ══════════════════════════════════════════════════════════════════════════════

app.post(`${PREFIX}/bets/auto-resolve`, async (c) => {
  try {
    const userId = await requireAuth(c);
    if (typeof userId !== "string") return userId;

    // 1. Fetch ESPN completed games (today + 2 prior days)
    const espnGames  = await fetchESPNResults();
    const gamesFound = Object.keys(espnGames).length;

    if (gamesFound === 0) {
      console.log(`auto-resolve userId=${userId}: no ESPN games found`);
      return c.json({ ok: true, resolved: 0, gamesFound: 0 });
    }

    // 2. Load all pending bets for this user
    const [straightRaw, parlayRaw, futureRaw] = await Promise.all([
      kv.getByPrefix(keys.betPfx(userId)),
      kv.getByPrefix(keys.parlayPfx(userId)),
      kv.getByPrefix(keys.futurePfx(userId)),
    ]);

    const pendingBets = [
      ...(straightRaw as any[]),
      ...(parlayRaw   as any[]),
      ...(futureRaw   as any[]),
    ].filter(b => b?.status === "pending");

    if (pendingBets.length === 0) {
      console.log(`auto-resolve userId=${userId}: no pending bets`);
      return c.json({ ok: true, resolved: 0, gamesFound });
    }

    // 3. Build / update GameResultsMap from ESPN data
    //    Only writes new game keys — never overwrites existing results.
    const gameResults = await readGameResults();
    const champion    = await readFuturesChampion();

    for (const [gameKey, espn] of Object.entries(espnGames)) {
      if (gameResults[gameKey]) continue; // already stored

      const { winner, homeScore, awayScore, homeTeam } = espn;
      const total = homeScore + awayScore;

      // Determine spread winners from pending spread legs for this game
      const spreadWinners: string[] = [];
      const seenTeams = new Set<string>();

      for (const bet of pendingBets) {
        for (const leg of (bet.legs as any[]) ?? []) {
          if (leg.type !== "Spread" || leg.game !== gameKey) continue;
          const team = leg.team as string;
          if (!team || seenTeams.has(team)) continue;
          seenTeams.add(team);

          const pts = parseSpreadPoints((leg.selection ?? leg.label ?? "") as string, team);
          if (pts === null) continue;
          if (coveredSpread(team, pts, homeTeam, homeScore, awayScore)) {
            spreadWinners.push(team);
          }
        }
      }

      gameResults[gameKey] = { winner, total, spreadWinners };
      console.log(`auto-resolve: stored result for "${gameKey}" → winner=${winner} total=${total} spreadWinners=[${spreadWinners}]`);
    }

    await writeGameResults(gameResults);

    // 4. Resolve each pending bet sequentially (avoids KV race conditions)
    let resolved = 0;
    const errors: string[] = [];

    for (const bet of pendingBets) {
      const outcome = resolveServerBet(bet, gameResults, champion);
      if (outcome === "pending") continue;

      const kvKey = (bet as any)._kvKey as string | undefined;
      if (!kvKey) continue;

      try {
        const existing = await kv.get(kvKey) as any;
        if (!existing || existing.status !== "pending") continue;

        const stake = typeof existing.stake === "number" ? existing.stake : 0;

        if (outcome === "won") {
          const winPayout = typeof existing.payout === "number" && existing.payout > 0
            ? existing.payout : stake;
          const [curBal, curBank] = await Promise.all([readBalance(userId), readBank()]);
          await writeBalance(userId, curBal + winPayout);
          await writeBank(Math.round((curBank - winPayout) * 100) / 100);
          await kv.set(kvKey, { ...existing, status: "won", payout: winPayout, resolvedAt: Date.now() });
          console.log(`auto-resolve WON userId=${userId} payout=$${winPayout} key=${kvKey}`);

        } else {
          const curBank = await readBank();
          await writeBank(curBank + stake);
          await kv.set(kvKey, { ...existing, status: "lost", payout: 0, resolvedAt: Date.now() });
          console.log(`auto-resolve LOST userId=${userId} stake=$${stake} key=${kvKey}`);
        }

        resolved++;
      } catch (itemErr) {
        const msg = `Failed ${kvKey}: ${itemErr}`;
        console.log(`auto-resolve error: ${msg}`);
        errors.push(msg);
      }
    }

    const newBalance = await readBalance(userId);
    const newBank    = await readBank();

    console.log(
      `auto-resolve userId=${userId}: ${resolved}/${pendingBets.length} resolved — ` +
      `balance=$${newBalance} bank=$${newBank}`
    );

    return c.json({ ok: true, resolved, gamesFound, errors, newBalance, newBank });

  } catch (err) {
    console.log("Error in POST /bets/auto-resolve:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// NCAAB ODDS  (public)
// ══════════════════════════════════════════════════════════════════════════════

app.get(`${PREFIX}/ncaab-odds`, async (c) => {
  try {
    const apiKey = Deno.env.get("ODDS_API_KEY");
    if (!apiKey) return c.json([]);

    const url = new URL("https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds");
    url.searchParams.set("apiKey",     apiKey);
    url.searchParams.set("regions",    "us");
    url.searchParams.set("markets",    "h2h,spreads,totals");
    url.searchParams.set("oddsFormat", "american");

    const res = await fetch(url.toString());
    if (!res.ok) return c.json([]);

    const raw: any[] = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) return c.json([]);

    // Filter to only NCAA Tournament games (groups=100 via ESPN)
    const tournamentTeams = await fetchTournamentTeams();
    const tournamentOnly = tournamentTeams.size > 0
      ? raw.filter((event: any) =>
          isInTournament(event.home_team ?? '', tournamentTeams) &&
          isInTournament(event.away_team ?? '', tournamentTeams)
        )
      : raw; // fallback: show all if ESPN returned nothing

    const games = tournamentOnly.map((event: any) => {
      const bookmaker =
        event.bookmakers?.find((b: any) =>
          b.markets?.some((m: any) => m.key === "h2h" || m.key === "spreads")
        ) ?? event.bookmakers?.[0];

      const h2h    = bookmaker?.markets?.find((m: any) => m.key === "h2h");
      const spread = bookmaker?.markets?.find((m: any) => m.key === "spreads");
      const totals = bookmaker?.markets?.find((m: any) => m.key === "totals");
      const lines: any[] = [];

      for (const o of h2h?.outcomes ?? []) {
        lines.push({
          id: `${event.id}-ml-${slugify(o.name)}`, type: "Moneyline", team: o.name,
          odds: formatAmerican(o.price), label: `${o.name} ${formatAmerican(o.price)}`,
          game: `${event.away_team} vs ${event.home_team}`,
        });
      }
      for (const o of spread?.outcomes ?? []) {
        const pts = o.point ?? 0;
        const sign = pts > 0 ? `+${pts}` : `${pts}`;
        lines.push({
          id: `${event.id}-sp-${slugify(o.name)}`, type: "Spread", team: o.name,
          odds: formatAmerican(o.price),
          label: `${o.name} ${sign} (${formatAmerican(o.price)})`,
          game: `${event.away_team} vs ${event.home_team}`,
        });
      }
      for (const o of totals?.outcomes ?? []) {
        const pt = o.point ?? 0;
        const label = `${o.name} ${pt} (${formatAmerican(o.price)})`;
        lines.push({
          id: `${event.id}-ou-${slugify(o.name)}-${pt}`, type: "Over/Under", team: o.name,
          odds: formatAmerican(o.price), label,
          game: `${event.away_team} vs ${event.home_team}`,
        });
      }

      return {
        id:   event.id,
        home: event.home_team,
        away: event.away_team,
        time: formatGameTime(new Date(event.commence_time)),
        lines,
      };
    });

    console.log(`ncaab-odds: ${games.length} tournament games (from ${raw.length} total)`);
    return c.json(games);
  } catch (err) {
    console.log("Error in GET /ncaab-odds:", err);
    return c.json([]);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// NCAAB FUTURES  (public)
// ══════════════════════════════════════════════════════════════════════════════

app.get(`${PREFIX}/ncaab-futures`, async (c) => {
  try {
    const apiKey = Deno.env.get("ODDS_API_KEY");
    if (!apiKey) return c.json({ teams: [] });

    const url = new URL(
      "https://api.the-odds-api.com/v4/sports/basketball_ncaab_championship_winner/odds"
    );
    url.searchParams.set("apiKey",     apiKey);
    url.searchParams.set("regions",    "us");
    url.searchParams.set("markets",    "h2h");
    url.searchParams.set("oddsFormat", "american");

    const res = await fetch(url.toString());
    if (!res.ok) return c.json({ teams: [] });

    const raw: any[] = await res.json();
    const teams: { name: string; odds: string }[] = [];
    const seen = new Set<string>();

    for (const event of raw) {
      const bm = event.bookmakers?.find((b: any) =>
        b.markets?.some((m: any) => m.key === "h2h")
      ) ?? event.bookmakers?.[0];
      const market = bm?.markets?.find((m: any) => m.key === "h2h");
      for (const o of market?.outcomes ?? []) {
        if (seen.has(o.name)) continue;
        seen.add(o.name);
        teams.push({ name: o.name, odds: formatAmerican(o.price) });
      }
    }

    teams.sort((a, b) =>
      parseInt(a.odds.replace("+", "")) - parseInt(b.odds.replace("+", ""))
    );

    console.log(`ncaab-futures: ${teams.length} teams`);
    return c.json({ teams });
  } catch (err) {
    console.log("Error in GET /ncaab-futures:", err);
    return c.json({ teams: [] });
  }
});

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Convert American odds string to decimal multiplier */
function americanToDecimal(odds: string): number {
  const n = parseInt(odds);
  if (isNaN(n)) return 1;
  if (n > 0) return 1 + n / 100;
  return 1 + 100 / Math.abs(n);
}

/** Calculate expected payout from stake and combined odds string */
function calcExpectedPayout(stake: number, combinedOdds: string): number {
  return Math.round(stake * americanToDecimal(combinedOdds) * 100) / 100;
}

function formatAmerican(price: number): string {
  return price >= 0 ? `+${Math.round(price)}` : `${Math.round(price)}`;
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

function formatGameTime(d: Date): string {
  const now      = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const days     = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  const ts   = `${h12}${m === 0 ? "" : `:${String(m).padStart(2,"0")}`} ${ampm} ET`;
  if (diffDays === 0) return `Today · ${ts}`;
  if (diffDays === 1) return `Tomorrow · ${ts}`;
  if (diffDays < 7)  return `${days[d.getDay()]} · ${ts}`;
  return `${months[d.getMonth()]} ${d.getDate()} · ${ts}`;
}

// Handle OPTIONS (CORS preflight) at the top — before Hono — so preflight always succeeds
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  "Access-Control-Max-Age": "600",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }
  const res = await app.fetch(req);
  // Ensure CORS headers on all responses
  const headers = new Headers(res.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  return new Response(res.body, { status: res.status, headers });
});