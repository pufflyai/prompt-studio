import { expect, test } from "bun:test";
import { sessionDisplayStatus } from "./session-display-status";

test("an empty conversation is pending until its first run begins", () => {
  const empty = { status: "completed", last_request_started: null, last_request_ended: null, agent_session_id: null };
  expect(sessionDisplayStatus(empty)).toBe("pending");
  expect(sessionDisplayStatus({ ...empty, status: "queued" })).toBe("queued");
  expect(sessionDisplayStatus({ ...empty, status: "in_progress", last_request_started: "now" })).toBe("in_progress");
  expect(sessionDisplayStatus({ ...empty, last_request_started: "before", last_request_ended: "now" })).toBe(
    "completed",
  );
});
