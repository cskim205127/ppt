import { Router } from "express";
import { randomUUID } from "crypto";
import { createJob, getJob, updateJob } from "../lib/jobStore";
import { runDeckJob } from "../lib/openaiRunner";

const router = Router();

const MAX_CONCURRENT_JOBS = Number(process.env.MAX_CONCURRENT_JOBS ?? 1);
let runningCount = 0;

const YOUTUBE_URL_RE = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/i;

router.post("/", (req, res) => {
  const { youtubeUrl, deliverTo } = req.body ?? {};

  if (typeof youtubeUrl !== "string" || !YOUTUBE_URL_RE.test(youtubeUrl)) {
    res.status(400).json({ error: "youtubeUrl must be a valid YouTube watch/shorts/youtu.be URL" });
    return;
  }

  if (runningCount >= MAX_CONCURRENT_JOBS) {
    res.status(429).json({ error: "Too many jobs in flight, try again shortly" });
    return;
  }

  const jobId = randomUUID();
  const job = createJob(jobId, youtubeUrl, deliverTo);

  res.status(201).json({ jobId: job.jobId, statusUrl: `/jobs/${job.jobId}` });

  // Fire-and-forget: the HTTP response above is the ack, not the result.
  // n8n (or any caller) is expected to poll GET /jobs/:id per the plan's
  // async job+poll pattern — a full agent build can take several minutes.
  runningCount += 1;
  updateJob(jobId, { status: "running" });
  runDeckJob(job)
    .then((result) => {
      if (result.success) {
        updateJob(jobId, {
          status: "succeeded",
          videoTitle: result.videoTitle,
          costUsd: result.costUsd,
          numTurns: result.numTurns,
        });
      } else {
        updateJob(jobId, {
          status: "failed",
          error: result.error,
          costUsd: result.costUsd,
          numTurns: result.numTurns,
        });
      }
    })
    .catch((err) => {
      updateJob(jobId, { status: "failed", error: `Unhandled runner error: ${String(err)}` });
    })
    .finally(() => {
      runningCount -= 1;
    });
});

router.get("/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Unknown jobId" });
    return;
  }
  res.json({
    jobId: job.jobId,
    status: job.status,
    videoTitle: job.videoTitle,
    error: job.error,
    costUsd: job.costUsd,
    numTurns: job.numTurns,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    resultFileUrl: job.status === "succeeded" ? `/jobs/${job.jobId}/file` : undefined,
  });
});

router.get("/:id/file", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Unknown jobId" });
    return;
  }
  if (job.status !== "succeeded") {
    res.status(404).json({ error: `Job status is '${job.status}', not 'succeeded' yet` });
    return;
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${job.jobId}.pptx"`);
  res.sendFile(job.outputPath, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: "Failed to stream output file" });
    }
  });
});

export default router;
