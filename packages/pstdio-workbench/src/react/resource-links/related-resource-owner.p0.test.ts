import { expect, test } from "bun:test";
import { opening, setup } from "./related-resource-openings.fixture";

test("related openings use the qualified resource owner when kind names overlap", async () => {
  const s = setup();
  const source = { ...s.source, extensionId: "other" };
  let reads = 0;
  s.workbench.resources.registerKind({
    kind: source.type,
    extensionId: source.extensionId,
    label: "Other document",
    relatedOpenings: () => {
      reads++;
      return [opening("other-related")];
    },
  });
  await s.controller.open(source);
  expect(reads).toBe(1);
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("other-related");
  s.controller.dispose();
});

test("another owner registering during lookup preserves results and manual closure preferences", async () => {
  const s = setup();
  const source = { ...s.source, extensionId: "other" };
  const result = Promise.withResolvers<ReturnType<typeof opening>[]>();
  s.workbench.resources.registerKind({
    kind: source.type,
    extensionId: source.extensionId,
    label: "Other document",
    relatedOpenings: () => result.promise,
  });
  s.workbench.pageLocations.navigate(s.target(source));
  const pending = s.controller.open(source);
  s.workbench.resources.registerKind({ kind: source.type, extensionId: "unrelated", label: "Unrelated" });
  result.resolve([opening("other-related")]);
  await pending;
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("other-related");
  s.workbench.shell.setRegionOpen("side", false);
  s.workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id: "home", extensionId: "example" } });
  s.workbench.pageLocations.navigate(s.target(source));
  await s.controller.open(source);
  expect(s.workbench.shell.getRegionState("side").open).toBe(false);
  s.controller.dispose();
});
