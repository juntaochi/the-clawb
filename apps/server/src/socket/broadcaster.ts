import type { Server } from "socket.io";
import type { ClubEventBus } from "../event-bus.js";
import type { SessionEngine } from "../session-engine/engine.js";
import type { ChatStore } from "../stores/chat-store.js";

export function setupBroadcaster(
  io: Server,
  bus: ClubEventBus,
  engine: SessionEngine,
  chatStore: ChatStore,
): void {
  const agentNsp = io.of("/agent");
  const audienceNsp = io.of("/audience");

  function sysMsg(text: string) {
    const msg = chatStore.addSystem(text);
    audienceNsp.emit("chat:message", msg);
  }

  bus.on("session:start", (data) => {
    const d = data as { type: string };
    const state = engine.getClubState();
    const slot = d.type === "dj" ? state.dj : state.vj;
    const label = d.type === "dj" ? "DJ" : "VJ";
    if (slot.agent) {
      sysMsg(`${label} session started — ${slot.agent.name} is now live`);
    }
    agentNsp.emit("session:start", data);
    audienceNsp.emit("session:change", data);
  });

  bus.on("session:warning", (data) => {
    const d = data as { type: string; endsIn: number };
    const state = engine.getClubState();
    const nextInQueue = state.queue.find((q) => q.slotType === d.type);
    const label = d.type === "dj" ? "DJ" : "VJ";
    const text = nextInQueue
      ? `Session ending soon — next ${label}: ${nextInQueue.agentName}`
      : "Session ending soon";
    sysMsg(text);
    agentNsp.emit("session:warning", data);
  });

  bus.on("session:end", (data) => {
    const d = data as { type: string; agentName: string };
    sysMsg(`${d.agentName} has left the decks`);
    agentNsp.emit("session:end", data);
    audienceNsp.emit("session:change", data);
  });

  bus.on("code:update", (data) => {
    audienceNsp.emit("code:update", data);
  });

  let prevQueueKeys = new Set<string>();

  bus.on("queue:update", (data) => {
    const d = data as { queue: Array<{ agentId: string; agentName: string; slotType: string }> };
    for (const entry of d.queue) {
      const key = `${entry.agentId}:${entry.slotType}`;
      if (!prevQueueKeys.has(key)) {
        const label = entry.slotType === "dj" ? "DJ" : "VJ";
        sysMsg(`${entry.agentName} just queued up as ${label}`);
      }
    }
    prevQueueKeys = new Set(d.queue.map((e) => `${e.agentId}:${e.slotType}`));
    audienceNsp.emit("queue:update", data);
  });

  bus.on("code:error", (data) => {
    const d = data as { type: string; error: string; agentId: string };
    engine.setLastError(d.type as "dj" | "vj", d.error);
    agentNsp.to(`agent:${d.agentId}`).emit("code:error", { type: d.type, error: d.error });
  });

  const lastErrorAt: Record<string, number> = {};

  audienceNsp.on("connection", (socket) => {
    // Send current state to newly connected client so refreshes recover instantly
    const state = engine.getClubState();
    if (state.dj.code) {
      socket.emit("code:update", { type: "dj", code: state.dj.code, agentName: state.dj.agent?.name ?? "house" });
    }
    if (state.vj.code) {
      socket.emit("code:update", { type: "vj", code: state.vj.code, agentName: state.vj.agent?.name ?? "house" });
    }
    const recentMessages = chatStore.recent();
    if (recentMessages.length > 0) {
      socket.emit("chat:history", recentMessages);
    }

    socket.on("code:error", (data: { type: string; error: string }) => {
      if (!data?.type || !data?.error) return;
      const slotType = data.type as "dj" | "vj";

      const now = Date.now();
      if (lastErrorAt[slotType] && now - lastErrorAt[slotType] < 5000) return;
      lastErrorAt[slotType] = now;

      const state = engine.getClubState();
      const slot = slotType === "dj" ? state.dj : state.vj;
      if (!slot.agent) return;

      bus.emit("code:error", { type: slotType, error: data.error, agentId: slot.agent.id });
    });
  });
}
