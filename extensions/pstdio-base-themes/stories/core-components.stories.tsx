import { Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Buttons, Inputs } from "./buttons-and-inputs";
import { ComposedComponents } from "./composed-components";
import { contrastRatio } from "./contrast";
import { Foundations } from "./foundations";
import { DataAndFeedback, Navigation } from "./navigation-and-feedback";
import { Overlays } from "./overlays";

const sections = {
  foundations: Foundations,
  buttons: Buttons,
  inputs: Inputs,
  navigation: Navigation,
  feedback: DataAndFeedback,
  overlays: Overlays,
  composed: ComposedComponents,
};

export type Section = "all" | keyof typeof sections;

function CoreComponents(props: { section: Section }) {
  const { section } = props;
  const visible = section === "all" ? Object.entries(sections) : ([[section, sections[section]]] as const);
  return (
    <Stack data-testid="theme-canvas" gap="xl" p="md" bg="bg" color="fg" minH="100vh">
      {visible.map(([id, Component]) => (
        <Component key={id} />
      ))}
    </Stack>
  );
}

const meta = {
  title: "Themes/Single theme",
  component: CoreComponents,
  args: { section: "all" },
  argTypes: { section: { control: "select", options: ["all", ...Object.keys(sections)] } },
} satisfies Meta<typeof CoreComponents>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Core: Story = {};

export const InteractionChecks: Story = {
  globals: { theme: "solarized-light" },
  play: async ({ canvasElement, args, globals }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(document.body.dataset.theme).toBe(globals.theme));
    if (args.section === "all" || args.section === "foundations") {
      for (const surface of canvasElement.querySelectorAll<HTMLElement>("[data-theme-surface]")) {
        const background = getComputedStyle(surface).backgroundColor;
        for (const text of surface.querySelectorAll("p")) {
          await expect(contrastRatio(getComputedStyle(text).color, background)).toBeGreaterThanOrEqual(4.5);
        }
      }
      const sample = canvasElement.querySelector<HTMLElement>("[data-theme-surface] p")!;
      const selection = getComputedStyle(sample, "::selection");
      await expect(contrastRatio(selection.color, selection.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    }
    if (args.section === "all" || args.section === "buttons") {
      const resting = canvas.getAllByRole("button", { name: "Default" })[0];
      const hovered = canvas.getAllByRole("button", { name: "Hover" })[0];
      await expect(getComputedStyle(resting).backgroundColor).not.toBe(getComputedStyle(hovered).backgroundColor);
      for (const state of ["Default", "Hover", "Pressed"]) {
        const primary = canvas.getAllByRole("button", { name: state })[0];
        await waitFor(() => {
          const style = getComputedStyle(primary);
          return expect(contrastRatio(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
        });
      }
      const ghost = canvas.getAllByRole("button", { name: "Hover" })[2];
      await waitFor(() => expect(getComputedStyle(ghost).backgroundColor).not.toBe("rgba(0, 0, 0, 0)"));
    }
    if (args.section === "all" || args.section === "inputs") {
      const checkbox = canvas.getByRole("checkbox", { name: "Unchecked" });
      await userEvent.click(checkbox);
      await expect(checkbox).toBeChecked();
      await userEvent.click(checkbox);
    }
    if (args.section === "all" || args.section === "navigation") {
      const panel = canvas.getByTestId("navigation-panel");
      const hoveredRow = canvas.getByTestId("panel-hover-row");
      const rowBackground = getComputedStyle(hoveredRow).backgroundColor;
      await expect(rowBackground).not.toBe("rgba(0, 0, 0, 0)");
      await expect(rowBackground).not.toBe(getComputedStyle(panel).backgroundColor);
      await expect(rowBackground).not.toBe(getComputedStyle(canvas.getByTestId("theme-canvas")).backgroundColor);
      const advanced = canvas.getByRole("tab", { name: "Advanced" });
      await userEvent.click(advanced);
      await expect(advanced).toHaveAttribute("aria-selected", "true");
      await userEvent.click(canvas.getByRole("tab", { name: "General" }));
    }
  },
};

export const SolarizedDarkChecks: Story = { ...InteractionChecks, globals: { theme: "solarized-dark" } };
export const DraculaChecks: Story = { ...InteractionChecks, globals: { theme: "dracula" } };
export const MonokaiChecks: Story = { ...InteractionChecks, globals: { theme: "monokai" } };
