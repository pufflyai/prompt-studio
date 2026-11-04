import { buildPlan } from "../../src/timeline/model/build-plan";

export const milestones = [
  { id: "foundation", date: "2026-11-05", name: "Foundation", hours: 7 },
  { id: "preview", date: "2026-11-06", name: "Preview", hours: 2 },
  { id: "launch", date: "2026-11-09", name: "Launch", hours: 3 },
];

export const tickets = [
  { id: "schema", title: "Define project structure", milestone: "foundation", hours: 4, dependsOn: [] },
  { id: "navigation", title: "Build project navigation", milestone: "foundation", hours: 3, dependsOn: ["schema"] },
  { id: "preview", title: "Review the working preview", milestone: "preview", hours: 2, dependsOn: ["navigation"] },
  { id: "publish", title: "Publish the release", milestone: "launch", hours: 2, dependsOn: ["preview"] },
  { id: "docs", title: "Update the user guide", milestone: "launch", hours: 1, dependsOn: [] },
];

const original = buildPlan({
  statuses: [],
  tags: [],
  today: "2026-11-04",
  tickets: tickets.map((ticket, index) => ({ ...ticket, shorthand: `DEMO-${index + 1}`, content: "", statusId: null })),
  plan: {
    deadlines: milestones,
    order: tickets.map(({ id, milestone }) => ({ ticketId: id, deadlineId: milestone })),
  },
});

// Fixed example estimates, independent of the project's tickets and actual throughput.
let cumulativeHours = 0;
export const plan = {
  ...original,
  sections: original.sections
    .filter(({ deadline }) => deadline)
    .map((section, index) => {
      cumulativeHours += milestones[index].hours;
      return {
        ...section,
        eta: {
          remainingMs: cumulativeHours * 3_600_000,
          totalComplexity: section.rows.length,
          completedComplexity: 0,
          startedAt: null,
        },
      };
    }),
};

export const headerData = {
  rows: tickets.map(({ id, title }) => ({ id, title, attributes: {} })),
  attributes: [{ id: "title", label: "Title", type: { kind: "string" as const }, filterable: true }],
  storageKey: "proposal-PS-1060-timeline",
};
