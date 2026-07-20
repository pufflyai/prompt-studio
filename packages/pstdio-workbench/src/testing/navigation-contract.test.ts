import { expect, test } from "bun:test";
import { createWorkbenchCore } from "../core";
import {
  activePrimaryResource,
  describeResourceRouteContract,
  type RouteContractHarness,
  unpinnedPrimaryPlacements,
} from "./navigation-contract";

const ROOT_KIND = "contract-root";
const DETAIL_KIND = "contract-detail";
const MODE = "contract-mode";

// A correct resource-first route: the opener activates the route mode, opens the DOMAIN
// resource into the primary region, and forwards replaceActive. Mirrors the registerResourceRoute
// opener shape so the contract guards the pattern production routes adopt.
const setup = (): RouteContractHarness => {
  const workbench = createWorkbenchCore();

  workbench.modes.registerMode({ id: MODE, label: "Contract", activate: () => undefined });
  workbench.resources.registerKind({ kind: ROOT_KIND, label: "Root" });
  workbench.resources.registerKind({ kind: DETAIL_KIND, label: "Detail" });
  workbench.layout.registerWidget({
    id: "contract-root-view",
    title: "Root",
    region: "main",
    singleton: true,
    rendererId: "noop",
    resourceKinds: [ROOT_KIND],
  });
  workbench.layout.registerWidget({
    id: "contract-detail-view",
    title: "Detail",
    region: "main",
    singleton: true,
    rendererId: "noop",
    resourceKinds: [DETAIL_KIND],
  });
  workbench.resources.registerOpener({
    id: "contract-root-opener",
    canOpen: (resource) => resource.kind === ROOT_KIND,
    open: (resource, input) => {
      workbench.modes.setActiveMode(MODE);
      return workbench.layout.openWidget("contract-root-view", {
        resource,
        title: resource.label,
        replaceActive: input.replaceActive,
      });
    },
  });
  workbench.resources.registerOpener({
    id: "contract-detail-opener",
    canOpen: (resource) => resource.kind === DETAIL_KIND,
    open: (resource, input) => {
      workbench.modes.setActiveMode(MODE);
      return workbench.layout.openWidget("contract-detail-view", {
        resource,
        title: resource.label,
        replaceActive: input.replaceActive,
      });
    },
  });

  workbench.modes.setActiveMode(MODE);
  return { workbench };
};

describeResourceRouteContract({
  name: "synthetic",
  setup,
  root: { kind: ROOT_KIND, uri: "contract://root", id: "root", label: "Root" },
  detail: { kind: DETAIL_KIND, uri: "contract://detail/1", id: "1", label: "Detail 1" },
  detailB: { kind: DETAIL_KIND, uri: "contract://detail/2", id: "2", label: "Detail 2" },
  expectedMode: MODE,
});

// The footgun cases below prove the contract's invariants actually catch the bug classes
// PS-11 targets — otherwise a passing suite would be meaningless.

test("the single-placement invariant catches a tab-accumulating opener", async () => {
  const workbench = createWorkbenchCore();
  workbench.resources.registerKind({ kind: "footgun-detail", label: "Detail" });
  workbench.layout.registerWidget({
    id: "footgun-view",
    title: "Detail",
    region: "main",
    singleton: false,
    reuse: "none",
    rendererId: "noop",
  });
  workbench.resources.registerOpener({
    id: "footgun-opener",
    canOpen: (resource) => resource.kind === "footgun-detail",
    // Ignores replaceActive — the footgun that grows main-region tabs.
    open: (resource) => workbench.layout.openWidget("footgun-view", { resource, title: resource.label }),
  });

  await workbench.resources.openResource({ kind: "footgun-detail", uri: "footgun://1", id: "1", label: "One" });
  await Promise.resolve();
  await workbench.resources.openResource({ kind: "footgun-detail", uri: "footgun://2", id: "2", label: "Two" });
  await Promise.resolve();

  expect(unpinnedPrimaryPlacements(workbench).length).toBeGreaterThan(1);
});

test("the active-URI invariant catches a wrapper-identity opener", async () => {
  const workbench = createWorkbenchCore();
  workbench.resources.registerKind({ kind: "wrap-detail", label: "Detail" });
  workbench.layout.registerWidget({
    id: "wrap-view",
    title: "Detail",
    region: "main",
    singleton: true,
    rendererId: "noop",
  });
  workbench.resources.registerOpener({
    id: "wrap-opener",
    canOpen: (resource) => resource.kind === "wrap-detail",
    // Wraps the domain resource in a synthetic URI — the footgun that makes history replay
    // the wrapper instead of the resource the user navigated to.
    open: (resource, input) =>
      workbench.layout.openWidget("wrap-view", {
        resource: { ...resource, uri: `wrapper://${resource.uri}` },
        title: resource.label,
        replaceActive: input.replaceActive,
      }),
  });

  const domain = { kind: "wrap-detail", uri: "domain://1", id: "1", label: "One" };
  await workbench.resources.openResource(domain, { replaceActive: true });
  await Promise.resolve();

  expect(activePrimaryResource(workbench)?.uri).not.toBe(domain.uri);
});
