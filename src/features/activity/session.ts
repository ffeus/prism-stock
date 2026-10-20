import type { TargetState } from "../../lib/types.ts";
import { targetKey } from "../../lib/types.ts";

export interface CycleRecord { id: number; cycle: number; at: number; elapsedMs: number; requests: number; reused: number; healthy: boolean; valid: number; total: number; inStock: number }
export interface Observation { id: number; at: number; cycle: number; state: TargetState; changed: boolean }
export interface NotificationRecord { id: number; at: number; title: string; detail: string; kind: "triggered" | "submitted" | "failed" }
export interface SessionActivity { startedAt: number; cycles: CycleRecord[]; observations: Observation[]; notifications: NotificationRecord[]; sequence: number }
export const newSession = (at = Date.now()): SessionActivity => ({ startedAt: at, cycles: [], observations: [], notifications: [], sequence: 0 });

export function recordCycle(session: SessionActivity, cycle: Omit<CycleRecord, "id" | "valid" | "total" | "inStock">, snapshot: TargetState[], previous: TargetState[]): SessionActivity {
  const known = new Map(previous.filter(row => !(row.availability.kind === "unknown" && row.availability.reason === "not_yet_checked")).map(row => [targetKey(row.target), row.availability]));
  let sequence = session.sequence;
  const rows = snapshot.map(state => ({ id: ++sequence, at: cycle.at, cycle: cycle.cycle, state: structuredClone(state),
    changed: known.has(targetKey(state.target)) && JSON.stringify(known.get(targetKey(state.target))) !== JSON.stringify(state.availability) }));
  const valid = snapshot.filter(row => row.availability.kind !== "unknown").length;
  const record = { ...cycle, id: ++sequence, valid, total: snapshot.length, inStock: snapshot.filter(row => row.availability.kind === "in_stock").length };
  return { ...session, sequence, cycles: [...session.cycles, record].slice(-120), observations: [...session.observations, ...rows].slice(-600) };
}

export function recordNotification(session: SessionActivity, record: Omit<NotificationRecord, "id">): SessionActivity {
  const id = session.sequence + 1;
  return { ...session, sequence: id, notifications: [...session.notifications, { ...record, id }].slice(-100) };
}

export function sessionMetrics(session: SessionActivity) {
  const total = session.cycles.reduce((count, cycle) => count + cycle.total, 0);
  const valid = session.cycles.reduce((count, cycle) => count + cycle.valid, 0);
  return { cycles: session.cycles.length, successRate: total ? Math.round(valid / total * 100) : null,
    averageMs: session.cycles.length ? Math.round(session.cycles.reduce((count, cycle) => count + cycle.elapsedMs, 0) / session.cycles.length) : null,
    requests: session.cycles.reduce((count, cycle) => count + cycle.requests, 0) };
}
