import type { AppSession } from "@/lib/auth/session";
import crypto from "crypto";

function createDeterministicUuid(value: string) {
  const hash = crypto.createHash("sha256").update(`wechat:${value}`).digest();

  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function getSessionUserId(session: AppSession) {
  return session.kind === "wechat" ? createDeterministicUuid(session.id) : session.id;
}
