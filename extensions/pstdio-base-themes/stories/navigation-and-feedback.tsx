import {
  Badge,
  Box,
  HStack,
  Kbd,
  Progress,
  Separator,
  Skeleton,
  Spinner,
  Stack,
  Table,
  Tabs,
  Text,
} from "@chakra-ui/react";
import {
  AlertMessage,
  Breadcrumb,
  Chip,
  EmptyState,
  ListRow,
  SegmentedControl,
  SimpleCard,
  SimpleCardBody,
  TreeList,
  WindowTabs,
} from "@pstdio/ui";
import { useState } from "react";
import { GallerySection } from "./gallery-section";

export function Navigation() {
  const [segment, setSegment] = useState("list");
  const [tab, setTab] = useState<string | undefined>("overview");
  const [row, setRow] = useState("selected");
  const [expandedNodes, setExpandedNodes] = useState(["folder"]);
  return (
    <GallerySection title="Navigation and lists">
      <Breadcrumb items={[{ title: "Project", onClick: () => setRow("project") }, { title: "Settings" }]} />
      <Tabs.Root defaultValue="general" size="sm">
        <Tabs.List>
          <Tabs.Trigger value="general">General</Tabs.Trigger>
          <Tabs.Trigger value="advanced">Advanced</Tabs.Trigger>
          <Tabs.Trigger value="disabled" disabled>
            Disabled
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="general">General settings</Tabs.Content>
        <Tabs.Content value="advanced">Advanced settings</Tabs.Content>
      </Tabs.Root>
      <SegmentedControl
        aria-label="View"
        options={[
          { label: "List", value: "list" },
          { label: "Grid", value: "grid" },
        ]}
        value={segment}
        onValueChange={setSegment}
      />
      <WindowTabs
        aria-label="Open resources"
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "notes", label: "Notes" },
        ]}
        selectedId={tab}
        onSelect={setTab}
        onClose={() => setTab(undefined)}
      />
      <Box data-testid="navigation-panel" bg="bg.panel" p="sm" borderWidth="1px" borderColor="border.subtle">
        <Text color="fg.muted" textStyle="label/S/regular">
          Rows on a panel surface
        </Text>
        <ListRow
          id="default"
          label="Default row"
          description="Hover or select this row"
          isSelected={row === "default"}
          onClick={() => setRow("default")}
        />
        <ListRow
          id="selected"
          label="Selected row"
          isSelected={row === "selected"}
          onClick={() => setRow("selected")}
        />
        <ListRow id="hovered" label="Hovered row" data-testid="panel-hover-row" data-hover="" />
        <ListRow id="disabled" label="Disabled row" disabled />
        <TreeList
          expandedSectionIds={["files"]}
          expandedNodeIds={expandedNodes}
          onToggleNode={(id) => setExpandedNodes(expandedNodes.includes(id) ? [] : [id])}
          sections={[
            {
              id: "files",
              label: "Files",
              nodes: [
                { id: "folder", label: "Folder", isContainer: true, children: [{ id: "readme", label: "README.md" }] },
              ],
            },
          ]}
        />
      </Box>
    </GallerySection>
  );
}

export function DataAndFeedback() {
  return (
    <GallerySection title="Data display and feedback">
      <HStack flexWrap="wrap">
        <Badge variant="ticket">Ticket</Badge>
        <Badge variant="chip">Chip badge</Badge>
        <Chip>Label</Chip>
        <Kbd>⌘ K</Kbd>
      </HStack>
      <SimpleCard>
        <SimpleCardBody>
          <Stack gap="2xs">
            <Text>Card heading</Text>
            <Text color="fg.muted">Muted supporting text</Text>
            <Text color="fg.subtle">Subtle text</Text>
          </Stack>
        </SimpleCardBody>
      </SimpleCard>
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Resource</Table.ColumnHeader>
            <Table.ColumnHeader>Status</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Theme audit</Table.Cell>
            <Table.Cell>Ready</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>Component review</Table.Cell>
            <Table.Cell>In progress</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
      <Separator />
      {(["info", "success", "warning", "error"] as const).map((status) => (
        <AlertMessage key={status} status={status} variant="subtle" title={status}>
          Supporting status text
        </AlertMessage>
      ))}
      <Progress.Root value={65} size="sm">
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
      <HStack>
        <Spinner size="sm" />
        <Text color="fg.muted">Loading</Text>
      </HStack>
      <Skeleton height="6" />
      <EmptyState title="No resources" description="Create a resource to get started." size="sm" />
    </GallerySection>
  );
}
