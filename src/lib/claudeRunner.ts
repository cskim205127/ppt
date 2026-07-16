import fs from "fs";
import path from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { ALLOWED_TOOLS, ENABLED_SKILLS } from "../config/allowedTools";
import { buildDeckPrompt } from "./promptTemplate";
import type { JobRecord } from "./jobStore";

// Project root that holds .claude/skills + .claude/settings.json — fixed
// across every job so skill discovery is reliable (see plan §1: "cwd is
// fixed; the job-scoped path is only where the agent's own file work
// happens, passed via the prompt, not via cwd").
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const MAX_TURNS = Number(process.env.MAX_TURNS ?? 80);
const MAX_BUDGET_USD = Number(process.env.MAX_BUDGET_USD ?? 5);
const CLAUDE_MODEL = process.env.CLAUDE_MODEL; // undefined = SDK default

export interface RunResult {
  success: boolean;
  costUsd?: number;
  numTurns?: number;
  error?: string;
}

/**
 * Runs one full agent session for a job and returns once the SDK's async
 * generator is exhausted. The caller (routes/jobs.ts) is responsible for
 * the file-existence check at job.outputPath — this function reports what
 * the SDK itself observed (cost, turns, permission denials, final result
 * message), but never treats agent text as the pass/fail signal.
 */
export async function runDeckJob(job: JobRecord): Promise<RunResult> {
  const logPath = path.join(job.jobDir, "agent.log.jsonl");
  const logStream = fs.createWriteStream(logPath, { flags: "a" });

  const prompt = buildDeckPrompt(job);
  let finalResult: SDKResultMessage | undefined;

  try {
    const stream = query({
      prompt,
      options: {
        cwd: PROJECT_ROOT,
        settingSources: ["project"], // load PROJECT_ROOT/.claude/settings.json + CLAUDE.md
        allowedTools: ALLOWED_TOOLS,
        skills: ENABLED_SKILLS,
        permissionMode: "dontAsk", // no human present to approve anything outside the allowlist
        maxTurns: MAX_TURNS,
        maxBudgetUsd: MAX_BUDGET_USD,
        ...(CLAUDE_MODEL ? { model: CLAUDE_MODEL } : {}),
      },
    });

    for await (const message of stream as AsyncGenerator<SDKMessage, void>) {
      logStream.write(JSON.stringify(message) + "\n");
      if (message.type === "result") {
        finalResult = message as SDKResultMessage;
      }
    }
  } catch (err) {
    logStream.write(JSON.stringify({ type: "runner_exception", error: String(err) }) + "\n");
    logStream.end();
    return { success: false, error: `Agent SDK threw: ${String(err)}` };
  }
  logStream.end();

  if (!finalResult) {
    return { success: false, error: "Agent session ended with no result message" };
  }

  const outputExists = fs.existsSync(job.outputPath);
  const sdkReportedSuccess = finalResult.subtype === "success" && !finalResult.is_error;

  if (!outputExists) {
    return {
      success: false,
      costUsd: finalResult.total_cost_usd,
      numTurns: finalResult.num_turns,
      error: sdkReportedSuccess
        ? `SDK reported success but ${job.outputPath} was not created`
        : `subtype=${finalResult.subtype}; last message: ${
            "result" in finalResult ? finalResult.result : "(error result, no text)"
          }`,
    };
  }

  return {
    success: true,
    costUsd: finalResult.total_cost_usd,
    numTurns: finalResult.num_turns,
  };
}
