import { buildApp } from "./app.js";
import { setupSocketServer } from "./socket/index.js";

const port = Number(process.env.PORT) || 3001;
const { app, agentStore, chatStore, engine } = buildApp();

app.listen({ port, host: "0.0.0.0" }, (err: Error | null, address: string) => {
  if (err) { console.error(err); process.exit(1); }

  const io = setupSocketServer(app.server, engine, agentStore, chatStore);

  engine.setEventCallback((event, data) => {
    const agentNsp = io.of("/agent");
    const audienceNsp = io.of("/audience");

    switch (event) {
      case "session:start":
      case "session:warning":
      case "session:end":
        agentNsp.emit(event, data);
        audienceNsp.emit("session:change", data);
        break;
      case "code:update":
        audienceNsp.emit("code:update", data);
        break;
      case "queue:update":
        audienceNsp.emit("queue:update", data);
        break;
    }
  });

  console.log(`The Clawb server listening on ${address}`);
});
