// Check attachment navigation across projects with different Planner ticket prefixes.
import { expect, test } from "bun:test";
import { ticketTarget } from "../planner";
import { instructionTarget } from "./instruction-target";

const target = ticketTarget({ id: "current", shorthand: "PS-1", title: "Current ticket" });
const sibling = ticketTarget({ id: "sibling", shorthand: "PS-42", title: "Another ticket" });
const rows = [{ shorthand: "PS-42", target: sibling }];

test("opens the named Prompt Studio ticket for a relative attachment link", () => {
  expect(instructionTarget("../PS-42/files/plan.md", { target }, rows)).toEqual(sibling);
});

test("resolves ticket shorthands without case sensitivity", () => {
  expect(instructionTarget("../ps-42/ticket.md", { target }, rows)).toEqual(sibling);
});

test("keeps same-ticket attachments local and leaves external links alone", () => {
  expect(instructionTarget("files/plan.md", { target }, rows)).toEqual(target);
  expect(instructionTarget("https://example.com/PS-42/ticket.md", { target }, rows)).toBeUndefined();
  expect(instructionTarget("#instructions", { target }, rows)).toBeUndefined();
});

test("does not open the current ticket when the named ticket is missing", () => {
  expect(instructionTarget("../PS-99/ticket.md", { target }, rows)).toBeUndefined();
});
