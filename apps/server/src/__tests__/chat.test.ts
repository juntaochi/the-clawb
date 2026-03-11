import { describe, it, expect } from "vitest";
import { ChatStore } from "../stores/chat-store.js";
import { buildApp } from "../app.js";

describe("ChatStore", () => {
  it("stores messages with role field", () => {
    const store = new ChatStore();
    const msg = store.add("alice", "hello", "agent");
    expect(msg.role).toBe("agent");
    expect(msg.from).toBe("alice");
    expect(msg.text).toBe("hello");
    expect(msg.timestamp).toBeTypeOf("number");
  });

  it("defaults role to 'audience'", () => {
    const store = new ChatStore();
    const msg = store.add("bob", "hi");
    expect(msg.role).toBe("audience");
  });

  it("recent() returns messages with role", () => {
    const store = new ChatStore();
    store.add("agent1", "test", "agent");
    store.add("viewer", "wow", "audience");
    const recent = store.recent();
    expect(recent).toHaveLength(2);
    expect(recent[0].role).toBe("agent");
    expect(recent[1].role).toBe("audience");
  });
});

describe("chat REST routes include role", () => {
  it("POST /api/v1/chat/send returns message with agent role", async () => {
    const { app } = buildApp();

    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "chat-agent" },
    });
    const auth = { authorization: `Bearer ${reg.json().apiKey}` };

    await app.inject({
      method: "POST",
      url: "/api/v1/chat/send",
      headers: auth,
      payload: { text: "agent message" },
    });

    const chat = await app.inject({ method: "GET", url: "/api/v1/chat/recent" });
    const messages = chat.json().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("agent");
    expect(messages[0].from).toBe("chat-agent");
  });
});
