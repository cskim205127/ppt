import fs from "fs";
import path from "path";

/**
 * Vertex AI auth needs GOOGLE_APPLICATION_CREDENTIALS to point at a service
 * account JSON key *file* on disk. Railway (like most PaaS env-var stores)
 * only holds strings, not files, so the key is stored as a base64-encoded
 * string in GOOGLE_APPLICATION_CREDENTIALS_JSON and materialized to a file
 * here at boot — never baked into the image, only injected at runtime.
 * No-op if that env var isn't set (e.g. still using direct ANTHROPIC_API_KEY).
 */
export function materializeGcpCredentialsIfPresent(): void {
  const encoded = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!encoded) return;

  const keyPath = path.join("/tmp", "gcp-service-account.json");
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");

  // Validate it's actually JSON before writing — a bad copy/paste here
  // should fail loudly at boot, not surface as a confusing Vertex auth
  // error deep inside a job run later.
  JSON.parse(decoded);

  fs.writeFileSync(keyPath, decoded, { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
  console.log(`[agent-runner] GCP service account key materialized at ${keyPath}`);
}
