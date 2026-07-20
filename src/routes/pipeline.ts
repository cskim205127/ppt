import { Router, raw } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { extractTranscript } from "../lib/transcript";
import { extractPdfText } from "../lib/pdfExtract";
import { renderDeck } from "../lib/renderDeck";
import type { DeckOutline } from "../lib/outline";

const router = Router();

const YOUTUBE_URL_RE = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/i;

/**
 * Synchronous companion to the /jobs async pipeline — lets a caller (e.g.
 * an n8n AI Agent node) own the actual LLM call itself, using this only for
 * the two steps n8n structurally cannot do on its own: shelling out to
 * yt-dlp, and running pptxgenjs (native deps, no npm-install-at-runtime).
 * Both steps are fast (seconds), so no job/poll ceremony needed here.
 */
router.post("/transcript", async (req, res) => {
  const { youtubeUrl } = req.body ?? {};

  if (typeof youtubeUrl !== "string" || !YOUTUBE_URL_RE.test(youtubeUrl)) {
    res.status(400).json({ error: "youtubeUrl must be a valid YouTube watch/shorts/youtu.be URL" });
    return;
  }

  const scratchDir = path.join(os.tmpdir(), "transcript-" + randomUUID());
  try {
    const result = await extractTranscript(youtubeUrl, scratchDir);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: String(err instanceof Error ? err.message : err) });
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
});

/**
 * Raw-body route: n8n's HTTP Request node (contentType: 'binaryData') posts
 * the uploaded PDF's bytes directly as the request body, not JSON — this
 * route-specific `raw()` middleware runs instead of the app-level
 * express.json() (which only engages for an `application/json` content
 * type and otherwise no-ops), so req.body here is the raw file Buffer.
 * The original filename (if any) travels via a query param since it isn't
 * part of the binary body itself.
 */
router.post("/pdf-extract", raw({ type: "*/*", limit: "20mb" }), async (req, res) => {
  const buffer = req.body;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    res.status(400).json({ error: "Request body must be the raw PDF file bytes" });
    return;
  }

  const filename = typeof req.query.filename === "string" ? req.query.filename : undefined;

  try {
    const result = await extractPdfText(buffer, filename);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

function isValidOutline(body: unknown): body is DeckOutline {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  return typeof o.title === "string" && typeof o.subtitle === "string" && Array.isArray(o.slides);
}

router.post("/render", async (req, res) => {
  // n8n's Structured Output Parser wraps results in an "output" key
  // ({ output: {...} }) — accept either shape so the caller doesn't have
  // to remember to unwrap it in an extra Set node.
  const raw = req.body ?? {};
  const outline: unknown = isValidOutline(raw) ? raw : raw.output;

  if (!isValidOutline(outline)) {
    res.status(400).json({ error: "Body must be a DeckOutline (or { output: DeckOutline }) with title/subtitle/slides" });
    return;
  }

  const outPath = path.join(os.tmpdir(), `render-${randomUUID()}.pptx`);
  try {
    await renderDeck(outline, outPath);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader("Content-Disposition", `attachment; filename="deck.pptx"`);
    res.sendFile(outPath, (err) => {
      fs.rmSync(outPath, { force: true });
      if (err && !res.headersSent) {
        res.status(500).json({ error: "Failed to stream rendered file" });
      }
    });
  } catch (err) {
    fs.rmSync(outPath, { force: true });
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

export default router;
