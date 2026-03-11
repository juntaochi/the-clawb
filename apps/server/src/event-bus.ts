import { EventEmitter } from "events";

export type EngineEvent =
  | "session:start"
  | "session:warning"
  | "session:end"
  | "code:update"
  | "code:error"
  | "queue:update";

export class ClubEventBus extends EventEmitter {
  emit(event: EngineEvent, data: unknown): boolean {
    return super.emit(event, data);
  }

  on(event: EngineEvent, listener: (data: unknown) => void): this {
    return super.on(event, listener);
  }

  off(event: EngineEvent, listener: (data: unknown) => void): this {
    return super.off(event, listener);
  }
}

export function createEventBus(): ClubEventBus {
  return new ClubEventBus();
}
