import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Bar } from "./collection-view-bar-story";

const meta: Meta = { title: "Patterns/Collection View/Filter Bubble Selection", parameters: { layout: "fullscreen" } };
export default meta;
type Story = StoryObj;

export const CompleteNumberEntry: Story = {
  render: () => <Bar storageKey="storybook-complete-number" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Filter", exact: true }));
    const picker = await body.findByTestId("filter-menu");
    await userEvent.click(within(picker).getByRole("button", { name: "Score", exact: true }));
    await userEvent.type(within(picker).getByRole("spinbutton", { name: "Value" }), "70");
    expect(canvas.queryByRole("group", { name: "Score filter" })).toBeNull();
    await userEvent.click(within(picker).getByRole("button", { name: "Apply filter" }));
    const pill = within(canvas.getByRole("group", { name: "Score filter" }));
    await expect(pill.getByRole("spinbutton", { name: "Value" })).toHaveValue(70);
    await waitFor(() => expect(picker).not.toBeVisible());
  },
};

export const ChooseValueThenContinue: Story = {
  render: () => <Bar storageKey="storybook-value-handoff" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Filter", exact: true }));
    const picker = await body.findByTestId("filter-menu");
    await userEvent.click(within(picker).getByRole("button", { name: "Priority", exact: true }));
    expect(canvas.queryByRole("group", { name: "Priority filter" })).toBeNull();
    await userEvent.click(within(picker).getByRole("checkbox", { name: "High", exact: true }));
    await waitFor(() => expect(picker).not.toBeVisible());
    const pill = within(canvas.getByRole("group", { name: "Priority filter" }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("High");
    const menu = await body.findByRole("menu");
    await expect(within(menu).getByRole("menuitemcheckbox", { name: /High/ })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(within(menu).getByRole("menuitemcheckbox", { name: /Medium/ }));
    await expect(pill.getByRole("button", { name: "Condition" })).toHaveTextContent("is any of");
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("High, Medium");
    const checkbox = within(menu).getByRole("menuitemcheckbox", { name: /High/ }).querySelector("[data-part=control]")!;
    expect(checkbox.getBoundingClientRect().width).toBe(12);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(pill.getByRole("button", { name: "Condition" }));
    await userEvent.click(body.getByRole("menuitem", { name: "is not", exact: true }));
    await expect(pill.getByRole("button", { name: "Condition" })).toHaveTextContent("is not");
  },
};

export const TextEntry: Story = {
  render: () => <Bar storageKey="storybook-text-filter-entry" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Filter", exact: true }));
    const picker = await body.findByTestId("filter-menu");
    await userEvent.click(within(picker).getByRole("button", { name: "Title", exact: true }));
    expect(canvas.queryByRole("group", { name: "Title filter" })).toBeNull();
    await userEvent.click(within(picker).getByRole("button", { name: "Filter by text", exact: true }));
    const pill = within(canvas.getByRole("group", { name: "Title filter" }));
    const input = await pill.findByRole("textbox", { name: "Value" });
    await userEvent.type(input, "review");
    await userEvent.keyboard("{Enter}");
    await expect(pill.getByText("review", { exact: true })).toBeVisible();
    await userEvent.click(pill.getByText("review", { exact: true }));
    await userEvent.clear(pill.getByRole("textbox", { name: "Value" }));
    await userEvent.type(pill.getByRole("textbox", { name: "Value" }), "urgent");
    await userEvent.keyboard("{Enter}");
    await expect(pill.getByText("urgent", { exact: true })).toBeVisible();
  },
};
