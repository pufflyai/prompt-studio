import { expect, test } from "bun:test";
import { catalogCanvases } from "./definitions";

test("related Auto Build scenarios share one canvas without losing source items", () => {
  const groups = catalogCanvases.filter((canvas) =>
    canvas.items.some(
      (item) => item.preview?.kind === "story" && /auto-build-(button|form)\.stories/.test(item.preview.source),
    ),
  );
  expect(groups).toHaveLength(1);
  const components = groups[0].items.filter((item) => item.preview?.kind === "story");
  expect(components).toHaveLength(2);
  expect(components.flatMap((item) => item.variants ?? [])).toHaveLength(26);
  expect(new Set(groups[0].items.map((item) => item.id)).size).toBe(groups[0].items.length);
});

test("folder picker states remain together on one canvas", () => {
  const groups = catalogCanvases.filter((canvas) =>
    canvas.items.some(
      (item) => item.preview?.kind === "story" && item.preview.source.endsWith("folder-picker-dialog.stories.tsx"),
    ),
  );
  expect(groups).toHaveLength(1);
  expect(groups[0].items).toHaveLength(1);
  expect(groups[0].items[0].variants).toHaveLength(12);
  expect(new Set(groups[0].items.map((item) => `${item.position.x},${item.position.y}`)).size).toBe(
    groups[0].items.length,
  );
});

test("host extension chrome belongs to the workbench while extension-owned UI stays in Extensions", () => {
  const paused = catalogCanvases.find((canvas) => canvas.name === "Paused extension view")!;
  expect(paused.group).toBe("Workbench Core");
  expect(paused.path).toEqual(["Chrome", "Extensions"]);
  expect(catalogCanvases.find((canvas) => canvas.name === "Auto Build")!.group).toBe("Extensions");
});

test("landing-page components and website design references share their own navigation group", () => {
  const landing = catalogCanvases.filter((canvas) =>
    canvas.items.some((item) =>
      item.preview?.kind === "story"
        ? item.preview.suite === "website"
        : item.preview?.kind === "design" && item.preview.file === "website",
    ),
  );
  expect(landing.length).toBeGreaterThan(0);
  expect(new Set(landing.map((canvas) => canvas.group))).toEqual(new Set(["Landing Page"]));
});
