import { Box, Button, ChakraProvider, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import {
  ScopedDialog as Dialog,
  ScopedMenu as Menu,
  Portal,
  psTheme,
  useFileIconThemePreference,
  useThemePreference,
} from "@pstdio/ui";
import { ColorInput } from "@pstdio/ui/param-editor";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useEffect, useState } from "react";
import { createWorkbench, createWorkbenchStore, type WorkbenchCore } from "../../core";
import { createLocalStorageWorkbenchPersistence } from "../../storage";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "./workbench";

const Editor = (props: {
  name: string;
  calls: ReturnType<typeof createWorkbenchStore<{ count: number }>>;
  richText?: boolean;
}) => {
  const { name, calls, richText } = props;
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
      <ColorInput id="color" name={`${name} color`} defaultValue="#ff0000" description="" onChange={() => {}} />
      {richText ? (
        <Box role="group" aria-label={`${name} rich text`} minH="xs">
          <MarkdownEditor defaultState="" isEditable fullWidth scrollable={false} />
        </Box>
      ) : null}
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

const createExampleStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

const createExample = (
  storage: ReturnType<typeof createExampleStorage>,
  name: string,
  active: boolean,
  richText = false,
) => {
  const page = { kind: "page", extensionId: "multiple", id: "editor" } as const;
  const workbench = createWorkbench({
    active,
    startPage: page,
    ...createLocalStorageWorkbenchPersistence({ namespace: "multiple-workbenches", scope: name, storage }),
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
    body: { kind: "react", render: () => <Editor name={name} calls={calls} richText={richText} /> },
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

const MultipleWorkbenches = (props: { richText?: boolean }) => {
  const [workbenches, setWorkbenches] = useState<WorkbenchCore[]>([]);
  useEffect(() => {
    const storage = createExampleStorage();
    const examples = [
      createExample(storage, "A", true, props.richText),
      createExample(storage, "B", false, props.richText),
    ];
    setWorkbenches(examples);
    return () => {
      for (const workbench of examples) void workbench.dispose();
    };
  }, [props.richText]);
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
              workbenches[0]?.notifications.show({
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
} satisfies CanvasMeta<typeof MultipleWorkbenches>;
export default meta;
type Story = CanvasVariant<typeof meta>;

export const RetainedProjects: Story = {
  id: "pstdio-workbench-reference-core-api-multiple-workbenches--retained-projects",
};

const StandaloneExample = () => {
  const [workbench, setWorkbench] = useState<WorkbenchCore>();
  useEffect(() => {
    const example = createExample(createExampleStorage(), "A", true);
    setWorkbench(example);
    return () => {
      void example.dispose();
    };
  }, []);
  return workbench ? <Workbench workbench={workbench} /> : null;
};

export const Standalone: Story = {
  id: "pstdio-workbench-reference-core-api-multiple-workbenches--standalone",
  render: () => <StandaloneExample />,
};

export const RichTextEditors: Story = {
  id: "pstdio-workbench-reference-core-api-multiple-workbenches--rich-text-editors",
  args: { richText: true },
};

const ThemeControls = () => {
  const { themePreference, toggleThemePreference } = useThemePreference();
  return <Button onClick={toggleThemePreference}>Outer theme: {themePreference}</Button>;
};

const InheritedThemeExample = () => {
  const [generation, setGeneration] = useState(0);
  const [storage] = useState(createExampleStorage);
  return (
    <WorkbenchThemeProvider themeStorage={storage}>
      <ThemeControls />
      <Button onClick={() => setGeneration(generation + 1)}>Remount workbenches</Button>
      <MultipleWorkbenches key={generation} />
    </WorkbenchThemeProvider>
  );
};

export const InheritedTheme: Story = {
  id: "pstdio-workbench-reference-core-api-multiple-workbenches--inherited-theme",
  render: () => <InheritedThemeExample />,
};
