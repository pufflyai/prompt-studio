import { sql } from "drizzle-orm";
import { sessions } from "../../db/schemas.pg";

// Compute from the stored row so concurrent starts and clock changes cannot reuse a run identity.
export const nextSessionRunStart = (timestamp: string) => sql<string>`to_char(
  greatest(${timestamp}::timestamptz, ${sessions.last_request_started}::timestamptz + interval '1 millisecond')
    at time zone 'UTC',
  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
)`;
