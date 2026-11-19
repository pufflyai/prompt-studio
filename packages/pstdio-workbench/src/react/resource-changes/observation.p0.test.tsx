import { expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench } from "../../core";
import { useObservedResource } from "./activity-dot";
import { installResourceChanges } from "./change-store";

test("a retained hidden or unfocused viewer acknowledges only the receipt displayed on return", async () => {
  const workbench = createWorkbench();
  const ref = { extensionId: "example.notes", type: "edition", projectId: "project", id: "one" };
  const receipts: string[] = [];
  const registration = installResourceChanges({
    workbench,
    projectId: "project",
    metadata: { resourceChangeProviders: [{ ...ref, refreshEvents: [] }] },
    resourceChanges: {
      query: async () => [],
      read: async () => {
        throw Error("No duplicate content read");
      },
      acknowledge: async (_project, receipt) => {
        receipts.push(receipt);
        return { resource: ref, stamp: { lineage: "edition", revision: "2" }, changedSinceSeen: false };
      },
    },
  });
  const descriptors = Object.getOwnPropertyDescriptors(globalThis);
  let focused = false;
  const windowEvents = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible", hasFocus: () => focused });
  const globals: Record<string, unknown> = { document: doc, window: windowEvents, IS_REACT_ACT_ENVIRONMENT: true };
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  const Reader = ({ receipt, visible }: { receipt: string; visible: boolean }) => {
    useObservedResource(workbench, ref, receipt, visible);
    return null;
  };
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(<Reader receipt="one" visible={false} />);
    });
    await act(async () => {
      tree!.update(<Reader receipt="two" visible />);
    });
    expect(receipts).toEqual([]);
    await act(async () => {
      focused = true;
      windowEvents.dispatchEvent(new Event("focus"));
    });
    expect(receipts).toEqual(["two"]);
    await act(async () => {
      tree!.update(<Reader receipt="three" visible={false} />);
    });
    expect(receipts).toEqual(["two"]);
  } finally {
    await act(async () => tree?.unmount());
    registration.dispose();
    await workbench.dispose();
    for (const key of Object.keys(globals)) {
      const descriptor = Object.getOwnPropertyDescriptor(descriptors, key)?.value;
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
