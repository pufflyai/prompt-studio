import { describe, expect, it, mock } from "bun:test";
import { handleCreateTicketShortcutRequest } from "./use-create-ticket-shortcut";

describe("handleCreateTicketShortcutRequest", () => {
  it("opens once and acknowledges request key", () => {
    const setCreateModalStatus = mock(() => {});
    const setCreateModalOpen = mock(() => {});
    const acknowledgeCreateTicketRequest = mock(() => {});

    const handled = handleCreateTicketShortcutRequest({
      projectId: "project-1",
      createTicketRequestKey: 1,
      lastHandledCreateTicketRequestKey: 0,
      firstCreatableStatus: "todo",
      setCreateModalStatus,
      setCreateModalOpen,
      acknowledgeCreateTicketRequest,
    });

    expect(handled).toBe(true);
    expect(setCreateModalStatus).toHaveBeenCalledWith("todo");
    expect(setCreateModalOpen).toHaveBeenCalledWith(true);
    expect(acknowledgeCreateTicketRequest).toHaveBeenCalledWith(1);
  });

  it("does not reopen on remount when key was already acknowledged", () => {
    const setCreateModalStatus = mock(() => {});
    const setCreateModalOpen = mock(() => {});
    const acknowledgeCreateTicketRequest = mock(() => {});

    const handled = handleCreateTicketShortcutRequest({
      projectId: "project-1",
      createTicketRequestKey: 1,
      lastHandledCreateTicketRequestKey: 1,
      firstCreatableStatus: "todo",
      setCreateModalStatus,
      setCreateModalOpen,
      acknowledgeCreateTicketRequest,
    });

    expect(handled).toBe(false);
    expect(setCreateModalStatus).not.toHaveBeenCalled();
    expect(setCreateModalOpen).not.toHaveBeenCalled();
    expect(acknowledgeCreateTicketRequest).not.toHaveBeenCalled();
  });

  it("handles a new request key after a prior acknowledged key", () => {
    const setCreateModalStatus = mock(() => {});
    const setCreateModalOpen = mock(() => {});
    const acknowledgeCreateTicketRequest = mock(() => {});

    const handled = handleCreateTicketShortcutRequest({
      projectId: "project-1",
      createTicketRequestKey: 2,
      lastHandledCreateTicketRequestKey: 1,
      firstCreatableStatus: "in_progress",
      setCreateModalStatus,
      setCreateModalOpen,
      acknowledgeCreateTicketRequest,
    });

    expect(handled).toBe(true);
    expect(setCreateModalStatus).toHaveBeenCalledWith("in_progress");
    expect(setCreateModalOpen).toHaveBeenCalledWith(true);
    expect(acknowledgeCreateTicketRequest).toHaveBeenCalledWith(2);
  });
});
