import { Box, Button, ChakraProvider, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { ScopedDialog as Dialog, ScopedMenu as Menu, Portal, psTheme, useFileIconThemePreference } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench, createWorkbenchStore, type WorkbenchCore } from "../../core";
import { createLocalStorageWorkbenchPersistence } from "../../storage";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { Workbench } from "./workbench";

const Editor = (props: { name: string; calls: ReturnType<typeof createWorkbenchStore<{ count: number }>> }) => {
  const { name, calls } = props;
  const { fileIconThemePreference, setFileIconThemePreference } = useFileIconThemePreference();
  const [draft, setDraft] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const count = useWorkbenchStore(calls, (state) => state.count);
  return (
    <Stack p="md" gap="sm">
      <Text>{name}</Text>
      <Text>
        {name} icons: {fileIconThemePreference}
      </Text>
      <Button size="sm" onClick={() => setFileIconThemePreference("icons.two")}>
        {name} choose icons
      </Button>
      <Input aria-label={`${name} draft`} value={draft} onChange={(event) => setDraft(event.target.value)} />
      <Text role="status">
        {name} shortcut calls: {count}
      </Text>
      <Menu.Root closeOnSelect={false}>
        <Menu.Trigger asChild>
          <Button size="sm">{name} menu</Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content aria-label={`${name} menu`}>
              <Menu.Item value="action">{name} action</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
      <Button size="sm" onClick={() => setDialogOpen(true)}>
        {name} dialog
      </Button>
      <Dialog.Root open={dialogOpen} onOpenChange={(details) => setDialogOpen(details.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{name} dialog</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Input aria-label={`${name} dialog draft`} />
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="sm" onClick={() => setDialogOpen(false)}>
                  Close dialog
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  );
};

const createExample = (name: string, active: boolean) => {
  const page = { kind: "page", extensionId: "multiple", id: "editor" } as const;
  const workbench = createWorkbench({
    active,
    startPage: page,
    ...createLocalStorageWorkbenchPersistence({ namespace: "multiple-workbenches", scope: name }),
  });
  workbench.fileIconThemes.register(
    ["icons.one", "icons.two"].map((id) => ({
      id,
      definitions: {},
      fileExtensions: {},
      fileNames: {},
      defaults: {},
      fonts: [],
    })),
  );
  const calls = createWorkbenchStore({ initialState: { count: 0 } });
  workbench.commands.registerCommand(
    { id: "increment", label: "Increment" },
    {
      execute: () => calls.setState({ count: calls.getState().count + 1 }),
    },
  );
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "increment" },
    keybinding: "Alt+J",
    allowInInputs: true,
  });
  workbench.modes.registerMode({
    id: name,
    defaultTheme: name === "A" ? "pstdio-dark" : "pstdio-light",
    activate() {},
  });
  workbench.views.registerView({
    id: "editor",
    title: name,
    body: { kind: "react", render: () => <Editor name={name} calls={calls} /> },
  });
  workbench.pages.registerPage({
    id: "editor",
    ref: page,
    title: name,
    path: "editor",
    modeId: name,
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.boot(name);
  return workbench;
};

const MultipleWorkbenches = () => {
  const [workbenches] = useState(() => [createExample("A", true), createExample("B", false)]);
  const select = (selected: WorkbenchCore) => {
    for (const workbench of workbenches) if (workbench !== selected) workbench.activation.setActive(false);
    selected.activation.setActive(true);
  };
  return (
    <ChakraProvider value={psTheme}>
      <Stack h="100dvh" gap="0">
        <HStack p="sm">
          {workbenches.map((workbench, index) => (
            <Button key={index} size="sm" onClick={() => select(workbench)}>
              Select {index ? "B" : "A"}
            </Button>
          ))}
          <Button
            size="sm"
            onClick={() =>
              workbenches[0]!.notifications.show({
                id: "same-error",
                level: "error",
                title: "A background failure",
                message: "This error belongs to A.",
              })
            }
          >
            Report A error
          </Button>
        </HStack>
        <Box flex="1" minH="0">
          {workbenches.map((workbench, index) => (
            <Workbench key={index} workbench={workbench} />
          ))}
        </Box>
      </Stack>
    </ChakraProvider>
  );
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Multiple workbenches",
  component: MultipleWorkbenches,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MultipleWorkbenches>;
export default meta;
type Story = StoryObj<typeof meta>;

export const RetainedProjects: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(document.documentElement).toHaveAttribute("data-theme", "pstdio-dark");
    await userEvent.type(canvas.getByRole("textbox", { name: "A draft" }), "Unsaved A");
    await userEvent.click(canvas.getByRole("button", { name: "Select B" }));
    await expect(canvas.queryByRole("textbox", { name: "A draft" })).toBeNull();
    await expect(document.documentElement).toHaveAttribute("data-theme", "pstdio-light");
    await userEvent.type(canvas.getByRole("textbox", { name: "B draft" }), "Unsaved B");
    await userEvent.click(canvas.getByRole("button", { name: "B choose icons" }));
    await userEvent.click(canvas.getByRole("button", { name: "Report A error" }));
    await expect(canvas.queryByRole("button", { name: "System errors: A background failure" })).toBeNull();
    await userEvent.keyboard("{Alt>}j{/Alt}");
    await expect(canvas.getByText("B shortcut calls: 1")).toHaveTextContent("B shortcut calls: 1");
    await userEvent.click(canvas.getByRole("button", { name: "Select A" }));
    await expect(canvas.getByRole("textbox", { name: "A draft" })).toHaveValue("Unsaved A");
    await expect(canvas.getByText("A shortcut calls: 0")).toBeVisible();
    await expect(canvas.getByText("A icons: icons.two")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "System errors: A background failure" })).toBeVisible();
  },
};

const StandaloneExample = () => {
  const [workbench] = useState(() => createExample("A", true));
  return <Workbench workbench={workbench} />;
};

export const Standalone: Story = { render: () => <StandaloneExample /> };
