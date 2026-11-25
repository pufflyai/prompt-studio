import type { CommandContext } from "@pstdio/sdk/extensions";
import { z } from "zod";
import { environment, type WindowRange, windows } from "./model";
import { checkConnection, request } from "./source";

const timestamp = z.string().regex(/^\d{19}$/);
const cursorSchema = z.object({
  start: timestamp,
  end: timestamp,
  seen: z.record(z.string().max(80), z.number().int().min(0).max(200)),
});
const fixedCode =
  /^(request_exception|renewal_(database|signing|service)_failed|sync_(initialize|snapshot|replay|submit|recover|subscription|document|cleanup)_failed|project_deletion_handoff_failed|asset_operation_failed)$/;
const causePart = "[A-Za-z0-9_.-]{1,48}(?::[A-Za-z0-9_.-]{1,48}){0,2}";
const redactedCause = new RegExp(`^${causePart}(?:<-${causePart})?$`);
const describeFailure = (line: string) => {
  let code = line;
  let cause: unknown;
  try {
    const entry = JSON.parse(line) as { body?: unknown; attributes?: { cause?: unknown } } | null;
    if (typeof entry?.body === "string") {
      code = entry.body;
      cause = entry.attributes?.cause;
    }
  } catch {
    /* Raw Loki encoding is also supported. */
  }
  if (!fixedCode.test(code)) return { code: "service_operation_failed" };
  return typeof cause === "string" && redactedCause.test(cause) ? { code, cause } : { code };
};
export const readFailures = async (ctx: CommandContext, range: WindowRange, before?: string) => {
  await checkConnection(ctx);
  const now = BigInt(Date.now()) * 1_000_000n;
  let cursor = {
    start: String(now - BigInt(windows[range]) * 1_000_000_000n),
    end: String(now),
    seen: {} as Record<string, number>,
  };
  if (before) {
    try {
      cursor = cursorSchema.parse(JSON.parse(Buffer.from(z.string().max(2048).parse(before), "base64url").toString()));
    } catch {
      throw new Error("Invalid failure cursor");
    }
  }
  if (
    BigInt(cursor.end) > now ||
    BigInt(cursor.start) > BigInt(cursor.end) ||
    BigInt(cursor.end) - BigInt(cursor.start) > 30n * 86400n * 1_000_000_000n
  )
    throw new Error("Invalid failure window");
  const search = new URLSearchParams({
    query: `{environment="${environment}",service=~"relay|manager"}`,
    direction: "backward",
    start: cursor.start,
    end: before ? String(BigInt(cursor.end) + 1n) : cursor.end,
    limit: "200",
  });
  const body = z
    .object({
      status: z.literal("success"),
      data: z.object({
        result: z
          .array(
            z.object({
              stream: z.object({ service: z.enum(["relay", "manager"]) }),
              values: z.array(z.tuple([timestamp, z.string().max(4096)])).max(200),
            }),
          )
          .max(50),
      }),
    })
    .parse(await request(ctx, `/loki/api/v1/query_range?${search}`));
  const page = body.data.result
    .flatMap((stream) =>
      stream.values.map(([timestamp, line]) => ({
        timestamp,
        service: stream.stream.service,
        ...describeFailure(line),
      })),
    )
    .sort(
      (a, b) =>
        b.timestamp.localeCompare(a.timestamp) || a.service.localeCompare(b.service) || a.code.localeCompare(b.code),
    )
    .slice(0, 200);
  const skipped: Record<string, number> = {};
  const rows = page.filter((row) => {
    const key = `${row.service}:${row.code}`;
    if (row.timestamp !== cursor.end) return true;
    skipped[key] = (skipped[key] ?? 0) + 1;
    return skipped[key] > (cursor.seen[key] ?? 0);
  });
  const oldest = page.at(-1)?.timestamp;
  const seen: Record<string, number> = {};
  for (const row of page)
    if (row.timestamp === oldest) {
      const key = `${row.service}:${row.code}`;
      seen[key] = (seen[key] ?? 0) + 1;
    }
  const boundaryLimited = page.length === 200 && Object.values(seen).reduce((sum, count) => sum + count, 0) === 200;
  const next =
    page.length === 200 && oldest && !boundaryLimited
      ? Buffer.from(JSON.stringify({ start: cursor.start, end: oldest, seen })).toString("base64url")
      : null;
  return { rows, next, boundaryLimited, truncated: page.length === 200 };
};
