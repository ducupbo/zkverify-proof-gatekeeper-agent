import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-agent-games-signature";

function decodeSignature(value: string | undefined): Buffer | null {
  if (!value) return null;
  const normalized = value.startsWith("sha256=") ? value.slice("sha256=".length) : value;
  if (!/^[a-fA-F0-9]{64}$/.test(normalized)) return null;
  return Buffer.from(normalized, "hex");
}

export function verifyRequestSignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  const received = decodeSignature(signature);
  if (!received || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function signResponse(rawBody: Buffer, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}
