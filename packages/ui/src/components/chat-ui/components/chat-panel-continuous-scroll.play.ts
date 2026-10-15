import { expect, userEvent, waitFor, within } from "storybook/test";

export const validateContinuousChatScroll = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "Large response" }));
  const host = canvasElement.querySelector('[data-testid="rendering-chat"]')!;
  const viewport = host.querySelector<HTMLElement>('[data-scope="scroll-area"][data-part="viewport"]')!;
  await waitFor(() => expect(getComputedStyle(viewport).visibility).toBe("visible"));
  viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
  viewport.scrollTop = 400;
  const sticky = () => host.querySelector<HTMLElement>('[data-chat-message-list-item="user"]')!;
  const gap = () => Math.abs(sticky().getBoundingClientRect().top - viewport.getBoundingClientRect().top);
  await waitFor(() => expect(gap()).toBeLessThan(20));
  for (const direction of [1, -1]) {
    for (let frame = 0; frame < 20; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      viewport.scrollTop += direction * 12;
      expect(gap()).toBeLessThan(20);
    }
  }
};
