import path from "path";
import { extractTranscript } from "./transcript";
import { generateOutline } from "./outline";
import { renderDeck } from "./renderDeck";
import type { JobRecord } from "./jobStore";

export interface RunResult {
  success: boolean;
  videoTitle?: string;
  costUsd?: number;
  numTurns?: number;
  error?: string;
}

/**
 * Deterministic (non-agentic) pipeline: yt-dlp transcript -> OpenAI
 * structured outline (always Korean output, regardless of source language)
 * -> pptxgenjs template rendering. Replaces the earlier Claude Agent SDK
 * version — see memory/plan docs for why (Anthropic billing was never
 * successfully enabled for this deployment).
 */
export async function runDeckJob(job: JobRecord): Promise<RunResult> {
  try {
    const transcriptDir = path.join(job.jobDir, "transcript");
    const { title, transcript } = await extractTranscript(job.youtubeUrl, transcriptDir);

    const outline = await generateOutline(title, transcript);

    await renderDeck(outline, job.outputPath);

    return { success: true, videoTitle: title };
  } catch (err) {
    return { success: false, error: String(err instanceof Error ? err.message : err) };
  }
}
