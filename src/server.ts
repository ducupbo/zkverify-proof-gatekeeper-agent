import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { SIGNATURE_HEADER, signResponse, verifyRequestSignature } from "./signature.js";

const PORT = Number(process.env.PORT ?? 3000);
const SECRET = process.env.AGENT_GAMES_HMAC_SECRET ?? "";
const MAX_BODY_BYTES = 256 * 1024;

type JsonRecord = Record<string, unknown>;

function sendJson(res: ServerResponse, status: number, value: JsonRecord): void {
  const raw = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(raw.length),
    [SIGNATURE_HEADER]: signResponse(raw, SECRET),
    "cache-control": "no-store",
  });
  res.end(raw);
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > MAX_BODY_BYTES) throw new Error("body_too_large");
    chunks.push(part);
  }
  return Buffer.concat(chunks);
}

function parseJson(raw: Buffer): JsonRecord | null {
  try {
    const value: unknown = JSON.parse(raw.toString("utf8"));
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonRecord)
      : null;
  } catch {
    return null;
  }
}

function expired(deadline: unknown): boolean {
  if (typeof deadline !== "string") return true;
  const timestamp = Date.parse(deadline);
  return !Number.isFinite(timestamp) || timestamp <= Date.now();
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;

  if (req.method === "GET" && path === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "POST" || path !== "/agent") {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  if (!SECRET) {
    res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "agent_secret_not_configured" }));
    return;
  }

  let raw: Buffer;
  try {
    raw = await readRawBody(req);
  } catch {
    sendJson(res, 413, { error: "body_too_large" });
    return;
  }

  const header = req.headers[SIGNATURE_HEADER];
  const signature = Array.isArray(header) ? header[0] : header;
  // Authenticate the exact bytes before parsing the envelope.
  if (!verifyRequestSignature(raw, signature, SECRET)) {
    sendJson(res, 401, { error: "invalid_signature" });
    return;
  }

  const envelope = parseJson(raw);
  if (!envelope) {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  if (envelope.type === "agent-games.preflight.v1") {
    sendJson(res, 200, { ok: true, protocolVersion: "v1" });
    return;
  }

  if (envelope.type === "agent-games.proof-gatekeeper.v1") {
    if (expired(envelope.deadline_at)) {
      sendJson(res, 503, { error: "task_deadline_expired" });
      return;
    }
    // The task proof verifier and decision-proof generator are intentionally
    // not stubbed with a guessed schema. See README before enabling scoring.
    sendJson(res, 503, { error: "proof_pipeline_not_configured" });
    return;
  }

  sendJson(res, 400, { error: "unsupported_task_type" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Gatekeeper scaffold listening on port ${PORT}`);
});
