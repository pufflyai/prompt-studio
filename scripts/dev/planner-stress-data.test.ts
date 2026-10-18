import { expect, test } from "bun:test";
import {
  focusCount,
  focusFilter,
  stressTicketCount,
  stressTicketInput,
  stressTicketsInOrder,
  stressTitle,
  trackNames,
} from "./planner-stress-data";

test("the stress plan has 1,000 tickets with exactly 25 matching its saved filter", () => {
  const tickets = Array.from({ length: stressTicketCount }, (_, index) => ({ id: `ticket-${index}` }));
  const tracks = trackNames.map((_, index) => `track-${index}`);
  const inputs = tickets.map((_, index) => stressTicketInput(index, tickets, tracks));
  const needle = focusFilter.rules[0]!.value;
  expect(inputs).toHaveLength(1000);
  expect(inputs.filter(({ content }) => content.split("\n")[0]!.includes(needle))).toHaveLength(focusCount);
  expect(focusCount).toBe(25);
  expect(new Set(inputs.flatMap(({ tagIds }) => tagIds)).size).toBe(5);
  expect(inputs[0]!.content.length).toBeGreaterThan(1000);
  const rows = inputs.map((input, index) => ({ ...input, id: tickets[index]!.id, index }));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const roots = rows.filter(({ dependsOn }) => dependsOn.length === 0);
  const dependencies = rows.flatMap(({ dependsOn }) => dependsOn);
  expect(new Set(roots.flatMap(({ tagIds }) => tagIds)).size).toBe(5);
  expect(roots).toHaveLength(5);
  expect(dependencies).toHaveLength(995);
  expect(new Set(dependencies).size).toBe(995);
  expect(
    rows.every((row) =>
      row.dependsOn.every((id) => {
        const source = byId.get(id);
        return source && source.index < row.index && source.tagIds[0] === row.tagIds[0];
      }),
    ),
  ).toBe(true);
});

test("an interrupted seed resumes its existing prefix in creation order", () => {
  const tickets = Array.from({ length: 12 }, (_, index) => ({ id: `ticket-${index}`, title: stressTitle(index) }));
  expect(stressTicketsInOrder([...tickets].reverse())).toEqual(tickets);
  expect(() => stressTicketsInOrder([{ id: "other", title: "Real project work" }])).toThrow();
  expect(() => stressTicketsInOrder([tickets[1]!])).toThrow();
});
