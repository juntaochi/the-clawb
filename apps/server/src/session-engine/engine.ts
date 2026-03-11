import { randomUUID } from "crypto";
import type {
  SlotType, SlotState, SessionStatus, SessionConfig,
  ClubState, QueuePosition, CodePush,
} from "@the-clawb/shared";
import { DEFAULT_DJ_CODE, DEFAULT_VJ_CODE } from "./defaults.js";
import { ClubEventBus } from "../event-bus.js";

interface ActiveSession {
  id: string;
  agentId: string;
  agentName: string;
  type: SlotType;
  startedAt: number;
  endsAt: number;
  lastPushAt: number;
  lastError: { error: string; at: number } | null;
  warningTimer: ReturnType<typeof setTimeout> | null;
  endTimer: ReturnType<typeof setTimeout> | null;
}

export class SessionEngine {
  private djCode: string;
  private vjCode: string;
  private djSession: ActiveSession | null = null;
  private vjSession: ActiveSession | null = null;
  private queue: QueuePosition[] = [];
  private config: SessionConfig;
  private bus: ClubEventBus;

  constructor(config: SessionConfig, bus: ClubEventBus) {
    this.config = config;
    this.bus = bus;
    this.djCode = DEFAULT_DJ_CODE;
    this.vjCode = DEFAULT_VJ_CODE;
  }

  getClubState(): ClubState {
    return {
      dj: this.getSlotState("dj"),
      vj: this.getSlotState("vj"),
      queue: this.queue.filter((q) => {
        const session = this.getSession(q.slotType);
        return !session || session.agentId !== q.agentId;
      }),
      audienceCount: 0,
    };
  }

  private static readonly MAX_QUEUE_SIZE = 20;

  bookSlot(agentId: string, agentName: string, slotType: SlotType): { position: number } | { error: string } {
    // Idempotent — already queued for this exact slot type
    const existing = this.queue.find((q) => q.agentId === agentId && q.slotType === slotType);
    if (existing) {
      return { position: this.queue.indexOf(existing) };
    }

    // Prevent booking if agent is currently performing any slot
    if (this.djSession?.agentId === agentId || this.vjSession?.agentId === agentId) {
      return { error: "Already performing — finish your current session first" };
    }

    // Prevent booking both DJ and VJ simultaneously
    const otherSlotQueued = this.queue.find((q) => q.agentId === agentId);
    if (otherSlotQueued) {
      return { error: "Already queued for another slot — one slot at a time" };
    }

    // Queue size cap
    if (this.queue.length >= SessionEngine.MAX_QUEUE_SIZE) {
      return { error: "Queue is full — try again later" };
    }

    const entry: QueuePosition = { agentId, agentName, slotType, bookedAt: Date.now() };
    this.queue.push(entry);
    const position = this.queue.filter((q) => q.slotType === slotType).length - 1;
    this.bus.emit("queue:update", { queue: this.queue });
    return { position };
  }

  processQueue(): void {
    for (const type of ["dj", "vj"] as SlotType[]) {
      if (this.getSession(type)) continue;
      const next = this.queue.findIndex((q) => q.slotType === type);
      if (next === -1) continue;
      const entry = this.queue.splice(next, 1)[0];
      this.startSession(entry);
    }
  }

  pushCode(agentId: string, push: CodePush): { ok: boolean; error?: string } {
    const session = this.getSession(push.type);
    if (!session || session.agentId !== agentId) {
      return { ok: false, error: "Not the active agent for this slot" };
    }

    const now = Date.now();
    if (now - session.lastPushAt < this.config.minPushIntervalMs) {
      return { ok: false, error: "Too fast — wait between pushes" };
    }

    if (push.type === "dj") this.djCode = push.code;
    else this.vjCode = push.code;
    session.lastPushAt = now;
    session.lastError = null; // clear — agent pushed new code

    this.bus.emit("code:update", { type: push.type, code: push.code, agentName: session.agentName });
    return { ok: true };
  }

  setLastError(type: SlotType, error: string): void {
    const session = this.getSession(type);
    if (session) {
      session.lastError = { error, at: Date.now() };
    }
  }

  endSession(type: SlotType): void {
    const session = this.getSession(type);
    if (!session) return;
    if (session.warningTimer) clearTimeout(session.warningTimer);
    if (session.endTimer) clearTimeout(session.endTimer);

    if (type === "dj") this.djSession = null;
    else this.vjSession = null;

    this.bus.emit("session:end", { type });
    this.processQueue();
  }

  private startSession(entry: QueuePosition): void {
    const now = Date.now();
    const session: ActiveSession = {
      id: randomUUID(),
      agentId: entry.agentId,
      agentName: entry.agentName,
      type: entry.slotType,
      startedAt: now,
      endsAt: now + this.config.durationMs,
      lastPushAt: 0,
      lastError: null,
      warningTimer: null,
      endTimer: null,
    };

    session.warningTimer = setTimeout(() => {
      this.bus.emit("session:warning", { type: entry.slotType, endsIn: this.config.warningMs });
    }, this.config.durationMs - this.config.warningMs);

    session.endTimer = setTimeout(() => {
      this.endSession(entry.slotType);
    }, this.config.durationMs);

    if (entry.slotType === "dj") this.djSession = session;
    else this.vjSession = session;

    const code = entry.slotType === "dj" ? this.djCode : this.vjCode;
    this.bus.emit("session:start", {
      type: entry.slotType,
      code,
      startsAt: session.startedAt,
      endsAt: session.endsAt,
    });
  }

  private getSession(type: SlotType): ActiveSession | null {
    return type === "dj" ? this.djSession : this.vjSession;
  }

  private getSlotState(type: SlotType): SlotState {
    const session = this.getSession(type);
    return {
      type,
      status: session ? "active" as SessionStatus : "idle" as SessionStatus,
      agent: session ? { id: session.agentId, name: session.agentName } : null,
      sessionId: session?.id ?? null,
      code: type === "dj" ? this.djCode : this.vjCode,
      startedAt: session?.startedAt ?? null,
      endsAt: session?.endsAt ?? null,
      lastError: session?.lastError ?? null,
    };
  }
}
