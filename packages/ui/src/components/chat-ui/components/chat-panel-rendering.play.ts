import { expect, userEvent, waitFor, within } from "storybook/test";

export const validateLongTurnRendering = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  const host = canvasElement.querySelector('[data-testid="rendering-chat"]')!;
  const viewport = () => host.querySelector<HTMLElement>('[data-scope="scroll-area"][data-part="viewport"]')!;
  const ready = () =>
    waitFor(() => {
      expect(getComputedStyle(viewport()).visibility).toBe("visible");
      expect(host.querySelectorAll('[data-chat-message-list-item="response"]').length).toBeGreaterThan(0);
    });
  const bounded = () =>
    expect(host.querySelectorAll('[data-chat-message-list-item="response"]').length).toBeLessThan(30);
  const atTail = () =>
    waitFor(() => expect(viewport().scrollHeight - viewport().scrollTop - viewport().clientHeight).toBeLessThan(3));
  for (const count of [1000, 5000]) {
    await userEvent.click(canvas.getByRole("button", { name: `${count} responses` }));
    await ready();
    await atTail();
    bounded();
    expect(host.querySelector(`[data-chat-message-id="response-${count - 1}"]`)).not.toBeNull();
    viewport().scrollTop = viewport().scrollHeight / 2;
    await waitFor(() => expect(host.querySelector(`[data-chat-message-id="response-${count - 1}"]`)).toBeNull());
    bounded();
    const previousTop = viewport().scrollTop;
    await userEvent.click(canvas.getByRole("button", { name: "Hide chat" }));
    await userEvent.click(canvas.getByRole("button", { name: "Show chat" }));
    await ready();
    await waitFor(() => expect(Math.abs(viewport().scrollTop - previousTop)).toBeLessThan(3));
    const sticky = host.querySelector<HTMLElement>('[data-chat-message-list-item="user"]')!;
    expect(Math.abs(sticky.getBoundingClientRect().top - viewport().getBoundingClientRect().top)).toBeLessThan(20);
    await userEvent.click(within(sticky).getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(sticky.querySelector('[data-sticky-user-message-content="expanded"]')).not.toBeNull());
    await userEvent.click(within(sticky).getByRole("button", { name: "Show less" }));
    await userEvent.click(canvas.getByRole("button", { name: "Switch session" }));
    await ready();
    await atTail();
    bounded();
    await userEvent.click(canvas.getByRole("button", { name: "Hide chat" }));
    await userEvent.click(canvas.getByRole("button", { name: "Stream response" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Stream response" })).toBeEnabled());
    await userEvent.click(canvas.getByRole("button", { name: "Show chat" }));
    await ready();
    await atTail();
    expect(host.querySelector('[data-chat-message-id="streamed-response"]')).not.toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Stream response" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Stream response" })).toBeEnabled());
    await atTail();
    expect(host.querySelector('[data-chat-message-id="streamed-response-2"]')).not.toBeNull();
    bounded();
  }
};
