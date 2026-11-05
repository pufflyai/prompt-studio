import { Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { ResourceListRenderer } from "./resource-list-renderer";

export default { title: "Patterns/Resource List/Renderer", fullscreen: true };

export const GroupedAndNested = () => {
  const [opened, setOpened] = useState("");
  const [created, setCreated] = useState(0);
  return (
    <Stack height="full" minH="0" gap="0">
      <Text aria-live="polite">
        {opened ? `Opened ${opened}` : "Choose a resource"} · Created {created}
      </Text>
      <ResourceListRenderer
        storageKey="resource-list-grouped-preview"
        selectedRowId="group::local"
        attributes={[
          {
            id: "device",
            label: "Device",
            groupable: true,
            filterable: true,
            type: {
              kind: "enum",
              options: [
                { value: "local", label: "This device", color: "green", note: "Online", canCreate: true },
                { value: "remote", label: "Build box", color: "gray", note: "Offline" },
              ],
            },
          },
          { id: "date", label: "Updated", type: { kind: "date" }, sortable: true },
        ]}
        defaultSettings={{
          viewMode: "list",
          columnGrouping: "device",
          showChildren: true,
          displayProperties: ["date"],
        }}
        rows={[
          {
            id: "group::local",
            title: "Improve search",
            icon: "folder-git-2",
            attributes: { id: "WS-12", device: "local", date: "2026-10-12" },
            children: [{ id: "session", title: "Check search results", icon: "message-square", attributes: {} }],
          },
          { id: "remote", title: "Build release", icon: "folder", attributes: { device: "remote" } },
        ]}
        onRowClick={(row) => setOpened(row.title)}
        getRowContextMenuActions={(row) => [
          { key: "open", label: "Open resource", onClick: () => setOpened(row.title) },
        ]}
        createRow={{
          title: "New resource",
          submitLabel: "Create",
          fields: [],
          labels: { cancel: "Cancel", properties: "Properties", submitError: "Could not create", removeFile: "Remove" },
        }}
        onCreateRow={() => {
          setCreated((count) => count + 1);
        }}
      />
    </Stack>
  );
};

export const Empty = () => (
  <ResourceListRenderer storageKey="resource-list-empty" attributes={[]} rows={[]} emptyTitle="No resources yet" />
);
