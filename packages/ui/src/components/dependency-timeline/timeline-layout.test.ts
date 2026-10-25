import { expect, test } from "bun:test";
import { layoutTimeline } from "./timeline-layout";

const item = (id: string, trackId: string, dependencies: string[] = []) => ({
  id,
  trackId,
  dependencies: dependencies.map((id) => ({ id })),
  content: null,
});

test("a shared timeline places dependencies before their dependents across tracks and sections", () => {
  const layout = layoutTimeline(
    [
      { id: "preview", header: null, items: [item("design", "design", ["api"]), item("api", "api")] },
      { id: "launch", header: null, items: [item("ship", "api", ["design"])] },
    ],
    [
      { id: "api", label: "API" },
      { id: "design", label: "Design" },
    ],
  );
  const api = layout.nodes.find(({ id }) => id === "api")!;
  const design = layout.nodes.find(({ id }) => id === "design")!;
  const ship = layout.nodes.find(({ id }) => id === "ship")!;
  expect(design.row).toBeGreaterThan(api.row);
  expect(ship.row).toBeGreaterThan(design.row);
  expect(design.track).toBe(1);
  expect(layout.bands.map(({ sectionId }) => sectionId)).toEqual(["preview", "launch"]);
});

test("collapsed timeline sections and tracks release their lanes and rows", () => {
  const layout = layoutTimeline(
    [
      { id: "closed", collapsed: true, header: null, items: [item("hidden-section", "api")] },
      { id: "open", header: null, items: [item("hidden-track", "api"), item("visible", "design")] },
    ],
    [
      { id: "api", label: "API", collapsed: true },
      { id: "design", label: "Design" },
    ],
  );
  expect(layout.nodes.map(({ id }) => id)).toEqual(["visible"]);
  expect(layout.trackLanes).toEqual([0, 1]);
  expect(layout.bands[0].rowCount).toBe(0);
  expect(layout.nodes[0].row).toBe(0);
});
