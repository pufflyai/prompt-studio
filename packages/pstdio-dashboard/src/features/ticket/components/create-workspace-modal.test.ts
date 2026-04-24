import { describe, expect, it, mock } from "bun:test";
import { runCreateWorkspaceModalConfirm } from "./create-workspace-modal";

describe("runCreateWorkspaceModalConfirm", () => {
  it("keeps the modal open when creation fails", async () => {
    const onClose = mock(() => {});

    const started = await runCreateWorkspaceModalConfirm({
      isSubmitting: false,
      isDisabled: false,
      onConfirm: async () => false,
      onClose,
    });

    expect(started).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });
});
