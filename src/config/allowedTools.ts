/**
 * Single source of truth for the unattended agent's tool allowlist.
 * MUST be mirrored into ../../.claude/settings.json's permissions.allow —
 * the SDK call and the baked-in project settings are two independent
 * enforcement layers (belt-and-suspenders for a headless, no-human-approver
 * deployment). Keep both lists in sync by hand; there is no single-file
 * source shared between the TS runtime and the JSON settings file.
 *
 * Deliberately omits WebFetch/WebSearch and Bash(npm *): deck-rendering
 * npm deps are pre-baked into the image (see Dockerfile), so the agent
 * never needs network/install access mid-job — narrower allowlist, lower
 * blast radius for an endpoint nobody is watching in real time.
 *
 * TODO (needs real-environment verification, not guessed): pptx/pdf are
 * now installed via the official plugin mechanism (not vendored — see
 * Dockerfile), so their scripts live under a versioned/hashed plugin cache
 * path we can't pin ahead of time. The narrow patterns below (copied from
 * when scripts were vendored at known relative paths) will likely NOT
 * match the real invocation paths once the agent actually runs the pptx
 * skill's soffice.py/markitdown calls from the plugin cache location.
 * Widening this requires the user's explicit sign-off (a prior attempt to
 * broaden to "Bash(python *)" was blocked by the permission classifier as
 * too broad for an unattended dontAsk agent) — resolve by observing the
 * REAL command strings Claude issues in a deployed test run, then add
 * narrow patterns matching those exact paths/script names.
 */
export const ALLOWED_TOOLS: string[] = [
  "Bash(yt-dlp *)",
  "Bash(python scripts/yt_transcript.py *)",
  "Bash(python -m markitdown *)",
  "Bash(python scripts/office/soffice.py *)",
  "Bash(python scripts/office/*.py *)",
  "Bash(pdftoppm *)",
  "Bash(node *)",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
];

// pptx/pdf come from the official document-skills plugin (installed at
// image-build time in the Dockerfile), not from a vendored project copy —
// see plugin:skill qualified form.
export const ENABLED_SKILLS: string[] = [
  "sources-to-deck",
  "document-skills:pptx",
  "document-skills:pdf",
];
