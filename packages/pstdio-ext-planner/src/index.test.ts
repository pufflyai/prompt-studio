import { describe, expect, test } from "bun:test";
import plannerExtension from "./index";

describe("planner extension definition", () => {
  test("does not expose a ticket source registry", () => {
    expect("ticketSources" in plannerExtension).toBe(false);
  });
});
