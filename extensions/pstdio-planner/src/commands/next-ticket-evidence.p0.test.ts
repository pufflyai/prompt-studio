import { expect, test } from "bun:test";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { findStoredTicket } from "../data/resolve";
import { waitingPage } from "./auto-build-candidate-pages.fixture";
import { readNextTicketEvidence } from "./next-ticket-evidence";

test("unstarted candidates read attempt history once while preserving pending dependency evidence", async () => {
  const { ctx, storage } = await waitingPage();
  const ticket = (await findStoredTicket(ctx, "ticket-000"))!;
  let attemptReads = 0;
  const query = storage.records.query;
  storage.records.query = async (input) => {
    if (input.index === "attempt-ticket") attemptReads++;
    return query(input);
  };

  const evidence = await readNextTicketEvidence(ctx, ticket, await readAutoBuildMode(ctx));
  expect(evidence.pending.map(({ id }) => id)).toEqual(["prerequisite"]);
  expect(evidence.attempts).toEqual([]);
  expect(evidence.resumption.size).toBe(0);
  expect(attemptReads).toBe(1);
});
