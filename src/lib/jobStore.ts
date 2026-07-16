import fs from "fs";
import path from "path";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface JobRecord {
  jobId: string;
  youtubeUrl: string;
  deliverTo?: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  videoTitle?: string;
  error?: string;
  costUsd?: number;
  numTurns?: number;
  jobDir: string;
  outputPath: string;
}

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..", "workspace", "jobs");

// v1: in-memory only. A container restart loses in-flight job status (the
// n8n poller would then 404 forever) — acceptable at low volume; documented
// as an open risk in the plan. Each job's status.json on disk is still
// written for post-mortem debugging, just not reloaded on process start.
const jobs = new Map<string, JobRecord>();

export function createJob(jobId: string, youtubeUrl: string, deliverTo?: string): JobRecord {
  const jobDir = path.join(WORKSPACE_ROOT, jobId);
  fs.mkdirSync(path.join(jobDir, "output"), { recursive: true });

  const now = new Date().toISOString();
  const record: JobRecord = {
    jobId,
    youtubeUrl,
    deliverTo,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    jobDir,
    outputPath: path.join(jobDir, "output", `${jobId}.pptx`),
  };
  jobs.set(jobId, record);
  persist(record);
  return record;
}

export function getJob(jobId: string): JobRecord | undefined {
  return jobs.get(jobId);
}

export function updateJob(jobId: string, patch: Partial<JobRecord>): JobRecord {
  const existing = jobs.get(jobId);
  if (!existing) {
    throw new Error(`Unknown jobId: ${jobId}`);
  }
  const updated: JobRecord = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  jobs.set(jobId, updated);
  persist(updated);
  return updated;
}

function persist(record: JobRecord): void {
  try {
    fs.writeFileSync(
      path.join(record.jobDir, "status.json"),
      JSON.stringify(record, null, 2),
      "utf-8"
    );
  } catch (err) {
    // Debugging aid only — never let a disk-write failure break the job.
    console.error(`[jobStore] failed to persist status for ${record.jobId}:`, err);
  }
}
