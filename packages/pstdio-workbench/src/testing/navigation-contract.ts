import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ResourceRef, WorkbenchCore } from "../core";
import { getAnchorResource, resolveAnchorRegion } from "../core";

// The primary/main surface hosts the "primary" anchor (see surface-map). Reading placements
// and the active resource through the anchor — not the global activeResourceUri, which any
// side-region activation can pollute — measures the exact signal history records, so the
// contract asserts the user-visible navigation state.
export const primaryPlacements = (workbench: WorkbenchCore) =>
  workbench.layout.getLayout().regions[resolveAnchorRegion("primary")].widgets;

export const unpinnedPrimaryPlacements = (workbench: WorkbenchCore) =>
  primaryPlacements(workbench).filter((placement) => !placement.pinned);

export const activePrimaryResource = (workbench: WorkbenchCore) =>
  getAnchorResource(workbench.layout.getLayout(), "primary");

export interface RouteContractHarness {
  workbench: WorkbenchCore;
  dispose?: () => void;
}

export interface ResourceRouteContract {
  // Route id / assertion label so a contract failure names the offending route.
  name: string;
  setup: () => RouteContractHarness | Promise<RouteContractHarness>;
  root: ResourceRef;
  detail: ResourceRef;
  detailB?: ResourceRef;
  rootDetailHistory: "retained" | "replaced";
  expectedMode?: string;
}

// Two microtasks settle resource activation and any opener work on the active tab.
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

// Shared navigation invariants every resource-first root/detail route must satisfy. Back and
// Forward activate tabs retained by the route without creating or removing placements.
export const describeResourceRouteContract = (contract: ResourceRouteContract) => {
  describe(`${contract.name} navigation contract`, () => {
    let harness: RouteContractHarness;
    let workbench: WorkbenchCore;

    beforeEach(async () => {
      harness = await contract.setup();
      workbench = harness.workbench;
    });

    afterEach(() => {
      harness.dispose?.();
    });

    const open = async (resource: ResourceRef) => {
      await workbench.resources.openResource(resource);
      await flush();
    };

    const primaryWidgetIds = () => unpinnedPrimaryPlacements(workbench).map((placement) => placement.widgetId);

    if (contract.rootDetailHistory === "retained") {
      test("root -> detail -> Back uses only a retained root tab", async () => {
        await open(contract.root);
        await open(contract.detail);
        const widgetIds = primaryWidgetIds();
        expect(workbench.history.store.getState().cursor).toBeGreaterThan(0);

        const back = workbench.history.goBack();
        await flush();

        expect(activePrimaryResource(workbench)?.uri).toBe(contract.root.uri);
        expect(back?.resource?.uri).toBe(contract.root.uri);
        expect(primaryWidgetIds()).toEqual(widgetIds);
      });

      test("root -> detail -> Back -> Forward keeps the live tab set stable", async () => {
        await open(contract.root);
        await open(contract.detail);
        const widgetIds = primaryWidgetIds();
        expect(workbench.history.store.getState().cursor).toBeGreaterThan(0);

        workbench.history.goBack();
        await flush();
        const forward = workbench.history.goForward();
        await flush();

        expect(activePrimaryResource(workbench)?.uri).toBe(contract.detail.uri);
        expect(forward?.resource?.uri).toBe(contract.detail.uri);
        expect(primaryWidgetIds()).toEqual(widgetIds);
      });
    } else {
      test("root -> detail replacement makes Back unavailable", async () => {
        await open(contract.root);
        await open(contract.detail);
        const widgetIds = primaryWidgetIds();
        const history = workbench.history.store.getState();

        expect(history.entries.map((entry) => entry.resource?.uri)).toEqual([contract.detail.uri]);
        expect(history.cursor).toBe(0);
        expect(workbench.history.goBack()).toBeUndefined();
        expect(activePrimaryResource(workbench)?.uri).toBe(contract.detail.uri);
        expect(primaryWidgetIds()).toEqual(widgetIds);
      });

      test("root -> detail replacement keeps Forward unavailable after Back", async () => {
        await open(contract.root);
        await open(contract.detail);
        const widgetIds = primaryWidgetIds();

        expect(workbench.history.goBack()).toBeUndefined();
        expect(workbench.history.goForward()).toBeUndefined();
        expect(activePrimaryResource(workbench)?.uri).toBe(contract.detail.uri);
        expect(primaryWidgetIds()).toEqual(widgetIds);
      });
    }

    if (contract.detailB) {
      const detailB = contract.detailB;
      test("detail A -> detail B -> Back changes only a retained detail tab", async () => {
        await open(contract.root);
        await open(contract.detail);
        await open(detailB);
        const widgetIds = primaryWidgetIds();
        expect(workbench.history.store.getState().cursor).toBeGreaterThan(0);

        const back = workbench.history.goBack();
        await flush();

        expect(activePrimaryResource(workbench)?.uri).toBe(contract.detail.uri);
        expect(back?.resource?.uri).toBe(contract.detail.uri);
        expect(primaryWidgetIds()).toEqual(widgetIds);
      });
    }

    if (contract.expectedMode) {
      const expectedMode = contract.expectedMode;
      test("activates the route mode and keeps it across Back", async () => {
        await open(contract.root);
        expect(workbench.modes.getActiveModeId()).toBe(expectedMode);

        await open(contract.detail);
        expect(workbench.modes.getActiveModeId()).toBe(expectedMode);

        workbench.history.goBack();
        await flush();
        expect(workbench.modes.getActiveModeId()).toBe(expectedMode);
      });
    }
  });
};
