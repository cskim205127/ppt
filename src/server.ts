import express from "express";
import jobsRouter from "./routes/jobs";
import { requireSharedSecret } from "./lib/auth";
import { materializeGcpCredentialsIfPresent } from "./lib/gcpCredentials";

// Must run before anything touches the Agent SDK — it sets
// GOOGLE_APPLICATION_CREDENTIALS as a side effect that later code reads.
materializeGcpCredentialsIfPresent();

const app = express();
app.use(express.json());

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

const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, () => {
  console.log(`[agent-runner] listening on :${PORT}`);

  const usingVertex = process.env.CLAUDE_CODE_USE_VERTEX === "1";
  if (usingVertex) {
    if (!process.env.ANTHROPIC_VERTEX_PROJECT_ID || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.warn(
        "[agent-runner] WARNING: CLAUDE_CODE_USE_VERTEX=1 but ANTHROPIC_VERTEX_PROJECT_ID or " +
          "GOOGLE_APPLICATION_CREDENTIALS_JSON is missing — /jobs requests will fail"
      );
    } else {
      console.log(`[agent-runner] Using Vertex AI (project: ${process.env.ANTHROPIC_VERTEX_PROJECT_ID})`);
    }
  } else if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "[agent-runner] WARNING: neither ANTHROPIC_API_KEY nor CLAUDE_CODE_USE_VERTEX is set — /jobs requests will fail"
    );
  }

  if (!process.env.RUNNER_SHARED_SECRET) {
    console.warn("[agent-runner] WARNING: RUNNER_SHARED_SECRET is not set — /healthz still works, /jobs will 500");
  }
});
