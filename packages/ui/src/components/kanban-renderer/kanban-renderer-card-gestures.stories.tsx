import { Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { SessionIndicator } from "../primitives/session-indicator";
import { KanbanRendererCard } from "./kanban-renderer-card";

const meta: Meta<typeof KanbanRendererCard> = {
  title: "Patterns/Kanban Renderer/Card Gestures",
  component: KanbanRendererCard,
  tags: ["!manifest"],
};
export default meta;

const openCard = fn();
const openSession = fn();

export const NestedControlRelease: StoryObj<typeof KanbanRendererCard> = {
  args: {
    title: "Keep the ticket board open",
    onClick: openCard,
    customSlots: [
      <Button
        key="session"
        aria-label="Open latest session"
        variant="ghost"
        size="xs"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openSession();
        }}
      >
        <SessionIndicator status="failed" ariaLabel="Latest session status" />
      </Button>,
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByTestId("renderer-card");
    const control = canvas.getByRole("button", { name: "Open latest session" });
    const indicator = canvas.getByLabelText("Latest session status");
    openCard.mockClear();
    openSession.mockClear();
    // A live badge update can move the control away before pointer release.
    await userEvent.pointer([
      { target: indicator, keys: "[MouseLeft>]" },
      { target: card, keys: "[/MouseLeft]" },
    ]);
    await expect(openCard).not.toHaveBeenCalled();
    await expect(openSession).not.toHaveBeenCalled();
    await userEvent.click(control);
    await expect(openSession).toHaveBeenCalledTimes(1);
    await expect(openCard).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByText("Keep the ticket board open"));
    await expect(openCard).toHaveBeenCalledTimes(1);
    indicator.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, isPrimary: true }));
    indicator.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, isPrimary: false }));
    card.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await expect(openCard).toHaveBeenCalledTimes(1);
    indicator.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, isPrimary: true }));
    indicator.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, isPrimary: true }));
    card.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await expect(openCard).toHaveBeenCalledTimes(2);
    card.click();
    await expect(openCard).toHaveBeenCalledTimes(3);
    await userEvent.click(canvas.getByText("Keep the ticket board open"));
    await expect(openCard).toHaveBeenCalledTimes(4);
  },
};
