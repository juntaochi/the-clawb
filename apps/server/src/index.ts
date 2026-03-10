import { buildApp } from "./app.js";

const port = Number(process.env.PORT) || 3001;
const { app } = buildApp();

app.listen({ port, host: "0.0.0.0" }, (err: Error | null, address: string) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`OpenClaw Rave server listening on ${address}`);
});
