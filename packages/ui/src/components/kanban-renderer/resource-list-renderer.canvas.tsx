import { Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { ResourceListRenderer } from "./resource-list-renderer";

export default { title: "Design system/Patterns/Resource list/Renderer", fullscreen: true };

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

const regionOptions = [
  { value: "eu", label: "Europe", color: "blue" },
  { value: "us", label: "United States", color: "orange" },
];
const channelOptions = [
  { value: "web", label: "Web shop", color: "green" },
  { value: "marketplace", label: "Marketplace", color: "purple" },
];

/** Display offers Sub-grouping, Sub-grouping 2 and more; child rows nest more than one level. */
export const NestedGroups = () => {
  const [opened, setOpened] = useState("");
  return (
    <Stack height="full" minH="0" gap="0">
      <Text aria-live="polite" paddingX="sm" paddingY="2xs" textStyle="label/XS/regular" color="fg.muted">
        {opened ? `Opened ${opened}` : "Open Display to add sub-groupings or hide child rows"}
      </Text>
      <ResourceListRenderer
        storageKey="resource-list-nested-groups-preview"
        attributes={[
          {
            id: "region",
            label: "Region",
            groupable: true,
            filterable: true,
            type: { kind: "enum", options: regionOptions },
          },
          {
            id: "channel",
            label: "Channel",
            groupable: true,
            filterable: true,
            type: { kind: "enum", options: channelOptions },
          },
          { id: "date", label: "Updated", type: { kind: "date" }, sortable: true },
        ]}
        defaultSettings={{
          viewMode: "list",
          columnGrouping: "region",
          subGroupings: ["channel"],
          showChildren: true,
          displayProperties: ["date"],
        }}
        rows={[
          {
            id: "rule-eu-web-title",
            title: "Title starts with brand",
            icon: "book-open",
            attributes: { id: "R-12", region: "eu", channel: "web", date: "2026-11-02" },
            children: [
              {
                id: "check-title-length",
                title: "Title is at most 150 characters",
                icon: "list-checks",
                attributes: {},
                children: [
                  { id: "example-title", title: "Example: Northline Trail Shoe", icon: "file-text", attributes: {} },
                ],
              },
            ],
          },
          {
            id: "rule-eu-web-images",
            title: "Main image on white",
            icon: "book-open",
            attributes: { id: "R-14", region: "eu", channel: "web", date: "2026-10-28" },
          },
          {
            id: "rule-eu-market-gtin",
            title: "GTIN is present",
            icon: "book-open",
            attributes: { id: "R-21", region: "eu", channel: "marketplace", date: "2026-10-30" },
          },
          {
            id: "rule-us-web-price",
            title: "Price includes currency",
            icon: "book-open",
            attributes: { id: "R-31", region: "us", channel: "web", date: "2026-11-05" },
          },
          {
            id: "rule-us-market-bullets",
            title: "Five bullet points",
            icon: "book-open",
            attributes: { id: "R-35", region: "us", channel: "marketplace", date: "2026-11-01" },
          },
        ]}
        onRowClick={(row) => setOpened(row.title)}
      />
    </Stack>
  );
};
