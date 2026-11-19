import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { StoredStatus } from "../../data/types";
import { buildPlan, type PlanInput } from "../../timeline/model/build-plan";
import { resolvePlan } from "../../timeline/model/resolve-plan";
import { timelineTicketProperties } from "../../timeline/model/ticket-properties";
import { selectiveTimelineEnrichment } from "./selective-enrichment";

const args = process.argv.slice(2);
assert(args.includes("--out"), "Pass --out <report filesPath>");
const output = resolve(args[args.indexOf("--out") + 1]);
await mkdir(output, { recursive: true });
const statuses: StoredStatus[] = [
  {
    id: "backlog",
    name: "Backlog",
    color: "gray",
    icon: "status-backlog",
    isDefault: true,
    sortOrder: 0,
    canCreate: true,
    columnActions: [],
  },
  {
    id: "done",
    name: "Done",
    color: "green",
    icon: "status-done",
    isDefault: false,
    sortOrder: 1,
    canCreate: false,
    columnActions: [],
  },
];
const workflow = {
  completedStatusIds: ["done"],
  blockedStatusIds: [],
  activeStatusIds: ["backlog"],
  mergeTargetStatusId: null,
};
const uses = {
  hidden: { display: ["priority"], filter: [], sort: [], group: [], action: [] },
  displayed: { display: ["milestone"], filter: [], sort: [], group: [], action: [] },
  hiddenFiltered: { display: ["priority"], filter: ["needsAttention"], sort: [], group: [], action: [] },
  hiddenSorted: { display: ["priority"], filter: [], sort: ["milestoneDate"], group: [], action: [] },
};
const rows: unknown[] = [];
for (const count of [100, 1000, 5000]) {
  for (const dense of [false, true]) {
    const tickets = Array.from({ length: count }, (_, n) => ({
      id: `ticket-${n}`,
      shorthand: `T-${n + 1}`,
      title: `Ticket ${n}`,
      content: "",
      statusId: n % 10 ? "backlog" : "done",
      parentId: dense && n > 1 && n % 7 === 0 ? `ticket-${n - 1}` : null,
      dependsOn: dense && n > 2 ? [`ticket-${n - 1}`, `ticket-${n - 2}`] : [],
    }));
    const input: PlanInput = {
      tickets,
      statuses,
      tags: [],
      workflow,
      plan: resolvePlan(undefined, tickets, statuses, workflow),
      today: "2026-11-17",
    };
    const control = timelineTicketProperties(buildPlan(input));
    for (const [name, use] of Object.entries(uses)) {
      const candidate = selectiveTimelineEnrichment(input, use);
      if (name === "hidden") assert.equal(candidate, undefined);
      else assert.deepEqual(candidate, control, `${name} must retain all required values`);
      for (let pass = 0; pass < 12; pass++) {
        for (const selected of pass % 2 ? [true, false] : [false, true]) {
          const started = performance.now();
          const result = selected
            ? selectiveTimelineEnrichment(input, use)
            : timelineTicketProperties(buildPlan(input));
          rows.push({
            count,
            dense,
            name,
            pass,
            selected,
            ms: performance.now() - started,
            enrichedTickets: result?.values.size ?? 0,
            scope: "Production buildPlan and property mapping only; excludes storage and relationship resolvers",
          });
        }
      }
    }
  }
}
await Bun.write(resolve(output, "samples.json"), JSON.stringify(rows, null, 2));
await Bun.write(
  resolve(output, "correctness.json"),
  JSON.stringify(
    {
      hiddenSkips: true,
      displayedParity: true,
      hiddenFilterParity: true,
      hiddenSortParity: true,
      unrun: [
        "real relationship provider resolution",
        "authoritative board counts",
        "automatic extraction of field dependencies",
        "application integration",
      ],
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ output, samples: rows.length, status: "passed" }));
