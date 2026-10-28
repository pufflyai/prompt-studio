import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useEffect, useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "../workbench/workbench";
import { createWorkbenchSettingsModule, WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "./settings-module";

const registerFixture = (workbench: ReturnType<typeof createWorkbench>) => {
  const collections = { skills: Promise.withResolvers<string[]>(), templates: Promise.withResolvers<string[]>() };
  const contributions = workbench.registerModule({
    id: "storybook.progressive-settings",
    activate(ctx) {
      ctx.views.registerView({
        id: "settings-content",
        title: "Settings content",
        body: {
          kind: "react",
          render: () => (
            <Stack p="md" gap="md">
              <Text>General settings</Text>
              <Button onClick={() => collections.templates.resolve(["Ticket template"])}>Load templates</Button>
              <Button onClick={() => collections.skills.resolve(["Review skill"])}>Load skills</Button>
              <Button
                onClick={() => {
                  collections.skills = Promise.withResolvers<string[]>();
                  collections.templates = Promise.withResolvers<string[]>();
                  ctx.settings.refresh();
                }}
              >
                Refresh collections
              </Button>
            </Stack>
          ),
        },
      });
      ctx.settings.registerSection({ id: "general", title: "Workbench" });
      ctx.settings.registerPanel({
        id: "general",
        title: "General",
        kind: "view",
        section: "general",
        viewId: "settings-content",
        order: 0,
      });
      for (const [id, title] of [
        ["skills", "Skills"],
        ["templates", "Templates"],
      ] as const) {
        ctx.settings.registerPanel<string>({
          id,
          title,
          kind: "collection",
          section: "general",
          viewId: "settings-content",
          order: 10,
          items: () => collections[id].promise,
          itemId: (item) => item,
          itemLabel: (item) => item,
        });
      }
    },
  });
  const settings = workbench.registerModule(createWorkbenchSettingsModule({ resolveScopeId: () => "storybook" }));
  return () => {
    settings.dispose();
    contributions.dispose();
  };
};
const ProgressiveSettings = () => {
  const [workbench] = useState(() => createWorkbench());
  useEffect(() => {
    const dispose = registerFixture(workbench);
    void workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID);
    return dispose;
  }, [workbench]);
  return <Workbench workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Settings progressive loading",
  component: ProgressiveSettings,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Box height="100vh">
          <Story />
        </Box>
      </WorkbenchThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies CanvasMeta<typeof ProgressiveSettings>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const IndependentCollections: Story = {
  id: "pstdio-workbench-reference-core-api-settings-progressive-loading--independent-collections",
};
