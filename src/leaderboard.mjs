import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_STORE = path.join(ROOT, ".ddl-data", "leaderboard.json");

// Supports 3–12 chars: [A-Za-z0-9_] plus Vietnamese Unicode letters.
const NAME_RE = /^[\p{L}0-9_]{3,12}$/u;

export function formatIsoWithOffset(date = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  const tzMin = -date.getTimezoneOffset();
  const sign = tzMin >= 0 ? "+" : "-";
  const abs = Math.abs(tzMin);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function validateName(name) {
  if (typeof name !== "string") return { ok: false, error: "Tên phải là chuỗi ký tự." };
  const trimmed = name.trim();
  if (!NAME_RE.test(trimmed)) {
    return { ok: false, error: "Tên dài 3–12 ký tự (chữ cái, số hoặc _, không khoảng trắng)." };
  }
  return { ok: true, name: trimmed };
}

export function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = Date.parse(a.achieved_at) || 0;
    const tb = Date.parse(b.achieved_at) || 0;
    if (ta !== tb) return ta - tb;
    return String(a.achieved_at).localeCompare(String(b.achieved_at));
  });
}

export function loadLeaderboard(storePath = DEFAULT_STORE) {
  try {
    const raw = JSON.parse(fs.readFileSync(storePath, "utf8"));
    const list = Array.isArray(raw?.entries) ? raw.entries : [];
    return sortEntries(list).slice(0, 10);
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries, storePath = DEFAULT_STORE) {
  const top = sortEntries(entries).slice(0, 10);
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify({ entries: top }, null, 2) + "\n");
  return top;
}

export function addLeaderboardEntry({ name, score, nights_won, seed, achieved_at = formatIsoWithOffset() }, storePath = DEFAULT_STORE) {
  const checked = validateName(name);
  if (!checked.ok) throw new Error(checked.error);
  const cleanScore = Math.max(0, Math.floor(Number(score) || 0));
  const cleanNights = Math.max(0, Math.min(3, Math.floor(Number(nights_won) || 0)));
  const cleanSeed = Number.isFinite(Number(seed)) ? Math.floor(Number(seed)) : 2026;
  const entry = {
    name: checked.name,
    score: cleanScore,
    nights_won: cleanNights,
    achieved_at: String(achieved_at),
    seed: cleanSeed,
  };
  const current = loadLeaderboard(storePath);
  const updated = saveLeaderboard([...current, entry], storePath);
  return { entry, entries: updated };
}

export function exportLeaderboard(outPath, storePath = DEFAULT_STORE) {
  const entries = loadLeaderboard(storePath);
  const payload = JSON.stringify({ entries }, null, 2) + "\n";
  if (outPath) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, payload);
  } else {
    process.stdout.write(payload);
  }
  return entries;
}
