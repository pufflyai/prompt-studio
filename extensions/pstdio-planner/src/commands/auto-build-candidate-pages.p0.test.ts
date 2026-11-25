import { expect, test } from "bun:test";
import { waitingPage } from "./auto-build-candidate-pages.fixture";
import { autoBuildCandidatesCommand } from "./auto-build-candidates";
import { readAutoBuildCommand } from "./auto-build-mode";
import { autoBuildScopeCommand } from "./auto-build-scope";
import { nextTicketsCommand } from "./next-tickets";

test("unpaged candidate reads discover ready work after a full waiting page", async () => {
  const f = await waitingPage();
  const candidates = await autoBuildCandidatesCommand.run(f.ctx, {});
  expect(candidates.candidates.map(({ id }) => id)).toEqual(["ticket-100"]);
}, 15_000);

test("idle mode does not report stuck when ready work follows a waiting page", async () => {
  const f = await waitingPage();
  const mode = await readAutoBuildCommand.run(f.ctx, {});
  expect({ ready: mode.readyTicketCount, stuck: mode.stuck }).toEqual({ ready: 1, stuck: false });
}, 15_000);

test("saving an unpaged work scope includes ready work after waiting tickets", async () => {
  const f = await waitingPage();
  const scope = await autoBuildScopeCommand.run(f.ctx, { revision: "test", queries: [{}] });
  expect(scope.tickets.map(({ id }) => id)).toEqual(["ticket-100"]);
  expect(scope.waiting).toHaveLength(100);
}, 15_000);

test("the CLI retains bounded waiting pages and an explicit continuation", async () => {
  const f = await waitingPage();
  const first = await nextTicketsCommand.run(f.ctx, {});
  expect(first.tickets).toEqual([]);
  expect(first.waiting).toHaveLength(100);
  expect(first.nextOffset).toBe(100);
  const next = await nextTicketsCommand.run(f.ctx, { offset: first.nextOffset!, revision: first.queryRevision });
  expect(next.tickets.map(({ id }) => id)).toEqual(["ticket-100"]);
  expect(next.nextOffset).toBeNull();
}, 15_000);
