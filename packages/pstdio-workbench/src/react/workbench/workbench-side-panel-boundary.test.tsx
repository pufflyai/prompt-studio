import { describe, expect, test } from "bun:test";
import type { ReactElement, ReactNode } from "react";
import { createWorkbenchCore } from "../../core";
import { shouldFocusWorkbenchKeyboardFrame, WorkbenchSidePanelBoundary } from "./workbench-side-panel-boundary";
import { WorkbenchAttachedSidePanelLayout } from "./workbench-side-panel-layout";

interface AttachedLayoutTestProps {
  attached: boolean;
  contentPanel: ReactNode;
}

const workbench = createWorkbenchCore();

const createTarget = (matchesInteractive: boolean) =>
  ({
    closest: () => (matchesInteractive ? {} : null),
  }) as unknown as EventTarget;

const renderBoundary = (showAttachedSidePanel: boolean) => {
  const contentFrame = <div data-testid="workbench-frame" />;
  const element = WorkbenchSidePanelBoundary({
    workbench,
    showAttachedSidePanel,
    contentFrame,
    sideHeader: <div />,
    contentMinSizePx: 320,
    onAttachedSlotChange: () => undefined,
  }) as ReactElement<{ children: ReactElement<AttachedLayoutTestProps> }>;

  return { content: element.props.children, contentFrame };
};

describe("WorkbenchSidePanelBoundary", () => {
  test("keeps the workbench frame inside the attached layout when the Side Panel is hidden", () => {
    const { content, contentFrame } = renderBoundary(false);

    expect(content.type).toBe(WorkbenchAttachedSidePanelLayout);
    expect(content.props.contentPanel).toBe(contentFrame);
    expect(content.props.attached).toBe(false);
  });

  test("uses the same workbench frame parent when the Side Panel is attached", () => {
    const { content, contentFrame } = renderBoundary(true);

    expect(content.type).toBe(WorkbenchAttachedSidePanelLayout);
    expect(content.props.contentPanel).toBe(contentFrame);
    expect(content.props.attached).toBe(true);
  });

  test("focuses the keyboard frame only for non-interactive pointer targets", () => {
    const frame = {} as EventTarget;

    expect(shouldFocusWorkbenchKeyboardFrame(frame, frame)).toBe(true);
    expect(shouldFocusWorkbenchKeyboardFrame(createTarget(true), frame)).toBe(false);
    expect(shouldFocusWorkbenchKeyboardFrame(createTarget(false), frame)).toBe(true);
  });
});
