import { Box, Button, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";

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
} satisfies CanvasMeta<typeof ManualMarkdownFile>;
export default meta;
type Story = CanvasVariant<typeof meta>;

export const ExplicitSave: Story = {
  id: "manual-markdown--explicit-save",
};
