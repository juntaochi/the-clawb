import { buildApp } from "./app.js";
import { setupSocketServer } from "./socket/index.js";

const port = Number(process.env.PORT) || 3001;
const { app, agentStore, chatStore, engine, bus } = buildApp();

app.listen({ port, host: "0.0.0.0" }, (err: Error | null, address: string) => {
  if (err) { console.error(err); process.exit(1); }
  setupSocketServer(app.server, engine, agentStore, chatStore, bus);
  console.log(`The Clawb server listening on ${address}`);
});
