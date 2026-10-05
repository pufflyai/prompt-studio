import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
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
    const valueInput = within(picker).getByRole("spinbutton", { name: "Value" });
    await userEvent.type(valueInput, "-12.5", { delay: 20 });
    await expect(valueInput).toHaveValue("-12.5");
    expect(canvas.queryByRole("group", { name: "Score filter" })).toBeNull();
    await userEvent.click(within(picker).getByRole("button", { name: "Apply filter" }));
    const pill = within(canvas.getByRole("group", { name: "Score filter" }));
    await expect(pill.getByRole("spinbutton", { name: "Value" })).toHaveValue(-12.5);
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
    const column = within(picker);
    await userEvent.click(column.getByRole("button", { name: "Priority", exact: true }));
    expect(canvas.queryByRole("group", { name: "Priority filter" })).toBeNull();
    await Promise.all(
      picker
        .closest("[data-part=content]")!
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    );
    const bounds = picker.getBoundingClientRect();
    await userEvent.click(column.getByRole("checkbox", { name: "High", exact: true }));
    await expect(picker).toBeVisible();
    await waitFor(() => expect(picker.getBoundingClientRect().top).toBe(bounds.top));
    expect(picker.getBoundingClientRect().left).toBe(bounds.left);
    const pill = within(canvas.getByRole("group", { name: "Priority filter" }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("High");
    await expect(column.getByRole("checkbox", { name: "High", exact: true })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(column.getByRole("checkbox", { name: "Medium", exact: true }));
    await expect(pill.getByRole("button", { name: "Condition" })).toHaveTextContent("is any of");
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("High, Medium");
    const checkbox = column.getByRole("checkbox", { name: "High", exact: true }).querySelector("[data-part=control]")!;
    expect(checkbox.getBoundingClientRect().width).toBe(12);
    await userEvent.click(column.getByRole("checkbox", { name: "High", exact: true }));
    await userEvent.click(column.getByRole("checkbox", { name: "Medium", exact: true }));
    expect(canvas.queryByRole("group", { name: "Priority filter" })).toBeNull();
    await expect(picker).toBeVisible();
    await userEvent.click(column.getByRole("checkbox", { name: "Low", exact: true }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(picker).not.toBeVisible());
    await userEvent.click(
      within(canvas.getByRole("group", { name: "Priority filter" })).getByRole("button", { name: "Condition" }),
    );
    await userEvent.click(body.getByRole("menuitem", { name: "is not", exact: true }));
    await expect(
      within(canvas.getByRole("group", { name: "Priority filter" })).getByRole("button", { name: "Condition" }),
    ).toHaveTextContent("is not");
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
    await userEvent.click(within(picker).getByRole("button", { name: "Apply filter", exact: true }));
    const pill = within(canvas.getByRole("group", { name: "Title filter" }));
    const input = await pill.findByRole("textbox", { name: "Value" });
    expect(getComputedStyle(input).outlineStyle).toBe("none");
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

export const DateParameterFields: Story = {
  render: () => <Bar storageKey="storybook-date-parameter-fields" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Filter", exact: true }));
    const picker = await body.findByTestId("filter-menu");
    await userEvent.click(within(picker).getByRole("button", { name: "Updated", exact: true }));
    const relative = within(picker).getByRole("button", { name: "Relative day" });
    const exact = within(picker).getByLabelText("Exact day");
    await waitFor(() => expect(exact.getBoundingClientRect().height).toBe(32));
    expect(relative.getBoundingClientRect().width).toBe(exact.getBoundingClientRect().width);
    expect(exact.getBoundingClientRect().top).toBeGreaterThan(relative.getBoundingClientRect().bottom);
    const column = picker.querySelector('[data-testid="filter-value-column"]')!;
    expect(exact.getBoundingClientRect().right).toBeLessThanOrEqual(column.getBoundingClientRect().right);
    fireEvent.change(exact, { target: { value: "2026-10-04" } });
    await userEvent.click(within(picker).getByRole("button", { name: "Apply filter" }));
    await expect(canvas.getByRole("group", { name: "Updated filter" })).toBeVisible();
  },
};
