import { expect, test } from "bun:test";
import { createWorkbenchCore } from "../core";
import { activePrimaryResource, describeResourceRouteContract, type RouteContractHarness } from "./navigation-contract";

const ROOT_KIND = "contract-root";
const DETAIL_KIND = "contract-detail";
const MODE = "contract-mode";

// A correct resource-first route: the presenter activates the route mode and opens the DOMAIN
// resource into the primary region. The shared contract keeps each route tab live while
// Back and Forward move between existing placements.
const setup = (): RouteContractHarness => {
  const workbench = createWorkbenchCore();

  workbench.modes.registerMode({ id: MODE, label: "Contract", activate: () => undefined });
  workbench.resources.registerKind({ kind: ROOT_KIND, label: "Root" });
  workbench.resources.registerKind({ kind: DETAIL_KIND, label: "Detail" });
  workbench.layout.registerLocation({
    id: "contract-root-view",
    title: "Root",
    region: "main",
    singleton: true,
    rendererId: "noop",
    resourceKinds: [ROOT_KIND],
  });
  workbench.layout.registerLocation({
    id: "contract-detail-view",
    title: "Detail",
    region: "main",
    singleton: true,
    rendererId: "noop",
    resourceKinds: [DETAIL_KIND],
  });
  workbench.resources.registerPresenter({
    id: "contract-root-presenter",
    canOpen: (resource) => resource.kind === ROOT_KIND,
    open: (resource, input) => {
      workbench.modes.setActiveMode(MODE);
      return workbench.layout.openPanel("contract-root-view", {
        resource,
        title: resource.label,
        strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
      });
    },
  });
  workbench.resources.registerPresenter({
    id: "contract-detail-presenter",
    canOpen: (resource) => resource.kind === DETAIL_KIND,
    open: (resource, input) => {
      workbench.modes.setActiveMode(MODE);
      return workbench.layout.openPanel("contract-detail-view", {
        resource,
        title: resource.label,
        strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
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
  rootDetailHistory: "retained",
  expectedMode: MODE,
});

test("the active-URI invariant catches a wrapper-identity presenter", async () => {
  const workbench = createWorkbenchCore();
  workbench.resources.registerKind({ kind: "wrap-detail", label: "Detail" });
  workbench.layout.registerLocation({
    id: "wrap-view",
    title: "Detail",
    region: "main",
    singleton: true,
    rendererId: "noop",
  });
  workbench.resources.registerPresenter({
    id: "wrap-presenter",
    canOpen: (resource) => resource.kind === "wrap-detail",
    // Wraps the domain resource in a synthetic URI — the footgun that makes history replay
    // the wrapper instead of the resource the user navigated to.
    open: (resource, input) =>
      workbench.layout.openPanel("wrap-view", {
        resource: { ...resource, uri: `wrapper://${resource.uri}` },
        title: resource.label,
        strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
      }),
  });

  const domain = { kind: "wrap-detail", uri: "domain://1", id: "1", label: "One" };
  await workbench.resources.openResource(domain, { replaceActive: true });
  await Promise.resolve();

  expect(activePrimaryResource(workbench)?.uri).not.toBe(domain.uri);
});
