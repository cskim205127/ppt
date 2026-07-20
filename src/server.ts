import express from "express";
import jobsRouter from "./routes/jobs";
import pipelineRouter from "./routes/pipeline";
import { requireSharedSecret } from "./lib/auth";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

// Some PaaS health checks probe "/" by default rather than a configured
// path (see railway.json's healthcheckPath for the explicit config) — keep
// this as a defensive fallback so an unconfigured root-path check doesn't
// 404 and get misread as "deploy failed".
app.get("/", (_req, res) => {
  res.status(200).json({ ok: true, service: "agent-runner" });
});

app.use("/jobs", requireSharedSecret, jobsRouter);
app.use(requireSharedSecret, pipelineRouter);

const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, () => {
  console.log(`[agent-runner] listening on :${PORT}`);

  if (!process.env.OPENAI_API_KEY) {
    console.warn("[agent-runner] WARNING: OPENAI_API_KEY is not set — /jobs requests will fail");
  }
  if (!process.env.RUNNER_SHARED_SECRET) {
    console.warn("[agent-runner] WARNING: RUNNER_SHARED_SECRET is not set — /healthz still works, /jobs will 500");
  }
});
