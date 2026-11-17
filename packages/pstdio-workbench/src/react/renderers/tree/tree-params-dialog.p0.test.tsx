import { expect, test } from "bun:test";
import { createWorkbench } from "../../../core";
import { TreeParamsDialog } from "./tree-params-dialog";

test("tree rename keeps its form pending and returns failed persistence for an editable retry", async () => {
  const persistence = Promise.withResolvers<void>();
  const inputs: unknown[] = [];
  let closes = 0;
  const workbench = createWorkbench();
  const dialog = TreeParamsDialog({
    workbench,
    onClose: () => ++closes,
    request: {
      request: {
        label: "Rename session",
        record: {
          command: {
            id: "rename",
            label: "Rename session",
            resourceMutation: { kind: "rename", resourceType: "session", idParam: "id", labelParam: "title" },
          },
        },
      },
      run: async (args) => {
        inputs.push(args);
        if (inputs.length === 1) await persistence.promise;
      },
    },
  });
  let settled = false;
  const attempt = dialog.props.onRun({ commandId: "rename", label: "Rename session", args: { title: "  New  " } });
  const outcome = attempt.then(
    () => {
      settled = true;
      return null;
    },
    (error: unknown) => {
      settled = true;
      return error;
    },
  );
  await Promise.resolve();
  const closedWhilePending = closes;
  const settledWhilePending = settled;
  const failure = new Error("Save unavailable");
  persistence.reject(failure);
  expect(await outcome).toBe(failure);
  expect(closedWhilePending).toBe(0);
  expect(settledWhilePending).toBe(false);
  expect(closes).toBe(0);
  await dialog.props.onRun({ commandId: "rename", label: "Rename session", args: { title: "  New  " } });
  expect(inputs).toEqual([{ title: "  New  " }, { title: "  New  " }]);
  // The shared form closes after this fulfilled action; the tree never closes it early.
  expect(closes).toBe(0);
});
