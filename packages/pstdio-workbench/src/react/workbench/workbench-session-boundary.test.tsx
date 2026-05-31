import { describe, expect, test } from "bun:test";
import type { ReactElement, ReactNode } from "react";
import { createWorkbenchCore } from "../../core";
import { shouldFocusWorkbenchKeyboardFrame, WorkbenchSessionBoundary } from "./workbench-session-boundary";
import { WorkbenchAttachedSessionLayout } from "./workbench-session-layout";

interface AttachedLayoutTestProps {
  attached: boolean;
  contentPanel: ReactNode;
}

const workbench = createWorkbenchCore();

const createTarget = (matchesInteractive: boolean) =>
  ({
    closest: () => (matchesInteractive ? {} : null),
  }) as unknown as EventTarget;

const renderBoundary = (showAttachedSessionPanel: boolean) => {
  const workbenchFrame = <div data-testid="workbench-frame" />;
  const element = WorkbenchSessionBoundary({
    workbench,
    showAttachedSessionPanel,
    workbenchFrame,
    floatingHeader: <div />,
    contentMinSizePx: 320,
    onAttachedSlotChange: () => undefined,
  }) as ReactElement<{ children: ReactElement<AttachedLayoutTestProps> }>;

  return { content: element.props.children, workbenchFrame };
};

describe("WorkbenchSessionBoundary", () => {
  test("keeps the workbench frame inside the attached layout when the session panel is hidden", () => {
    const { content, workbenchFrame } = renderBoundary(false);

    expect(content.type).toBe(WorkbenchAttachedSessionLayout);
    expect(content.props.contentPanel).toBe(workbenchFrame);
    expect(content.props.attached).toBe(false);
  });

  test("uses the same workbench frame parent when the session panel is attached", () => {
    const { content, workbenchFrame } = renderBoundary(true);

    expect(content.type).toBe(WorkbenchAttachedSessionLayout);
    expect(content.props.contentPanel).toBe(workbenchFrame);
    expect(content.props.attached).toBe(true);
  });

  test("focuses the keyboard frame only for non-interactive pointer targets", () => {
    const frame = {} as EventTarget;

    expect(shouldFocusWorkbenchKeyboardFrame(frame, frame)).toBe(true);
    expect(shouldFocusWorkbenchKeyboardFrame(createTarget(true), frame)).toBe(false);
    expect(shouldFocusWorkbenchKeyboardFrame(createTarget(false), frame)).toBe(true);
  });
});
