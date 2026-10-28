import { Box, Button, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { WorkbenchFileRendererView } from "./file-renderer-view";

const ManualMarkdownFile = () => {
  const [saved, setSaved] = useState({ count: 0, content: "" });
  const [open, setOpen] = useState(true);
  const [fixture] = useState(() => {
    const workbench = createWorkbench();
    const renderers = getWorkbenchRenderers(workbench);
    renderers.registerFileRenderer({
      id: "manual-markdown",
      title: "Manual Markdown",
      saveMode: "manual",
      documentKey: () => "manual.md",
      load: () => ({
        fileName: "manual.md",
        filePath: "manual.md",
        content: "# Manual file\n\nInitial content.",
        documentSource: { kind: "workspace", path: "manual.md" },
      }),
      save: (_resource, content) => {
        setSaved((previous) => ({ count: previous.count + 1, content }));
      },
      connectDocument: () => {
        throw new Error("A manual file must not connect to the autosaving native document session.");
      },
    });
    return { workbench, contribution: renderers.getFileRenderer("manual-markdown")! };
  });
  return (
    <WorkbenchThemeProvider>
      <Box h="lg">
        <Button onClick={() => setOpen(false)}>Close file</Button>
        <Text aria-label="Save count">{saved.count}</Text>
        <Text aria-label="Saved content">{saved.content}</Text>
        {open && <WorkbenchFileRendererView workbench={fixture.workbench} contribution={fixture.contribution} />}
      </Box>
    </WorkbenchThemeProvider>
  );
};

const meta = {
  title: "Renderers/Manual Markdown File Editor",
  component: ManualMarkdownFile,
  tags: ["!manifest"],
} satisfies Meta<typeof ManualMarkdownFile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ExplicitSave: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector('[contenteditable="true"]')).not.toBeNull());
    const editor = canvasElement.querySelector<HTMLElement>('[contenteditable="true"]')!;
    await expect(canvas.getByLabelText("File path manual.md")).toBeVisible();
    await userEvent.click(editor);
    await userEvent.keyboard(" Draft");
    await expect(canvas.getByRole("status", { name: "Unsaved changes" })).toBeVisible();
    await expect(canvas.getByLabelText("Save count")).toHaveTextContent("0");
    window.dispatchEvent(new Event("beforeunload"));
    await expect(canvas.getByLabelText("Save count")).toHaveTextContent("0");
    await userEvent.keyboard("{Control>}s{/Control}");
    await waitFor(() => expect(canvas.getByLabelText("Save count")).toHaveTextContent("1"));
    await expect(canvas.getByLabelText("Saved content")).toHaveTextContent("Draft");
    await expect(canvas.queryByRole("status", { name: "Unsaved changes" })).not.toBeInTheDocument();
    await userEvent.keyboard(" Unsaved");
    await expect(canvas.getByRole("status", { name: "Unsaved changes" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Close file" }));
    await expect(canvas.getByLabelText("Save count")).toHaveTextContent("1");
    await expect(canvas.getByLabelText("Saved content")).not.toHaveTextContent("Unsaved");
  },
};
