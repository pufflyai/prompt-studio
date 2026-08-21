import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { openPanelWidget } from "./panel-widget-open";

describe("openPanelWidget", () => {
  test("titles an added tab by its widget, not the location resource it binds to", () => {
    const workbench = createWorkbenchCore();

    workbench.layout.registerPanel({
      id: "chrome.overview",
      title: "Overview",
      region: "main",
      singleton: true,
      rendererId: "chrome.overview",
    });
    workbench.layout.registerPanel({
      id: "chrome.timeline",
      title: "Timeline",
      region: "main",
      singleton: true,
      eligibleLocations: {},
      resourceKinds: ["chrome.view"],
      rendererId: "chrome.timeline",
    });

    const location = {
      kind: "chrome.view",
      uri: "chrome://view/overview",
      id: "overview",
      label: "Overview",
    };
    workbench.layout.openPanel("chrome.overview", {
      resource: location,
      strategy: { kind: "persistent" },
    });

    openPanelWidget({
      workbench,
      widget: workbench.layout.getWidget("chrome.timeline")!,
      region: "main",
      resource: location,
    });

    const placement = workbench.layout
      .getLayout()
      .regions.main.widgets.find((candidate) => candidate.contributionId === "chrome.timeline");
    expect(placement?.title).toBe("Timeline");
    // The location resource still binds the tab to where it was added.
    expect(placement?.resourceUri).toBe(location.uri);
  });

  test("gives a composition panel the role implied by its destination region", () => {
    const workbench = createWorkbenchCore();

    workbench.layout.registerPanel({
      id: "lab.artifacts",
      title: "Artifacts",
      region: "main",
      singleton: true,
      rendererId: "lab.artifacts",
    });

    openPanelWidget({
      workbench,
      widget: workbench.layout.getWidget("lab.artifacts")!,
      region: "main",
    });

    expect(workbench.layout.getLayout().regions.main.widgets[0]?.role).toBe("location");
  });

  test("applies composition pinning when the user adds a panel", () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerPanel({ id: "timeline", title: "Timeline", region: "side", rendererId: "timeline" });

    openPanelWidget({
      workbench,
      widget: workbench.layout.getWidget("timeline")!,
      region: "side",
      pinned: true,
    });

    expect(workbench.layout.listPanelInstances("side")[0]?.pinned).toBe(true);
  });
});
