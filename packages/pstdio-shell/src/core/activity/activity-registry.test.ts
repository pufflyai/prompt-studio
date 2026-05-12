import { describe, expect, test } from "bun:test";
import { createActivityRegistry } from "./activity-registry";

describe("createActivityRegistry", () => {
  test("records resource-linked activity with contribution metadata", () => {
    const activity = createActivityRegistry();

    activity.registerKind(
      {
        kind: "extension-lab.counter.bumped",
        title: "Counter bumped",
        icon: "circle-plus",
      },
      { source: "extension", ownerId: "pstdio.extension-lab" },
    );
    activity.emit({
      id: "a1",
      kind: "extension-lab.counter.bumped",
      title: "Lab counter bumped",
      createdAt: "2026-05-12T12:00:00.000Z",
      resource: { kind: "extension-lab.counter", uri: "pstdio://extension/pstdio.extension-lab/counter" },
    });

    expect(activity.listItems({ resourceUri: "pstdio://extension/pstdio.extension-lab/counter" })).toMatchObject([
      {
        id: "a1",
        source: "extension",
        ownerId: "pstdio.extension-lab",
      },
    ]);
  });
});
