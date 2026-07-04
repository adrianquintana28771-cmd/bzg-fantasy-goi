import { useSyncExternalStore } from "react";
import { DEFAULT_RULES } from "./rules";
import { matches, playerMatchStats, players, seasons, teams } from "./mock-data";
import type { Match, Player, PlayerMatchStats, ScoringRule, Season, Team } from "./types";

interface State {
  seasons: Season[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  stats: PlayerMatchStats[];
  rules: ScoringRule[];
  actaFiles: Record<string, string>; // matchId -> data URL
}

const RULES_KEY = "bzg.rules.v1";
const ACTAS_KEY = "bzg.actas.v2";
const STATS_KEY = "bzg.stats.v2";

function loadRules(): ScoringRule[] {
  if (typeof window === "undefined") return DEFAULT_RULES;
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_RULES;
}
function loadActas(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ACTAS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}
function loadStats(): PlayerMatchStats[] {
  if (typeof window === "undefined") return playerMatchStats;
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return playerMatchStats;
}

let state: State = {
  seasons,
  teams,
  players,
  matches,
  stats: playerMatchStats,
  rules: DEFAULT_RULES,
  actaFiles: {},
};

let initialized = false;
function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  state = {
    ...state,
    rules: loadRules(),
    actaFiles: loadActas(),
    stats: loadStats(),
  };
  initialized = true;
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export const fantasyStore = {
  getState(): State {
    ensureInit();
    return state;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  updateRule(key: string, points: number) {
    state = {
      ...state,
      rules: state.rules.map((r) => (r.key === key ? { ...r, points } : r)),
    };
    localStorage.setItem(RULES_KEY, JSON.stringify(state.rules));
    emit();
  },
  toggleRule(key: string) {
    state = {
      ...state,
      rules: state.rules.map((r) => (r.key === key ? { ...r, active: !r.active } : r)),
    };
    localStorage.setItem(RULES_KEY, JSON.stringify(state.rules));
    emit();
  },
  resetRules() {
    state = { ...state, rules: DEFAULT_RULES };
    localStorage.setItem(RULES_KEY, JSON.stringify(DEFAULT_RULES));
    emit();
  },
  saveActa(matchId: string, dataUrl: string) {
    state = { ...state, actaFiles: { ...state.actaFiles, [matchId]: dataUrl } };
    localStorage.setItem(ACTAS_KEY, JSON.stringify(state.actaFiles));
    emit();
  },
  updateStats(statId: string, patch: Partial<PlayerMatchStats>) {
    state = {
      ...state,
      stats: state.stats.map((s) => (s.id === statId ? { ...s, ...patch } : s)),
    };
    localStorage.setItem(STATS_KEY, JSON.stringify(state.stats));
    emit();
  },
};

export function useFantasy<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    fantasyStore.subscribe,
    () => selector(fantasyStore.getState()),
    () => selector(fantasyStore.getState()),
  );
}
