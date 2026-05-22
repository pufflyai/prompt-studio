import { describe, expect, test } from "bun:test";
import { filterContributionsForSlot, getSlotContributionsForSlots, orderContributions } from "./contribution-mapping";
import type { DashboardExtensionMetadata } from "./types";

const metadata: DashboardExtensionMetadata = {
  commands: [],
  diagnostics: [],
  extensions: [],
  menuContributions: [
    { id: "two", extensionId: "lab", commandId: "lab.two", slotId: "project.headerPrimary", label: "Two" },
    {
      id: "one",
      extensionId: "lab",
      commandId: "lab.one",
      slotId: "project.headerPrimary",
      label: "One",
      placement: "first",
    },
    {
      id: "three",
      extensionId: "lab",
      commandId: "lab.three",
      slotId: "project.headerOverflow",
      label: "Three",
    },
  ],
  navigation: [],
  routes: [],
  settingsPanels: [],
  views: [],
};

describe("contribution mapping", () => {
  test("filters contributions to the requested slot", () => {
    expect(
      filterContributionsForSlot(metadata.menuContributions, "project.headerPrimary").map((item) => item.id),
    ).toEqual(["two", "one"]);
  });

  test("orders first, default, and last placements stably", () => {
    expect(
      orderContributions([
        { id: "default", slotId: "slot", placement: "default" },
        { id: "last", slotId: "slot", placement: "last" },
        { id: "first", slotId: "slot", placement: "first" },
      ]).map((item) => item.id),
    ).toEqual(["first", "default", "last"]);
  });

  test("collects ordered contributions from multiple slots", () => {
    expect(
      getSlotContributionsForSlots(metadata.menuContributions, ["project.headerPrimary", "project.headerOverflow"]).map(
        (item) => item.id,
      ),
    ).toEqual(["one", "two", "three"]);
  });
});
