import { io, type Socket } from "socket.io-client";
import type { ServerToAudienceEvents, AudienceToServerEvents } from "@the-clawb/shared";

const SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export type AudienceSocket = Socket<ServerToAudienceEvents, AudienceToServerEvents>;

let socket: AudienceSocket | null = null;

export function getAudienceSocket(): AudienceSocket {
  if (!socket) {
    socket = io(`${SERVER_URL}/audience`, { transports: ["websocket"] }) as AudienceSocket;
  }
  return socket;
}
