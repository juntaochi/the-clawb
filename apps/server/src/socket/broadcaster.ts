import type { Server } from "socket.io";
import type { ClubEventBus } from "../event-bus.js";
import type { SessionEngine } from "../session-engine/engine.js";

export function setupBroadcaster(io: Server, bus: ClubEventBus, engine: SessionEngine): void {
  const agentNsp = io.of("/agent");
  const audienceNsp = io.of("/audience");

  bus.on("session:start", (data) => {
    agentNsp.emit("session:start", data);
    audienceNsp.emit("session:change", data);
  });

  // session:warning goes to agents only (not audience) by design.
  // Agents need to wind down; audience UI has no countdown display yet.
  // To add an audience countdown, add: audienceNsp.emit("session:warning", data)
  bus.on("session:warning", (data) => {
    agentNsp.emit("session:warning", data);
  });

  bus.on("session:end", (data) => {
    agentNsp.emit("session:end", data);
    audienceNsp.emit("session:change", data);
  });

  bus.on("code:update", (data) => {
    audienceNsp.emit("code:update", data);
  });

  bus.on("queue:update", (data) => {
    audienceNsp.emit("queue:update", data);
  });

  bus.on("code:error", (data) => {
    const d = data as { type: string; error: string; agentId: string };
    engine.setLastError(d.type as "dj" | "vj", d.error);
    agentNsp.to(`agent:${d.agentId}`).emit("code:error", { type: d.type, error: d.error });
  });

  const lastErrorAt: Record<string, number> = {};

  audienceNsp.on("connection", (socket) => {
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
