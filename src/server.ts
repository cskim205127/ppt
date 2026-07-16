import express from "express";
import jobsRouter from "./routes/jobs";
import { requireSharedSecret } from "./lib/auth";

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use("/jobs", requireSharedSecret, jobsRouter);

const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, () => {
  console.log(`[agent-runner] listening on :${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[agent-runner] WARNING: ANTHROPIC_API_KEY is not set — /jobs requests will fail");
  }
  if (!process.env.RUNNER_SHARED_SECRET) {
    console.warn("[agent-runner] WARNING: RUNNER_SHARED_SECRET is not set — /healthz still works, /jobs will 500");
  }
});
