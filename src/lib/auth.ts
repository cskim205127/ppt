import type { NextFunction, Request, Response } from "express";

/**
 * Every accepted /jobs request spends real Anthropic API budget, so this
 * endpoint must never be reachable without the shared secret — see plan
 * risk #9 ("endpoint exposure/auth").
 */
export function requireSharedSecret(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.RUNNER_SHARED_SECRET;
  if (!expected) {
    res.status(500).json({ error: "Server misconfigured: RUNNER_SHARED_SECRET not set" });
    return;
  }

  const header = req.header("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
