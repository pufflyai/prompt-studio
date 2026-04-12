import { describe, expect, it } from "bun:test";
import type { ReactNode } from "react";
import type { TicketAttempt } from "@/features/ticket-list/types";
import { buildWorkspacesSection } from "./ticket-sidebar-workspaces";

const collectText = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object" || !("props" in node)) return "";

  const children = (node.props as { children?: ReactNode }).children;
  if (Array.isArray(children)) return children.map(collectText).join("");
  return collectText(children);
};

const makeWorkspace = (overrides: Partial<TicketAttempt>): TicketAttempt => ({
  id: "workspace-1",
  label: "Attempt 1",
  attemptStatusId: null,
  sessionStatus: null,
  shorthand: "PS-36_A1",
  updatedAt: "2026-04-12T00:00:00.000Z",
  worktreePath: null,
  ...overrides,
});

describe("buildWorkspacesSection", () => {
  it("keeps diff totals visible when the workspace has no attempt status", () => {
    const section = buildWorkspacesSection(
      [makeWorkspace({ attemptStatusId: null })],
      new Map(),
      new Map([["workspace-1", { additions: 7, deletions: 2 }]]),
    );

    const indicator = section.nodes[0]?.indicator;

    expect(indicator).toBeDefined();
    expect(collectText(indicator?.icon)).toContain("+7 -2");
  });
});
