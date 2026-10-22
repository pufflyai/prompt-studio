import { expect, test } from "bun:test";
import { milestoneEta, projectPace } from "./milestone-eta";

function estimate(
  rows: Parameters<typeof milestoneEta>[0],
  tags: Parameters<typeof milestoneEta>[1],
  attempts: Parameters<typeof projectPace>[2],
  now: number,
) {
  return milestoneEta(rows, tags, projectPace(rows, tags, attempts, now));
}

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
    estimate(
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
  expect(estimate(rows, tags, attempts, now)).toMatchObject({
    remainingMs: 6 * 60 * 60 * 1000,
    completedComplexity: 1,
    totalComplexity: 4,
    startedAt: "2026-10-13T10:00:00.000Z",
  });
  expect(
    estimate(
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
    estimate(
      rows.map((row) => ({ ...row, done: false })),
      tags,
      attempts,
      now,
    ),
  ).toBeNull();
  expect(estimate(rows, tags, [], now)).toBeNull();
  expect(estimate(rows, tags, attempts, Date.parse(attempts[0]!.createdAt))).toBeNull();
  expect(estimate([], tags, attempts, now)).toBeNull();
});

test("milestone ETA uses the first relevant attempt and keeps completed work at zero", () => {
  const starts = [
    ...attempts,
    { ticketId: "outside", createdAt: "2020-01-01T00:00:00Z" },
    { ticketId: "open", createdAt: "2026-10-13T11:00:00Z" },
  ];
  expect(estimate(rows, tags, starts, now)?.remainingMs).toBe(6 * 60 * 60 * 1000);
  expect(
    estimate(
      rows.map((row) => ({ ...row, done: true })),
      tags,
      [],
      now,
    )?.remainingMs,
  ).toBe(0);
});

test("milestone ETA supports configured complexity identities and unclassified tickets", () => {
  expect(estimate([{ ...rows[0]!, tagIds: [] }, rows[1]!], tags, attempts, now)).toMatchObject({
    completedComplexity: 2,
    totalComplexity: 5,
    remainingMs: 3 * 60 * 60 * 1000,
  });
  expect(estimate(rows, [], attempts, now)).toMatchObject({
    completedComplexity: 1,
    totalComplexity: 2,
    remainingMs: 2 * 60 * 60 * 1000,
  });
});
