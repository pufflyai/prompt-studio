import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ResourceRef, WorkbenchCore } from "../core";
import { getAnchorResource, resolveAnchorArea } from "../core";

// The primary/main surface hosts the "primary" anchor (see surface-map). Reading placements
// and the active resource through the anchor — not the global activeResourceUri, which any
// side-area activation can pollute — measures the exact signal history records, so the
// contract asserts the user-visible navigation state.
export const primaryPlacements = (workbench: WorkbenchCore) =>
  workbench.layout.getLayout().areas[resolveAnchorArea("primary")].widgets;

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
  expectedMode?: string;
}

// Two microtasks settle a Back/Forward replay: the cursor moves synchronously, then the
// silent resource reopen resolves on the microtask queue.
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

// Shared navigation invariants every resource-first root/detail route must satisfy. Drives a
// real workbench core (provided by `setup`) and asserts the user-visible Back/Forward state:
// root stays root, detail replays, mode is restored, and the primary area never grows tabs.
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
      await workbench.resources.openResource(resource, { replaceActive: true });
      await flush();
    };

    test("root -> detail -> Back activates the root", async () => {
      await open(contract.root);
      await open(contract.detail);

      const back = workbench.history.goBack();
      await flush();

      expect(activePrimaryResource(workbench)?.uri).toBe(contract.root.uri);
      expect(back?.resource?.uri).toBe(contract.root.uri);
      expect(unpinnedPrimaryPlacements(workbench)).toHaveLength(1);
    });

    test("root -> detail -> Back -> Forward activates the detail", async () => {
      await open(contract.root);
      await open(contract.detail);

      workbench.history.goBack();
      await flush();
      const forward = workbench.history.goForward();
      await flush();

      expect(activePrimaryResource(workbench)?.uri).toBe(contract.detail.uri);
      expect(forward?.resource?.uri).toBe(contract.detail.uri);
      expect(unpinnedPrimaryPlacements(workbench)).toHaveLength(1);
    });

    if (contract.detailB) {
      const detailB = contract.detailB;
      test("detail A -> detail B -> Back activates detail A", async () => {
        await open(contract.root);
        await open(contract.detail);
        await open(detailB);

        workbench.history.goBack();
        await flush();

        expect(activePrimaryResource(workbench)?.uri).toBe(contract.detail.uri);
        expect(unpinnedPrimaryPlacements(workbench)).toHaveLength(1);
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
