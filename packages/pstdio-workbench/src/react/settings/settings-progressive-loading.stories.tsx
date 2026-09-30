import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
} satisfies Meta<typeof ProgressiveSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const IndependentCollections: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const general = await body.findByRole("option", { name: "General" });
    const skills = body.getByRole("option", { name: "Skills" });
    const templates = body.getByRole("option", { name: "Templates" });
    await expect(general).toBeVisible();
    await userEvent.click(skills);
    await userEvent.click(templates);
    await userEvent.click(body.getByRole("button", { name: "Load templates" }));
    await expect(await body.findByRole("option", { name: "Ticket template" })).toBeVisible();
    await expect(body.queryByRole("option", { name: "Review skill" })).not.toBeInTheDocument();
    await expect(general).toBe(body.getByRole("option", { name: "General" }));
    await expect(skills).toBe(body.getByRole("option", { name: "Skills" }));
    await userEvent.click(body.getByRole("button", { name: "Load skills" }));
    await expect(await body.findByRole("option", { name: "Review skill" })).toBeVisible();
    await expect(general).toBe(body.getByRole("option", { name: "General" }));
    await expect(templates).toBe(body.getByRole("option", { name: "Templates" }));
    const skill = body.getByRole("option", { name: "Review skill" });
    const template = body.getByRole("option", { name: "Ticket template" });
    await userEvent.click(body.getByRole("button", { name: "Refresh collections" }));
    await expect(skill).toBeVisible();
    await expect(template).toBeVisible();
    await userEvent.click(body.getByRole("button", { name: "Load templates" }));
    await expect(skill).toBeVisible();
    await userEvent.click(body.getByRole("button", { name: "Load skills" }));
    await waitFor(() => expect(skill).toBe(body.getByRole("option", { name: "Review skill" })));
    await expect(template).toBe(body.getByRole("option", { name: "Ticket template" }));
  },
};
