import type { Server } from "socket.io";
import type { ClubEventBus } from "../event-bus.js";

export function setupBroadcaster(io: Server, bus: ClubEventBus): void {
  const agentNsp = io.of("/agent");
  const audienceNsp = io.of("/audience");

  bus.on("session:start", (data) => {
    agentNsp.emit("session:start", data);
    audienceNsp.emit("session:change", data);
  });

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
}
