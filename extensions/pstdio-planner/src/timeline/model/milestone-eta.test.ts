import { expect, test } from "bun:test";
import { milestoneEta } from "./milestone-eta";

const tags = [
  {
    id: "default-complexity",
    name: "Complexity",
    options: [
      { id: "simple", sortOrder: 0 },
      { id: "moderate", sortOrder: 1 },
      { id: "complex", sortOrder: 2 },
    ],
  },
];

test("renaming the standard complexity property preserves its forecast", () => {
  expect(
    milestoneEta(
      rows,
      tags.map((tag) => ({ ...tag, name: "Effort" })),
      attempts,
      now,
    )?.remainingMs,
  ).toBe(6 * 60 * 60 * 1000);
});
const rows = [
  { id: "done", done: true, tagIds: ["simple"] },
  { id: "open", done: false, tagIds: ["complex"] },
];
const attempts = [{ ticketId: "done", createdAt: "2026-10-13T10:00:00Z" }];
const now = Date.parse("2026-10-13T12:00:00Z");

test("milestone ETA projects remaining complexity from observed completed work", () => {
  expect(milestoneEta(rows, tags, attempts, now)).toMatchObject({
    remainingMs: 6 * 60 * 60 * 1000,
    completedComplexity: 1,
    totalComplexity: 4,
    startedAt: "2026-10-13T10:00:00.000Z",
  });
  expect(
    milestoneEta(
      [
        { ...rows[0]!, tagIds: ["complex"] },
        { ...rows[1]!, tagIds: ["simple"] },
      ],
      tags,
      attempts,
      now,
    )?.remainingMs,
  ).toBe(40 * 60 * 1000);
});

test("milestone ETA waits for progress and an observed start without inventing a pace", () => {
  expect(
    milestoneEta(
      rows.map((row) => ({ ...row, done: false })),
      tags,
      attempts,
      now,
    ),
  ).toBeNull();
  expect(milestoneEta(rows, tags, [], now)).toBeNull();
  expect(milestoneEta(rows, tags, attempts, Date.parse(attempts[0]!.createdAt))).toBeNull();
  expect(milestoneEta([], tags, attempts, now)).toBeNull();
});

test("milestone ETA uses the first relevant attempt and keeps completed work at zero", () => {
  const starts = [
    ...attempts,
    { ticketId: "outside", createdAt: "2020-01-01T00:00:00Z" },
    { ticketId: "open", createdAt: "2026-10-13T11:00:00Z" },
  ];
  expect(milestoneEta(rows, tags, starts, now)?.remainingMs).toBe(6 * 60 * 60 * 1000);
  expect(
    milestoneEta(
      rows.map((row) => ({ ...row, done: true })),
      tags,
      [],
      now,
    )?.remainingMs,
  ).toBe(0);
});

test("milestone ETA supports configured complexity identities and unclassified tickets", () => {
  expect(milestoneEta([{ ...rows[0]!, tagIds: [] }, rows[1]!], tags, attempts, now)).toMatchObject({
    completedComplexity: 2,
    totalComplexity: 5,
    remainingMs: 3 * 60 * 60 * 1000,
  });
  expect(milestoneEta(rows, [], attempts, now)).toMatchObject({
    completedComplexity: 1,
    totalComplexity: 2,
    remainingMs: 2 * 60 * 60 * 1000,
  });
});
