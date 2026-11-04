import { expect, test } from "bun:test";
import { statusProgress } from "./status-progress";

test("groups every ticket by its configured status, retaining custom names and colors", () => {
  const ready = { id: "ready", name: "Ready to start", color: "purple", icon: "circle" };
  const review = { id: "review", name: "Checking", color: "yellow", icon: "eye" };
  expect(statusProgress([{ status: ready }, { status: review }, { status: ready }, { status: null }])).toEqual([
    { id: "ready", name: "Ready to start", color: "purple.fg", count: 2 },
    { id: "review", name: "Checking", color: "yellow.fg", count: 1 },
    { id: null, name: "No status", color: "fg.muted", count: 1 },
  ]);
  expect(statusProgress([])).toEqual([]);
});
