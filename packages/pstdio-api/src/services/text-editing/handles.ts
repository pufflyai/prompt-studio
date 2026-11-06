import { createHmac, timingSafeEqual } from "node:crypto";
import { textFailure } from "./errors";
import type { TextConnection, TextMember } from "./types";

const signature = (connection: TextConnection, value: string) =>
  createHmac("sha256", connection.token).update(value).digest("base64url");
export const textHandle = (connection: TextConnection, member: TextMember, grantToken: string) => {
  const value = Buffer.from(JSON.stringify([member.id, grantToken, crypto.randomUUID()])).toString("base64url");
  return `${value}.${signature(connection, value)}`;
};
export const textHandleMember = (connection: TextConnection, handle: string) => {
  const [value, proof, ...extra] = handle.split(".");
  if (!value || !proof || extra.length)
    throw textFailure("session_closed", "This handle does not belong to the placement");
  const expected = Buffer.from(signature(connection, value));
  const actual = Buffer.from(proof);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw textFailure("session_closed", "This handle does not belong to the placement");
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString());
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
  } catch {}
  throw textFailure("session_closed", "Invalid text session handle");
};
