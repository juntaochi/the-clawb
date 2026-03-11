export type ChatRole = "agent" | "audience";

export interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
  role: ChatRole;
}

export class ChatStore {
  private messages: ChatMessage[] = [];
  private maxMessages = 200;

  add(from: string, text: string, role: ChatRole = "audience"): ChatMessage {
    const msg: ChatMessage = { from, text, timestamp: Date.now(), role };
    this.messages.push(msg);
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
    return msg;
  }

  recent(limit = 50): ChatMessage[] {
    return this.messages.slice(-limit);
  }
}
