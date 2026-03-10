import React, { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, PlusCircle, History, FileText, Settings, LogOut, Upload, Download, Printer, Calendar, Target, IndianRupee, ShieldAlert, ShieldCheck, User, Mail, Search, RefreshCcw, Trash2, Pencil, TrendingUp, Eye, EyeOff, Wallet } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from "recharts";
import { getLocalAccounts, getLocalProfile, getLocalTrades, loadAccounts, loadProfile, loadTrades, saveAccount, saveProfile, saveTrades } from "./lib/dataStore";

const SESSION_KEY = "tj-session-v1";
const DEFAULT_LOT_SIZES = { NIFTY: 60, BANKNIFTY: 15, SENSEX: 10, DEFAULT: 1 };
const ICON_MAP = { dashboard: LayoutDashboard, plus: PlusCircle, history: History, file: FileText, settings: Settings, logout: LogOut, upload: Upload, download: Download, printer: Printer, calendar: Calendar, target: Target, money: IndianRupee, alert: ShieldAlert, shield: ShieldCheck, user: User, mail: Mail, search: Search, refresh: RefreshCcw, trash: Trash2, edit: Pencil, chart: TrendingUp, eye: Eye, eyeOff: EyeOff, wallet: Wallet };

function Icon({ name, className = "icon" }) {
  const Comp = ICON_MAP[name] || FileText;
  return <Comp className={className} aria-hidden="true" />;
}

const normalizeSymbol = (v) => String(v || "").trim().toUpperCase();
const currency = (v) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);
const number = (v, d = 2) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: d }).format(v || 0);
const signedNumber = (v, d = 2, suffix = "") => {
  const n = Number(v || 0);
  if (n > 0) return `+${number(n, d)}${suffix}`;
  if (n < 0) return `${number(n, d)}${suffix}`;
  return `0${suffix}`;
};
const sanitizeLotSizes = (obj = {}) => ({
  NIFTY: Math.max(1, Number(obj.NIFTY) || DEFAULT_LOT_SIZES.NIFTY),
  BANKNIFTY: Math.max(1, Number(obj.BANKNIFTY) || DEFAULT_LOT_SIZES.BANKNIFTY),
  SENSEX: Math.max(1, Number(obj.SENSEX) || DEFAULT_LOT_SIZES.SENSEX),
  DEFAULT: Math.max(1, Number(obj.DEFAULT) || DEFAULT_LOT_SIZES.DEFAULT),
});
const sanitizeWithdrawals = (items = []) => (Array.isArray(items) ? items : []).map((item) => ({ id: item.id || `WD-${String(Date.now()).slice(-5)}${Math.floor(Math.random() * 900 + 100)}`, date: item.date || new Date().toISOString().slice(0, 10), amount: Math.max(0, Number(item.amount) || 0), note: String(item.note || "").trim(), createdAt: Number(item.createdAt || Date.now()) })).filter((item) => item.amount > 0).sort((a, b) => { const dateDiff = new Date(b.date) - new Date(a.date); return dateDiff || Number(b.createdAt || 0) - Number(a.createdAt || 0); });
const createProfileDraft = (profile = {}) => ({ displayName: profile.displayName || "Trader", initialCapital: profile.initialCapital || "", dailyMaxLoss: profile.dailyMaxLoss || 5000, maxTradesPerDay: profile.maxTradesPerDay || 5, monthlyTarget: Number(profile.monthlyTarget || 10000), withdrawals: sanitizeWithdrawals(profile.withdrawals), lotSizes: sanitizeLotSizes(profile.lotSizes) });

function normalizeTrade(raw, lotSizes) {
  const symbol = normalizeSymbol(raw.symbol);
  const lotSizeUsed = lotSizes[symbol] || lotSizes.DEFAULT || 1;
  const quantity = Number(raw.quantity || 1);
  const entry = Number(raw.entry || 0);
  const exit = Number(raw.exit || 0);
  const fees = Number(raw.fees || 0);
  const units = quantity * lotSizeUsed;
  const gross = raw.side === "Short" ? (entry - exit) * units : (exit - entry) * units;
  return { ...raw, id: raw.id || `TRD-${String(Date.now()).slice(-5)}${Math.floor(Math.random() * 900 + 100)}`, date: raw.date || new Date().toISOString().slice(0, 10), symbol, quantity, strike: Number(raw.strike || 0), stopLoss: Number(raw.stopLoss || 0), entry, exit, fees, lotSizeUsed, optionType: raw.optionType || "CE", side: raw.side || "Long", notes: raw.notes || "", pnl: gross - fees };
}

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((x) => x.trim().toLowerCase());
  const idx = (name) => headers.indexOf(name);
  const out = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(",").map((x) => x.trim());
    if (!cells.length || !cells[0]) continue;
    out.push({ date: cells[idx("date")] || new Date().toISOString().slice(0, 10), symbol: cells[idx("symbol")] || cells[idx("instrument")] || "", side: (cells[idx("side")] || "Long").toLowerCase().includes("short") ? "Short" : "Long", optionType: cells[idx("optiontype")] || "CE", quantity: Number(cells[idx("quantity")] || 1), entry: Number(cells[idx("entry")] || 0), exit: Number(cells[idx("exit")] || 0), fees: Number(cells[idx("fees")] || 0), strike: Number(cells[idx("strike")] || 0), stopLoss: Number(cells[idx("stoploss")] || 0), notes: cells[idx("notes")] || "", createdAt: Date.now() });
  }
  return out;
}

const fmtAxis = (v) => `INR ${number(v, 0)}`;
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const value = Number(payload[0].value || 0);
  return <div className="chart-tip-box"><strong>{label}</strong><div className={value >= 0 ? "up" : "down"}>{currency(value)}</div></div>;
}

export default function App() {
  const [accounts, setAccounts] = useState(() => getLocalAccounts());
  const [sessionEmail, setSessionEmail] = useState(() => localStorage.getItem(SESSION_KEY) || "");
  const [page, setPage] = useState("dashboard");
  const [authMode, setAuthMode] = useState("register");
  const [authData, setAuthData] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState("");
  const [instrumentFilter, setInstrumentFilter] = useState("all");
  const [settingsStatus, setSettingsStatus] = useState("");
  const [profileDraft, setProfileDraft] = useState(() => createProfileDraft({ displayName: "Trader", initialCapital: "", dailyMaxLoss: 5000, maxTradesPerDay: 5, monthlyTarget: 10000, withdrawals: [], lotSizes: sanitizeLotSizes(DEFAULT_LOT_SIZES) }));
  const [profile, setProfile] = useState(null);
  const [withdrawalForm, setWithdrawalForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", note: "" });
  const [tradeForm, setTradeForm] = useState({ date: new Date().toISOString().slice(0, 10), symbol: "NIFTY", strike: "", optionType: "CE", side: "Long", quantity: 1, entry: "", exit: "", stopLoss: 0, fees: 0, notes: "" });
  const [rawTrades, setRawTrades] = useState([]);

  useEffect(() => {
    let active = true;
    loadAccounts().then((rows) => { if (active) setAccounts(Array.isArray(rows) ? rows : []); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (sessionEmail) localStorage.setItem(SESSION_KEY, sessionEmail);
    else localStorage.removeItem(SESSION_KEY);
  }, [sessionEmail]);

  useEffect(() => {
    let active = true;
    if (!sessionEmail) {
      setRawTrades([]);
      setProfile(null);
      setProfileDraft(createProfileDraft({ lotSizes: sanitizeLotSizes(DEFAULT_LOT_SIZES), withdrawals: [] }));
      return () => { active = false; };
    }
    const localTrades = getLocalTrades(sessionEmail);
    setRawTrades(localTrades);
    const localProfile = getLocalProfile(sessionEmail);
    if (localProfile) {
      const normalizedLocalProfile = { ...localProfile, lotSizes: sanitizeLotSizes(localProfile.lotSizes), withdrawals: sanitizeWithdrawals(localProfile.withdrawals) };
      setProfile(normalizedLocalProfile);
      setProfileDraft(createProfileDraft(normalizedLocalProfile));
    }
    (async () => {
      const [remoteProfile, remoteTrades] = await Promise.all([loadProfile(sessionEmail), loadTrades(sessionEmail)]);
      if (!active) return;
      if (remoteProfile) {
        const normalizedRemoteProfile = { ...remoteProfile, lotSizes: sanitizeLotSizes(remoteProfile.lotSizes), withdrawals: sanitizeWithdrawals(remoteProfile.withdrawals) };
        setProfile(normalizedRemoteProfile);
        setProfileDraft(createProfileDraft(normalizedRemoteProfile));
      }
      if (Array.isArray(remoteTrades)) setRawTrades(remoteTrades);
    })();
    return () => { active = false; };
  }, [sessionEmail]);

  useEffect(() => {
    if (!sessionEmail) return;
    saveTrades(sessionEmail, rawTrades);
  }, [sessionEmail, rawTrades]);

  const hasProfile = !!profile && Number(profile.initialCapital) > 0;
  const lotSizes = sanitizeLotSizes(profile?.lotSizes || profileDraft.lotSizes);
  const withdrawals = sanitizeWithdrawals(profile?.withdrawals || profileDraft.withdrawals);
  const trades = useMemo(() => rawTrades.map((t) => normalizeTrade(t, lotSizes)).sort((a, b) => new Date(b.date) - new Date(a.date)), [rawTrades, lotSizes]);
  const symbols = useMemo(() => [...new Set(trades.map((t) => t.symbol).filter(Boolean))], [trades]);
  const filteredTrades = useMemo(() => {
    const q = search.toLowerCase().trim();
    return trades.filter((t) => {
      const symbolMatch = instrumentFilter === "all" || t.symbol === instrumentFilter;
      const queryMatch = !q || t.symbol.toLowerCase().includes(q) || String(t.id || "").toLowerCase().includes(q);
      return symbolMatch && queryMatch;
    });
  }, [trades, search, instrumentFilter]);
  const stats = useMemo(() => {
    const total = trades.length;
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    const net = trades.reduce((s, t) => s + t.pnl, 0);
    const init = Number(profile?.initialCapital || 0);
    const withdrawn = withdrawals.reduce((sum, item) => sum + item.amount, 0);
    return { total, net, withdrawn, netAfterWithdrawals: net - withdrawn, winRate: total ? (wins.length / total) * 100 : 0, biggestWin: wins.length ? Math.max(...wins.map((t) => t.pnl)) : 0, biggestLoss: losses.length ? Math.min(...losses.map((t) => t.pnl)) : 0, current: init + net - withdrawn, returnPct: init > 0 ? (net / init) * 100 : 0, avgWinner: wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0, avgLoser: losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0 };
  }, [trades, profile, withdrawals]);
  const equityData = useMemo(() => {
    const initialCapital = Number(profile?.initialCapital || 0);
    const events = [...trades.map((trade) => ({ label: new Date(trade.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), sortTime: new Date(trade.date).getTime() + Number(trade.createdAt || 0) / 100000000, delta: trade.pnl })), ...withdrawals.map((item) => ({ label: new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), sortTime: new Date(item.date).getTime() + Number(item.createdAt || 0) / 100000000, delta: -item.amount }))].sort((a, b) => a.sortTime - b.sortTime);
    let equity = initialCapital;
    return events.map((event) => { equity += event.delta; return { label: event.label, equity: Math.round(equity) }; });
  }, [trades, withdrawals, profile]);
  const monthlyData = useMemo(() => {
    const map = {};
    trades.forEach((t) => { const key = new Date(t.date).toLocaleDateString("en-IN", { month: "short" }); map[key] = (map[key] || 0) + t.pnl; });
    return Object.entries(map).map(([month, pnl]) => ({ month, pnl: Math.round(pnl) }));
  }, [trades]);
  const currentMonthPnl = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7);
    return trades.filter((t) => String(t.date || "").startsWith(monthKey)).reduce((sum, t) => sum + t.pnl, 0);
  }, [trades]);
  const currentMonthWithdrawn = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7);
    return withdrawals.filter((item) => String(item.date || "").startsWith(monthKey)).reduce((sum, item) => sum + item.amount, 0);
  }, [withdrawals]);
  const monthlyTarget = Number(profile?.monthlyTarget || 0);
  const monthlyTargetPct = monthlyTarget > 0 ? Math.min((currentMonthPnl / monthlyTarget) * 100, 100) : 0;
  const monthlyTargetRemaining = Math.max(0, monthlyTarget - currentMonthPnl);
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayTrades = trades.filter((t) => t.date === today);
    const todayLoss = Math.abs(todayTrades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
    return { count: todayTrades.length, loss: todayLoss };
  }, [trades]);
  const lossPct = Math.min((todayStats.loss / Math.max(1, Number(profile?.dailyMaxLoss || 1))) * 100, 100);
  const tradePct = Math.min((todayStats.count / Math.max(1, Number(profile?.maxTradesPerDay || 1))) * 100, 100);
  const buildProfilePayload = (source) => ({ displayName: source.displayName || "Trader", initialCapital: Math.max(1000, Number(source.initialCapital) || 0), dailyMaxLoss: Math.max(100, Number(source.dailyMaxLoss) || 100), maxTradesPerDay: Math.max(1, Number(source.maxTradesPerDay) || 1), monthlyTarget: Math.max(0, Number(source.monthlyTarget) || 0), withdrawals: sanitizeWithdrawals(source.withdrawals), lotSizes: sanitizeLotSizes(source.lotSizes) });

  const onAuthSubmit = async (e) => {
    e.preventDefault();
    const email = authData.email.trim().toLowerCase();
    if (!email || !authData.password) return;
    if (authMode === "register") {
      if (accounts.some((a) => a.email === email)) { setAuthError("Account exists. Please login."); return; }
      const account = { email, password: authData.password, name: authData.name || "Trader" };
      setAccounts((prev) => [...prev, account]);
      await saveAccount(account);
      setSessionEmail(email);
      setPage("settings");
    } else {
      const match = accounts.some((a) => a.email === email && a.password === authData.password);
      if (!match) { setAuthError("Invalid email/password"); return; }
      setSessionEmail(email);
    }
    setAuthData({ name: "", email: "", password: "" });
    setAuthError("");
  };

  const onSaveSettings = async (e) => {
    e.preventDefault();
    if (!sessionEmail) return;
    const next = buildProfilePayload(profileDraft);
    setProfile(next);
    setProfileDraft(createProfileDraft(next));
    await saveProfile(sessionEmail, next);
    setSettingsStatus("Settings saved and capital recalculated.");
    setPage("dashboard");
  };

  const onAddWithdrawal = async () => {
    const amount = Number(withdrawalForm.amount || 0);
    if (!hasProfile || amount <= 0 || !sessionEmail) { setSettingsStatus("Save profile first, then add a withdrawal amount."); return; }
    const nextWithdrawals = sanitizeWithdrawals([...withdrawals, { id: `WD-${String(Date.now()).slice(-5)}${Math.floor(Math.random() * 900 + 100)}`, date: withdrawalForm.date || new Date().toISOString().slice(0, 10), amount, note: withdrawalForm.note, createdAt: Date.now() }]);
    const next = buildProfilePayload({ ...profileDraft, ...profile, withdrawals: nextWithdrawals });
    setProfile(next);
    setProfileDraft(createProfileDraft(next));
    await saveProfile(sessionEmail, next);
    setWithdrawalForm({ date: new Date().toISOString().slice(0, 10), amount: "", note: "" });
    setSettingsStatus("Withdrawal saved. Dashboard capital updated.");
  };

  const onDeleteWithdrawal = async (id) => {
    if (!sessionEmail) return;
    const next = buildProfilePayload({ ...profileDraft, ...profile, withdrawals: withdrawals.filter((item) => item.id !== id) });
    setProfile(next);
    setProfileDraft(createProfileDraft(next));
    await saveProfile(sessionEmail, next);
    setSettingsStatus("Withdrawal removed and capital recalculated.");
  };

  const onAddTrade = (e) => {
    e.preventDefault();
    if (!hasProfile) { setPage("settings"); setSettingsStatus("Complete profile setup first."); return; }
    const next = { ...tradeForm, id: `TRD-${String(Date.now()).slice(-5)}${Math.floor(Math.random() * 900 + 100)}`, createdAt: Date.now() };
    setRawTrades((prev) => [...prev, next]);
    setTradeForm((p) => ({ ...p, entry: "", exit: "", fees: 0, notes: "", quantity: 1 }));
    setPage("dashboard");
  };

  const onDeleteTrade = (id) => setRawTrades((prev) => prev.filter((t) => t.id !== id));
  const onImportCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = parseCsv(text);
    if (!imported.length) return;
    setRawTrades((prev) => [...prev, ...imported]);
    event.target.value = "";
  };
  const onExportCsv = () => {
    if (!trades.length) return;
    const header = ["id", "date", "symbol", "side", "quantity", "lotSizeUsed", "entry", "exit", "fees", "pnl", "notes"];
    const rows = trades.map((t) => [t.id, t.date, t.symbol, t.side, t.quantity, t.lotSizeUsed, t.entry, t.exit, t.fees, t.pnl, `"${String(t.notes || "").replace(/"/g, '""')}"`].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tradejournal-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navItems = [["dashboard", "dashboard", "Dashboard"], ["plus", "new-trade", "New Trade"], ["history", "history", "History"], ["file", "reports", "Reports"], ["settings", "settings", "Settings"]];
  const profileName = profile?.displayName || sessionEmail.split("@")[0] || "Trader";

  if (!sessionEmail) {
    return <div className="auth-shell"><article className="modal-card"><div className="auth-brand"><span className="brand-icon"><Icon name="dashboard" /></span><h2>{authMode === "register" ? "Create Account" : "Login"}</h2></div><p className="muted">{authMode === "register" ? "Register to start TradeJournal." : "Login to continue."}</p><form className="auth-form" onSubmit={onAuthSubmit}>{authMode === "register" && <label className="auth-input-box"><input value={authData.name} onChange={(e) => setAuthData((p) => ({ ...p, name: e.target.value }))} placeholder=" " required autoComplete="name" /><span>Name</span><Icon name="user" className="auth-input-icon" /></label>}<label className="auth-input-box"><input type="email" value={authData.email} onChange={(e) => setAuthData((p) => ({ ...p, email: e.target.value }))} placeholder=" " required autoComplete="email" /><span>Email</span><Icon name="mail" className="auth-input-icon" /></label><label className="auth-input-box auth-password-box"><input type={showPassword ? "text" : "password"} value={authData.password} onChange={(e) => setAuthData((p) => ({ ...p, password: e.target.value }))} placeholder=" " required autoComplete={authMode === "register" ? "new-password" : "current-password"} /><span>Password</span><button type="button" className="auth-eye" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((v) => !v)}><Icon name={showPassword ? "eyeOff" : "eye"} className="auth-input-icon" /></button></label><button className="button" type="submit">{authMode === "register" ? "Create Account" : "Login"}</button></form><button className="button subtle auth-switch" onClick={() => { setAuthMode((m) => (m === "register" ? "login" : "register")); setShowPassword(false); }}>{authMode === "register" ? "Already have account? Login" : "No account? Register"}</button><p className="error">{authError}</p></article></div>;
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Icon name="dashboard" /><span>TradeJournal</span></div>
        <nav className="nav">{navItems.map(([icon, id, label]) => <button key={id} className={`nav-item ${page === id ? "active" : ""}`} disabled={!hasProfile && id !== "settings"} onClick={() => setPage(!hasProfile && id !== "settings" ? "settings" : id)}><Icon name={icon} /><span>{label}</span></button>)}</nav>
        <div className="profile"><div className="avatar">{profileName.slice(0, 2).toUpperCase()}</div><div><p className="profile-name">{profileName}</p><p className="profile-plan">{sessionEmail}</p></div><button className="button subtle tiny" onClick={() => setSessionEmail("")}><Icon name="logout" />Log out</button></div>
      </aside>
      <main className="content">
        {page === "dashboard" && <section className="page active"><header className="page-head"><h1><Icon name="dashboard" />Dashboard</h1><p>Track your performance, capital changes and account growth.</p></header><div className="stats-grid stats-grid-wide"><article className="stat-card"><h3><Icon name="money" />Current Capital</h3><p className="stat-value">{currency(stats.current)}</p><p className="stat-sub">Initial: {currency(profile?.initialCapital || 0)} | Withdrawn: {currency(stats.withdrawn)}</p></article><article className="stat-card"><h3><Icon name="money" />Total Net P&amp;L</h3><p className={`stat-value ${stats.net >= 0 ? "up" : "down"}`}>{currency(stats.net)}</p><p className={`stat-sub ${stats.returnPct >= 0 ? "up" : "down"}`}>{signedNumber(stats.returnPct, 1, "%")} trading return</p></article><article className="stat-card"><h3><Icon name="wallet" />Capital Withdrawn</h3><p className="stat-value down">{currency(stats.withdrawn)}</p><p className="stat-sub">This month: {currency(currentMonthWithdrawn)}</p></article><article className="stat-card"><h3><Icon name="target" />Win Rate</h3><p className="stat-value">{number(stats.winRate, 1)}%</p><p className="stat-sub">Across {stats.total} trades</p></article><article className="stat-card"><h3><Icon name="plus" />Biggest Win</h3><p className="stat-value up">{currency(stats.biggestWin)}</p><p className="stat-sub">Biggest Loss: {currency(stats.biggestLoss)}</p></article></div><article className="card target-card"><h2><Icon name="target" />Monthly Target</h2><div className="target-grid"><div><span className="target-label">Target</span><strong>{currency(monthlyTarget)}</strong></div><div><span className="target-label">Achieved</span><strong className={currentMonthPnl >= 0 ? "up" : "down"}>{currency(currentMonthPnl)}</strong></div><div><span className="target-label">Remaining</span><strong>{currency(monthlyTargetRemaining)}</strong></div></div><div className="progress neutral"><div style={{ width: `${monthlyTargetPct}%` }} /></div><p className="stat-sub">Progress: {number(monthlyTargetPct, 1)}% | Withdrawals this month: {currency(currentMonthWithdrawn)}</p></article><div className="grid-two"><article className="card chart-card"><h2><Icon name="chart" />Equity Curve</h2><div className="chart-wrap">{equityData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={equityData} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}><defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f4f7ff" stopOpacity={0.45} /><stop offset="95%" stopColor="#f4f7ff" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#1a2436" /><XAxis dataKey="label" stroke="#93a0b8" tick={{ fill: "#93a0b8", fontSize: 11 }} /><YAxis stroke="#93a0b8" tick={{ fill: "#93a0b8", fontSize: 11 }} tickFormatter={fmtAxis} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="equity" stroke="#f1f5ff" strokeWidth={2.5} fill="url(#equityFill)" /></AreaChart></ResponsiveContainer> : <p className="muted">Add trades or withdrawals to render equity curve.</p>}</div></article><article className="card chart-card"><h2><Icon name="money" />Monthly P&amp;L</h2><div className="chart-wrap">{monthlyData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#1a2436" /><XAxis dataKey="month" stroke="#93a0b8" tick={{ fill: "#93a0b8", fontSize: 11 }} /><YAxis stroke="#93a0b8" tick={{ fill: "#93a0b8", fontSize: 11 }} tickFormatter={fmtAxis} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="pnl" radius={[6, 6, 0, 0]}>{monthlyData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={entry.pnl >= 0 ? "#25b863" : "#d33b3b"} />)}</Bar></BarChart></ResponsiveContainer> : <p className="muted">Monthly bars appear after at least one trade.</p>}</div></article></div></section>}
        {page === "new-trade" && <section className="page active"><header className="page-head row-head"><div><h1><Icon name="plus" />New Trade</h1><p>Log each setup with execution details.</p></div><label className="button secondary upload-btn"><Icon name="upload" />Upload Broker CSV<input type="file" accept=".csv,text/csv" onChange={onImportCsv} /></label></header><article className="card form-card"><h2><Icon name="file" />Trade Details</h2><form className="trade-form" onSubmit={onAddTrade}><label><span className="label-title"><Icon name="calendar" />Date</span><input type="date" value={tradeForm.date} onChange={(e) => setTradeForm((p) => ({ ...p, date: e.target.value }))} /></label><label><span className="label-title"><Icon name="target" />Instrument</span><input value={tradeForm.symbol} onChange={(e) => setTradeForm((p) => ({ ...p, symbol: e.target.value }))} /></label><label><span className="label-title"><Icon name="target" />Strike</span><input type="number" value={tradeForm.strike} onChange={(e) => setTradeForm((p) => ({ ...p, strike: e.target.value }))} /></label><label><span className="label-title"><Icon name="file" />Option Type</span><select value={tradeForm.optionType} onChange={(e) => setTradeForm((p) => ({ ...p, optionType: e.target.value }))}><option value="CE">Call (CE)</option><option value="PE">Put (PE)</option></select></label><label><span className="label-title"><Icon name="chart" />Direction</span><select value={tradeForm.side} onChange={(e) => setTradeForm((p) => ({ ...p, side: e.target.value }))}><option value="Long">Buy (Long)</option><option value="Short">Sell (Short)</option></select></label><label><span className="label-title"><Icon name="target" />Lots</span><input type="number" value={tradeForm.quantity} onChange={(e) => setTradeForm((p) => ({ ...p, quantity: e.target.value }))} /></label><label><span className="label-title"><Icon name="money" />Entry</span><input type="number" value={tradeForm.entry} onChange={(e) => setTradeForm((p) => ({ ...p, entry: e.target.value }))} /></label><label><span className="label-title"><Icon name="money" />Exit</span><input type="number" value={tradeForm.exit} onChange={(e) => setTradeForm((p) => ({ ...p, exit: e.target.value }))} /></label><label><span className="label-title"><Icon name="alert" />Stop Loss</span><input type="number" value={tradeForm.stopLoss} onChange={(e) => setTradeForm((p) => ({ ...p, stopLoss: e.target.value }))} /></label><label><span className="label-title"><Icon name="money" />Fees</span><input type="number" value={tradeForm.fees} onChange={(e) => setTradeForm((p) => ({ ...p, fees: e.target.value }))} /></label><label className="wide"><span className="label-title"><Icon name="edit" />Notes</span><textarea rows="3" value={tradeForm.notes} onChange={(e) => setTradeForm((p) => ({ ...p, notes: e.target.value }))} /></label><div className="wide row-actions"><button className="button" type="submit"><Icon name="plus" />Save Trade</button><button className="button subtle" type="button" onClick={() => setTradeForm((p) => ({ ...p, entry: "", exit: "", notes: "" }))}><Icon name="refresh" />Reset</button></div></form></article></section>}
        {page === "history" && <section className="page active"><header className="page-head"><h1><Icon name="history" />Trade History</h1><p>Review your past trades.</p></header><article className="card"><div className="history-tools"><h2><Icon name="file" />All Trades</h2><div className="history-filters"><span className="input-with-icon"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." /></span><select value={instrumentFilter} onChange={(e) => setInstrumentFilter(e.target.value)}><option value="all">All Instruments</option>{symbols.map((s) => <option key={s} value={s}>{s}</option>)}</select></div></div><div className="table-wrap"><table><thead><tr><th>ID</th><th>Date</th><th>Instrument</th><th>Strike</th><th>Type</th><th>Lots</th><th>Lot Size</th><th>Entry</th><th>Exit</th><th>P&amp;L</th><th /></tr></thead><tbody>{filteredTrades.length ? filteredTrades.map((t) => <tr key={t.id}><td>{t.id}</td><td>{t.date}</td><td>{t.symbol}</td><td>{number(t.strike, 0)}</td><td><span className={`type-pill ${t.side === "Long" ? "type-long" : "type-short"}`}>{t.side}</span><span className="type-pill">{t.optionType || "CE"}</span></td><td>{t.quantity}</td><td>{t.lotSizeUsed}</td><td>{number(t.entry)}</td><td>{number(t.exit)}</td><td className={t.pnl >= 0 ? "up" : "down"}>{currency(t.pnl)}</td><td><button className="button subtle" onClick={() => onDeleteTrade(t.id)}><Icon name="trash" />Delete</button></td></tr>) : <tr><td className="empty" colSpan="11">No trades found.</td></tr>}</tbody></table></div></article></section>}
        {page === "reports" && <section className="page active"><header className="page-head row-head"><div><h1><Icon name="file" />Reports &amp; Risk</h1><p>Export and monitor risk.</p></div><div className="report-actions"><button className="button secondary" onClick={onExportCsv}><Icon name="download" />Export CSV</button><button className="button" onClick={() => window.print()}><Icon name="printer" />Generate PDF</button></div></header><article className="alert"><Icon name={lossPct >= 70 || tradePct >= 80 ? "alert" : "shield"} /><span>{lossPct >= 70 || tradePct >= 80 ? "Risk Alert: drawdown/trades nearing threshold." : "Risk status normal."}</span></article><div className="grid-two"><article className="card"><h2><Icon name="shield" />Risk Control</h2><div className="risk-block"><div className="risk-row"><span>Daily Max Loss</span><strong>{currency(profile?.dailyMaxLoss || 0)}</strong></div><div className="progress"><div style={{ width: `${lossPct}%` }} /></div><p>Current: {currency(todayStats.loss)} ({number(lossPct, 0)}%)</p></div><div className="risk-block"><div className="risk-row"><span>Max Trades/Day</span><strong>{profile?.maxTradesPerDay || 0}</strong></div><div className="progress neutral"><div style={{ width: `${tradePct}%` }} /></div><p>Current: {todayStats.count} ({number(tradePct, 0)}%)</p></div><button className="button secondary" onClick={() => setPage("settings")}><Icon name="edit" />Edit Limits</button></article><article className="card"><h2><Icon name="chart" />Performance Summary</h2><dl className="summary"><dt>Total Trades</dt><dd>{stats.total}</dd><dt>Win Rate</dt><dd>{number(stats.winRate, 1)}%</dd><dt>Average Winner</dt><dd>{currency(stats.avgWinner)}</dd><dt>Average Loser</dt><dd>{currency(stats.avgLoser)}</dd><dt>Biggest Win</dt><dd>{currency(stats.biggestWin)}</dd><dt>Biggest Loss</dt><dd>{currency(stats.biggestLoss)}</dd><dt>Total Withdrawn</dt><dd className="down">{currency(stats.withdrawn)}</dd><dt>Net After Withdrawals</dt><dd className={stats.netAfterWithdrawals >= 0 ? "up" : "down"}>{currency(stats.netAfterWithdrawals)}</dd><dt>Current Capital</dt><dd>{currency(stats.current)}</dd><dt>Monthly Target</dt><dd>{currency(monthlyTarget)}</dd><dt>This Month</dt><dd className={currentMonthPnl >= 0 ? "up" : "down"}>{currency(currentMonthPnl)}</dd></dl><button className="button danger" onClick={() => setRawTrades([])}><Icon name="trash" />Clear All Trades</button></article></div></section>}
        {page === "settings" && <section className="page active"><header className="page-head"><h1><Icon name="settings" />Profile Settings</h1><p>Capital, risk, lot sizes and withdrawals.</p></header><div className="grid-two settings-grid"><article className="card form-card"><h2><Icon name="user" />Account &amp; Capital Setup</h2><form className="trade-form" onSubmit={onSaveSettings}><label><span className="label-title"><Icon name="user" />Display Name</span><input value={profileDraft.displayName} onChange={(e) => setProfileDraft((p) => ({ ...p, displayName: e.target.value }))} /></label><label><span className="label-title"><Icon name="money" />Initial Capital</span><input type="number" value={profileDraft.initialCapital} onChange={(e) => setProfileDraft((p) => ({ ...p, initialCapital: e.target.value }))} /></label><label><span className="label-title"><Icon name="alert" />Daily Max Loss</span><input type="number" value={profileDraft.dailyMaxLoss} onChange={(e) => setProfileDraft((p) => ({ ...p, dailyMaxLoss: e.target.value }))} /></label><label><span className="label-title"><Icon name="target" />Max Trades/Day</span><input type="number" value={profileDraft.maxTradesPerDay} onChange={(e) => setProfileDraft((p) => ({ ...p, maxTradesPerDay: e.target.value }))} /></label><label><span className="label-title"><Icon name="target" />Monthly Target</span><input type="number" value={profileDraft.monthlyTarget} onChange={(e) => setProfileDraft((p) => ({ ...p, monthlyTarget: e.target.value }))} /></label><fieldset className="wide lot-grid"><legend>Instrument Lot Sizes</legend>{Object.keys(DEFAULT_LOT_SIZES).map((k) => <label key={k}><span className="label-title"><Icon name="target" />{k}</span><input type="number" value={profileDraft.lotSizes[k]} onChange={(e) => setProfileDraft((p) => ({ ...p, lotSizes: { ...p.lotSizes, [k]: e.target.value } }))} /></label>)}</fieldset><div className="wide row-actions"><button className="button" type="submit"><Icon name="download" />Save Settings</button><p className="muted">{settingsStatus || (!hasProfile ? "Complete setup to unlock app." : "")}</p></div></form></article><article className="card form-card"><h2><Icon name="wallet" />Capital Withdrawals</h2><div className="withdrawal-summary"><div><span className="target-label">Total Withdrawn</span><strong className="down">{currency(stats.withdrawn)}</strong></div><div><span className="target-label">Current Capital</span><strong>{currency(stats.current)}</strong></div></div><div className="trade-form withdrawal-form"><label><span className="label-title"><Icon name="calendar" />Date</span><input type="date" value={withdrawalForm.date} onChange={(e) => setWithdrawalForm((p) => ({ ...p, date: e.target.value }))} /></label><label><span className="label-title"><Icon name="money" />Amount</span><input type="number" value={withdrawalForm.amount} onChange={(e) => setWithdrawalForm((p) => ({ ...p, amount: e.target.value }))} /></label><label><span className="label-title"><Icon name="edit" />Note</span><input value={withdrawalForm.note} placeholder="Reason / transfer note" onChange={(e) => setWithdrawalForm((p) => ({ ...p, note: e.target.value }))} /></label><div className="wide row-actions"><button className="button" type="button" onClick={onAddWithdrawal}><Icon name="wallet" />Add Withdrawal</button><p className="muted">{hasProfile ? "Every withdrawal reduces current capital and equity curve." : "Save profile setup first to enable withdrawals."}</p></div></div><div className="withdrawal-list">{withdrawals.length ? withdrawals.map((item) => <div key={item.id} className="withdrawal-item"><div><strong>{currency(item.amount)}</strong><p>{item.date}{item.note ? ` | ${item.note}` : ""}</p></div><button className="button subtle" type="button" onClick={() => onDeleteWithdrawal(item.id)}><Icon name="trash" />Delete</button></div>) : <p className="muted">No withdrawals recorded yet.</p>}</div></article></div></section>}
      </main>
    </div>
  );
}
