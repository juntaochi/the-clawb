import { randomUUID } from "crypto";
import type {
  SlotType, SlotState, SessionStatus, SessionConfig,
  ClubState, QueuePosition, CodePush,
} from "@openclaw-rave/shared";
import { DEFAULT_DJ_CODE, DEFAULT_VJ_CODE } from "./defaults.js";

type EngineEvent = "session:start" | "session:warning" | "session:end" | "code:update" | "queue:update";
type EventCallback = (event: EngineEvent, data: unknown) => void;

interface ActiveSession {
  id: string;
  agentId: string;
  agentName: string;
  type: SlotType;
  startedAt: number;
  endsAt: number;
  lastPushAt: number;
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
  private onEvent: EventCallback;

  constructor(config: SessionConfig, onEvent: EventCallback) {
    this.config = config;
    this.onEvent = onEvent;
    this.djCode = DEFAULT_DJ_CODE;
    this.vjCode = DEFAULT_VJ_CODE;
  }

  setEventCallback(cb: EventCallback): void {
    this.onEvent = cb;
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

  bookSlot(agentId: string, agentName: string, slotType: SlotType): { position: number } {
    const existing = this.queue.find((q) => q.agentId === agentId && q.slotType === slotType);
    if (existing) {
      return { position: this.queue.indexOf(existing) };
    }

    const entry: QueuePosition = { agentId, agentName, slotType, bookedAt: Date.now() };
    this.queue.push(entry);
    const position = this.queue.filter((q) => q.slotType === slotType).length - 1;
    this.onEvent("queue:update", { queue: this.queue });
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

    this.onEvent("code:update", { type: push.type, code: push.code, agentName: session.agentName });
    return { ok: true };
  }

  endSession(type: SlotType): void {
    const session = this.getSession(type);
    if (!session) return;
    if (session.warningTimer) clearTimeout(session.warningTimer);
    if (session.endTimer) clearTimeout(session.endTimer);

    if (type === "dj") this.djSession = null;
    else this.vjSession = null;

    this.onEvent("session:end", { type });
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
      warningTimer: null,
      endTimer: null,
    };

    session.warningTimer = setTimeout(() => {
      this.onEvent("session:warning", { type: entry.slotType, endsIn: this.config.warningMs });
    }, this.config.durationMs - this.config.warningMs);

    session.endTimer = setTimeout(() => {
      this.endSession(entry.slotType);
    }, this.config.durationMs);

    if (entry.slotType === "dj") this.djSession = session;
    else this.vjSession = session;

    const code = entry.slotType === "dj" ? this.djCode : this.vjCode;
    this.onEvent("session:start", {
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
    };
  }
}
