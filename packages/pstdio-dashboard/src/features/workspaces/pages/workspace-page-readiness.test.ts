import { describe, expect, it } from "bun:test";
import { shouldShowWorkspaceTicketNotFound } from "./workspace-page-readiness";

describe("shouldShowWorkspaceTicketNotFound", () => {
  it("keeps the workspace shell available while tickets are loading", () => {
    expect(shouldShowWorkspaceTicketNotFound({ hasTicket: false, areTicketsLoading: true })).toBe(false);
  });

  it("shows not found only after tickets finish loading without a match", () => {
    expect(shouldShowWorkspaceTicketNotFound({ hasTicket: false, areTicketsLoading: false })).toBe(true);
  });
});
