import { expect, test } from "bun:test";
import { harness, navigate, resource } from "./placement-lifecycle-test-support";

test("compound navigation opens a shell panel in its destination scope and restores each scope", async () => {
  const w = harness();
  w.shellPlacements.registerPlacement({
    id: "shell",
    region: "secondary",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "file" }],
        view: { kind: "view", id: "editor" },
        cardinality: "many",
      },
    },
  });
  const open = (id: string) => ({
    kind: "panel" as const,
    panel: { kind: "shell-placement" as const, id: "shell" },
    resource: resource(id),
    open: "pin" as const,
  });
  await w.navigation.openTarget({ kind: "compound", targets: [navigate("alpha"), open("alpha-terminal")] });
  await w.navigation.openTarget({ kind: "compound", targets: [navigate("beta"), open("beta-terminal")] });
  const opened = () => w.shellPlacements.resolvePlacements().map((p) => p.value.resource?.id);
  expect(opened()).toEqual(["beta-terminal"]);
  expect(w.pages.store.getState().location?.resource?.id).toBe("beta");
  await w.navigation.openTarget(navigate("alpha"));
  expect(opened()).toEqual(["alpha-terminal"]);
  await w.navigation.openTarget(navigate("beta"));
  expect(opened()).toEqual(["beta-terminal"]);
});
