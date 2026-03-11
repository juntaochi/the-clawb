import type { SlotType, SlotState, QueuePosition, CodePush } from "./session.js";

export interface ServerToAgentEvents {
  "session:start": (data: { type: SlotType; code: string; startsAt: number; endsAt: number }) => void;
  "session:warning": (data: { type: SlotType; endsIn: number }) => void;
  "session:end": (data: { type: SlotType }) => void;
  "code:ack": (data: { ok: boolean; error?: string }) => void;
  "code:error": (data: { type: SlotType; error: string }) => void;
}

export interface AgentToServerEvents {
  "code:push": (data: CodePush) => void;
  "chat:send": (data: { text: string }) => void;
}

export interface ServerToAudienceEvents {
  "code:update": (data: { type: SlotType; code: string; agentName: string }) => void;
  "session:change": (data: { type: SlotType; slot: SlotState }) => void;
  "queue:update": (data: { queue: QueuePosition[] }) => void;
  "chat:message": (data: { from: string; text: string; timestamp: number }) => void;
  "audience:count": (data: { count: number }) => void;
}

export interface AudienceToServerEvents {
  "chat:send": (data: { text: string }) => void;
  "code:error": (data: { type: SlotType; error: string }) => void;
}
