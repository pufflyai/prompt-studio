import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";

import * as Y from "yjs";
import { createWorkbench } from "../../core";
import type {
  NativeDocumentSession,
  NativeDocumentSessionSnapshot,
} from "../../core/native-documents/native-document-session";
import { WorkbenchStory } from "../../examples/workbench-story";

const RetainedDocumentPresence = () => {
  const [opened, setOpened] = useState(0);
  const [closed, setClosed] = useState(0);
  const [fixture] = useState(() => {
    const page = { kind: "page" as const, extensionId: "storybook", id: "notes" };
    const workbench = createWorkbench({ startPage: page });
    const resource = (id: string) => ({
      type: "note",
      id,
      label: id === "first" ? "Retained note" : "Other note",
      extensionId: "storybook",
      projectId: "presence",
    });
    const connect = (id: string): NativeDocumentSession => {
      setOpened((value) => value + 1);
      const document = new Y.Doc();
      document.getText("content").insert(0, "A retained document.");
      const listeners = new Set<() => void>();
      const participants: NativeDocumentSessionSnapshot["participants"] = [
        {
          kind: "native-document-presence",
          version: 1,
          extensionId: "storybook",
          documentKey: id,
          action: "upsert",
          deviceId: id,
          participantId: id,
          label: id === "first" ? "Alex" : "Sam",
          deviceName: "internal-device-id",
          seedId: "seed",
          selection: null,
        },
      ];
      let snapshot: NativeDocumentSessionSnapshot = { document, connected: true, pending: false, participants };
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        setOpen(open) {
          snapshot = { ...snapshot, participants: open ? participants : [] };
          for (const listener of listeners) listener();
        },
        setSelection: async () => {},
        start: async () => {},
        flush: async () => {},
        retry: async () => {},
        close: async () => {
          document.destroy();
          setClosed((value) => value + 1);
        },
      };
    };
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "note", label: "Note", icon: "file-text", extensionId: "storybook" });
    workbench.views.registerView({
      id: "note-editor",
      title: "Note",
      body: {
        kind: "file",
        load: (note) => ({
          fileName: "note.md",
          content: "",
          documentSource: { kind: "workspace", path: `${note?.id}.md` },
        }),
        save: () => {},
        connectDocument: (note) => connect(note!.id),
      },
    });
    workbench.pages.registerPage({
      id: "notes",
      ref: page,
      path: "notes",
      modeId: "project",
      main: { kind: "panels" },
      slots: [
        {
          id: "note",
          region: "main",
          mountStrategy: "keep-mounted",
          item: {
            kind: "binding",
            binding: {
              kinds: [{ kind: "resource-kind", id: "note" }],
              view: { kind: "view", id: "note-editor" },
              cardinality: "many",
            },
          },
        },
      ],
    });
    workbench.pageLocations.setProject("presence");
    workbench.pageLocations.navigate({ kind: "page", page });
    const open = (id: string) =>
      workbench.pages.openSlot({ pageId: "notes", slotId: "note", resource: resource(id), open: "pin" });
    const close = (id: string) => {
      const placement = workbench.host.getOpenPlacements().find((value) => value.resource?.id === id);
      if (placement?.placementIdentity) workbench.closePlacement(placement.placementIdentity);
    };
    open("first");
    return { workbench, open, close, remove: () => workbench.resources.removed(resource("first")) };
  });
  return (
    <Stack>
      <HStack>
        <Button onClick={() => fixture.open("second")}>Open other note</Button>
        <Button onClick={() => fixture.close("first")}>Close retained note</Button>
        <Button onClick={() => fixture.open("first")}>Reopen retained note</Button>
        <Button onClick={fixture.remove}>Delete retained note</Button>
        <Button onClick={() => fixture.close("second")}>Close other note</Button>
      </HStack>
      <Text aria-label="Opened sessions">{opened}</Text>
      <Text aria-label="Closed sessions">{closed}</Text>
      <WorkbenchStory workbench={fixture.workbench} />
    </Stack>
  );
};

const meta = {
  title: "pstdio-workbench/Guides/Header presence/Retained views",
  component: RetainedDocumentPresence,
  parameters: { layout: "fullscreen" },
  tags: ["!manifest"],
} satisfies CanvasMeta<typeof RetainedDocumentPresence>;
export default meta;
type Story = CanvasVariant<typeof meta>;

export const CloseAndReopen: Story = {
  id: "note--close-and-reopen",
};
