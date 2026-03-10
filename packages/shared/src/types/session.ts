export type SlotType = "dj" | "vj";
export type SessionStatus = "idle" | "active" | "warning" | "transitioning";
export type QueuePosition = { agentId: string; agentName: string; slotType: SlotType; bookedAt: number };

export interface SlotState {
  type: SlotType;
  status: SessionStatus;
  agent: { id: string; name: string } | null;
  sessionId: string | null;
  code: string;
  startedAt: number | null;
  endsAt: number | null;
}

export interface SessionConfig {
  durationMs: number;
  warningMs: number;
  minPushIntervalMs: number;
  maxBpmDelta: number;
}

export interface ClubState {
  dj: SlotState;
  vj: SlotState;
  queue: QueuePosition[];
  audienceCount: number;
}

export interface CodePush {
  type: SlotType;
  code: string;
}
