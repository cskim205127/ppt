import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

export interface TranscriptResult {
  title: string;
  channel: string;
  transcript: string;
}

async function run(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("yt-dlp", args, { maxBuffer: 1024 * 1024 * 50 });
    return { stdout, stderr, code: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? String(err), code: err.code ?? 1 };
  }
}

function findVtt(dir: string): string | undefined {
  const match = fs.readdirSync(dir).find((f) => f.startsWith("_sub") && f.endsWith(".vtt"));
  return match ? path.join(dir, match) : undefined;
}

/** Try manual subs first, then auto-subs, for a given language spec ("en,ko" then "all" fallback). */
async function downloadSubs(url: string, outDir: string): Promise<string | undefined> {
  const tmpl = path.join(outDir, "_sub.%(ext)s");

  for (const langSpec of ["en,ko", "all"]) {
    for (const writeFlag of ["--write-subs", "--write-auto-subs"]) {
      await run(["--skip-download", "--sub-format", "vtt", "--sub-langs", langSpec, "-o", tmpl, writeFlag, url]);
      const vtt = findVtt(outDir);
      if (vtt) return vtt;
    }
  }
  return undefined;
}

function parseVtt(raw: string): string {
  const lines: string[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const s = rawLine.trim();
    if (!s) continue;
    if (s.startsWith("WEBVTT") || s.startsWith("Kind:") || s.startsWith("Language:") || s.startsWith("NOTE")) continue;
    if (s.includes("-->")) continue;
    if (/^\d+$/.test(s)) continue;
    const cleaned = s.replace(/<[^>]+>/g, "").trim();
    if (cleaned) lines.push(cleaned);
  }

  const deduped: string[] = [];
  for (const s of lines) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== s) deduped.push(s);
  }
  return deduped.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Extracts a YouTube video's transcript via yt-dlp. Language-agnostic by
 * design (tries en/ko first, falls back to any available track) — the
 * downstream outline step always produces Korean output regardless of the
 * source caption language, so grabbing whatever track exists beats failing
 * outright when a video has captions in some other language.
 */
export async function extractTranscript(youtubeUrl: string, outDir: string): Promise<TranscriptResult> {
  fs.mkdirSync(outDir, { recursive: true });

  const meta = await run(["--skip-download", "--print", "%(title)s\t%(channel)s", youtubeUrl]);
  if (meta.code !== 0) {
    throw new Error(`Could not read video metadata: ${meta.stderr.trim()}`);
  }
  const [title, channel] = meta.stdout.trim().split("\t");

  const vttPath = await downloadSubs(youtubeUrl, outDir);
  if (!vttPath) {
    throw new Error("No subtitles/captions available for this video (neither manual nor auto-generated).");
  }

  const raw = fs.readFileSync(vttPath, "utf-8");
  const transcript = parseVtt(raw);
  fs.rmSync(vttPath, { force: true });

  if (!transcript) {
    throw new Error("Subtitle track was found but produced empty text after parsing.");
  }

  return { title: title || "youtube_video", channel: channel || "", transcript };
}
