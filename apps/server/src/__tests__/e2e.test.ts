import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildApp } from "../app.js";

describe("e2e: agent registers, books slot, pushes code", () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it("full DJ session flow", async () => {
    const { app } = buildApp();

    // 1. Register
    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "e2e-dj" },
    });
    expect(reg.statusCode).toBe(201);
    const { apiKey } = reg.json();
    const auth = { authorization: `Bearer ${apiKey}` };

    // 2. Check idle state
    const status1 = await app.inject({ method: "GET", url: "/api/v1/slots/status" });
    expect(status1.json().dj.status).toBe("idle");

    // 3. Book DJ slot
    const book = await app.inject({
      method: "POST",
      url: "/api/v1/slots/book",
      headers: auth,
      payload: { type: "dj" },
    });
    expect(book.statusCode).toBe(200);

    // 4. Check active state
    const status2 = await app.inject({ method: "GET", url: "/api/v1/slots/status" });
    expect(status2.json().dj.status).toBe("active");
    expect(status2.json().dj.agent.name).toBe("e2e-dj");

    // 5. Get current code
    const session = await app.inject({ method: "GET", url: "/api/v1/sessions/current" });
    expect(session.json().djCode).toContain("note");

    // 6. Push new code
    const push = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/code",
      headers: auth,
      payload: { type: "dj", code: 'note("c4 e4 g4").sound("sine")' },
    });
    expect(push.statusCode).toBe(200);
    expect(push.json().ok).toBe(true);

    // 7. Verify code updated
    const session2 = await app.inject({ method: "GET", url: "/api/v1/sessions/current" });
    expect(session2.json().djCode).toBe('note("c4 e4 g4").sound("sine")');
  });

  it("full VJ session flow", async () => {
    const { app } = buildApp();

    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "e2e-vj" },
    });
    const { apiKey } = reg.json();
    const auth = { authorization: `Bearer ${apiKey}` };

    // Book VJ slot
    await app.inject({
      method: "POST",
      url: "/api/v1/slots/book",
      headers: auth,
      payload: { type: "vj" },
    });

    const status = await app.inject({ method: "GET", url: "/api/v1/slots/status" });
    expect(status.json().vj.status).toBe("active");
    expect(status.json().vj.agent.name).toBe("e2e-vj");

    // Push VJ code
    const push = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/code",
      headers: auth,
      payload: { type: "vj", code: 'osc(10).color(1,0,0).out()' },
    });
    expect(push.json().ok).toBe(true);

    const session = await app.inject({ method: "GET", url: "/api/v1/sessions/current" });
    expect(session.json().vjCode).toBe('osc(10).color(1,0,0).out()');
  });

  it("queue works: second agent waits, takes over after first expires", async () => {
    const { app } = buildApp();

    // Register two agents
    const reg1 = await app.inject({ method: "POST", url: "/api/v1/agents/register", payload: { name: "dj-first" } });
    const reg2 = await app.inject({ method: "POST", url: "/api/v1/agents/register", payload: { name: "dj-second" } });
    const auth1 = { authorization: `Bearer ${reg1.json().apiKey}` };
    const auth2 = { authorization: `Bearer ${reg2.json().apiKey}` };

    // Both book DJ
    await app.inject({ method: "POST", url: "/api/v1/slots/book", headers: auth1, payload: { type: "dj" } });
    await app.inject({ method: "POST", url: "/api/v1/slots/book", headers: auth2, payload: { type: "dj" } });

    // First is active
    let status = await app.inject({ method: "GET", url: "/api/v1/slots/status" });
    expect(status.json().dj.agent.name).toBe("dj-first");
    expect(status.json().queue.length).toBeGreaterThan(0);

    // First agent pushes code
    await app.inject({ method: "POST", url: "/api/v1/sessions/code", headers: auth1, payload: { type: "dj", code: 'note("first")' } });

    // Expire first session
    vi.advanceTimersByTime(15 * 60 * 1000);

    // Second is now active with first's code
    status = await app.inject({ method: "GET", url: "/api/v1/slots/status" });
    expect(status.json().dj.agent.name).toBe("dj-second");

    const session = await app.inject({ method: "GET", url: "/api/v1/sessions/current" });
    expect(session.json().djCode).toBe('note("first")');
  });

  it("chat flow", async () => {
    const { app } = buildApp();

    const reg = await app.inject({ method: "POST", url: "/api/v1/agents/register", payload: { name: "chatty" } });
    const auth = { authorization: `Bearer ${reg.json().apiKey}` };

    await app.inject({ method: "POST", url: "/api/v1/chat/send", headers: auth, payload: { text: "hello rave!" } });

    const chat = await app.inject({ method: "GET", url: "/api/v1/chat/recent" });
    expect(chat.json().messages).toHaveLength(1);
    expect(chat.json().messages[0].from).toBe("chatty");
    expect(chat.json().messages[0].text).toBe("hello rave!");
  });
});
