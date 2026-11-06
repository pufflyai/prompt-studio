import type { StorageLogRead } from "pstdio-sync-contracts";
import { decodeText, encodeText } from "../shared";

export interface LogCursor {
  version: 1;
  address: string;
  relay: number;
  index: number;
  local: number;
}
const integer = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
/** SQL batch positions use int32; this marks every entry of an observed relay batch consumed. */
export const logBatchEnd = 2_147_483_647;
export const decodeLogCursor = (address: string, cursor: StorageLogRead["after"]) => {
  if (cursor === undefined || cursor === 0) return { version: 1 as const, address, relay: 0, index: 0, local: 0 };
  let parsed: LogCursor;
  try {
    parsed = JSON.parse(decodeText(cursor.replaceAll("-", "+").replaceAll("_", "/")));
  } catch {
    throw new Error("Invalid log cursor");
  }
  if (
    parsed.version !== 1 ||
    parsed.address !== address ||
    !integer(parsed.relay) ||
    !integer(parsed.index) ||
    parsed.index > logBatchEnd ||
    !integer(parsed.local)
  )
    throw new Error("Invalid log cursor");
  return parsed;
};
export const encodeLogCursor = (cursor: LogCursor) =>
  encodeText(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
export const logPageLimit = (limit = 50) => {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
    throw new Error("A log page reads between 1 and 1000 entries");
  return limit;
};
