import { ACCOUNTS_TABLE, PROFILES_TABLE, TRADES_TABLE, dbEnabled, supabase } from "./supabase";

const ACCOUNTS_KEY = "tj-accounts-v1";

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const tradesKey = (email) => `tj-trades-${email}`;
const profileKey = (email) => `tj-profile-${email}`;

const normalizeAccount = (row) => ({
  email: String(row.email || "").toLowerCase(),
  password: row.password || "",
  name: row.name || "Trader",
});

const normalizeTradeRow = (row) => ({
  id: row.id,
  date: row.date,
  symbol: row.symbol,
  strike: Number(row.strike || 0),
  optionType: row.option_type || "CE",
  side: row.side || "Long",
  quantity: Number(row.quantity || 1),
  entry: Number(row.entry || 0),
  exit: Number(row.exit || 0),
  stopLoss: Number(row.stop_loss || 0),
  fees: Number(row.fees || 0),
  notes: row.notes || "",
  createdAt: Number(row.created_at || Date.now()),
});

const tradeToRow = (email, trade) => ({
  id: trade.id,
  email,
  date: trade.date,
  symbol: trade.symbol,
  strike: Number(trade.strike || 0),
  option_type: trade.optionType || "CE",
  side: trade.side || "Long",
  quantity: Number(trade.quantity || 1),
  entry: Number(trade.entry || 0),
  exit: Number(trade.exit || 0),
  stop_loss: Number(trade.stopLoss || 0),
  fees: Number(trade.fees || 0),
  notes: trade.notes || "",
  created_at: Number(trade.createdAt || Date.now()),
});

export function getLocalAccounts() {
  return Array.isArray(readJSON(ACCOUNTS_KEY, [])) ? readJSON(ACCOUNTS_KEY, []) : [];
}

export function setLocalAccounts(accounts) {
  writeJSON(ACCOUNTS_KEY, accounts);
}

export function getLocalProfile(email) {
  if (!email) return null;
  return readJSON(profileKey(email), null);
}

export function setLocalProfile(email, profile) {
  if (!email) return;
  writeJSON(profileKey(email), profile);
}

export function getLocalTrades(email) {
  if (!email) return [];
  const v = readJSON(tradesKey(email), []);
  return Array.isArray(v) ? v : [];
}

export function setLocalTrades(email, trades) {
  if (!email) return;
  writeJSON(tradesKey(email), trades);
}

export async function loadAccounts() {
  if (!dbEnabled || !supabase) return getLocalAccounts();

  const { data, error } = await supabase
    .from(ACCOUNTS_TABLE)
    .select("email,password,name")
    .order("email", { ascending: true });

  if (error) return getLocalAccounts();
  const normalized = (data || []).map(normalizeAccount);
  setLocalAccounts(normalized);
  return normalized;
}

export async function saveAccount(account) {
  const merged = [...getLocalAccounts().filter((a) => a.email !== account.email), account];
  setLocalAccounts(merged);

  if (!dbEnabled || !supabase) return;

  await supabase.from(ACCOUNTS_TABLE).upsert(
    {
      email: account.email,
      password: account.password,
      name: account.name || "Trader",
    },
    { onConflict: "email" }
  );
}

export async function loadProfile(email) {
  if (!email) return null;
  if (!dbEnabled || !supabase) return getLocalProfile(email);

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select("display_name,initial_capital,daily_max_loss,max_trades_per_day,monthly_target,lot_sizes")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return getLocalProfile(email);

  const profile = {
    displayName: data.display_name || "Trader",
    initialCapital: Number(data.initial_capital || 0),
    dailyMaxLoss: Number(data.daily_max_loss || 5000),
    maxTradesPerDay: Number(data.max_trades_per_day || 5),
    monthlyTarget: Number(data.monthly_target || 10000),
    lotSizes: data.lot_sizes || {},
  };

  setLocalProfile(email, profile);
  return profile;
}

export async function saveProfile(email, profile) {
  setLocalProfile(email, profile);
  if (!dbEnabled || !supabase || !email) return;

  await supabase.from(PROFILES_TABLE).upsert(
    {
      email,
      display_name: profile.displayName || "Trader",
      initial_capital: Number(profile.initialCapital || 0),
      daily_max_loss: Number(profile.dailyMaxLoss || 5000),
      max_trades_per_day: Number(profile.maxTradesPerDay || 5),
      monthly_target: Number(profile.monthlyTarget || 10000),
      lot_sizes: profile.lotSizes || {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );
}

export async function loadTrades(email) {
  if (!email) return [];

  const localTrades = getLocalTrades(email);
  if (!dbEnabled || !supabase) return localTrades;

  const { data, error } = await supabase
    .from(TRADES_TABLE)
    .select("id,date,symbol,strike,option_type,side,quantity,entry,exit,stop_loss,fees,notes,created_at")
    .eq("email", email)
    .order("date", { ascending: false });

  if (error) return localTrades;

  const remoteTrades = (data || []).map(normalizeTradeRow);

  // Prevent wiping browser data if remote is empty due policy/misconfig.
  if (!remoteTrades.length && localTrades.length) {
    return localTrades;
  }

  setLocalTrades(email, remoteTrades);
  return remoteTrades;
}

export async function saveTrades(email, trades) {
  setLocalTrades(email, trades);
  if (!dbEnabled || !supabase || !email) return;

  const rows = trades.map((t) => tradeToRow(email, t));

  if (rows.length) {
    const { error: upsertError } = await supabase
      .from(TRADES_TABLE)
      .upsert(rows, { onConflict: "id" });

    if (upsertError) {
      console.warn("Failed to upsert trades, using local storage fallback.", upsertError.message);
      return;
    }
  }

  const { data: existingRows, error: existingError } = await supabase
    .from(TRADES_TABLE)
    .select("id")
    .eq("email", email);

  if (existingError) return;

  const keepIds = new Set(rows.map((r) => r.id));
  const staleIds = (existingRows || []).map((r) => r.id).filter((id) => !keepIds.has(id));

  if (staleIds.length) {
    await supabase.from(TRADES_TABLE).delete().in("id", staleIds);
  }
}
