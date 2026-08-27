import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { buildWorkbenchExtensionMenuRegistrations, emptyWorkbenchExtensionMetadata } from "../../extensions";

const resourceKinds = [
  { id: "note", label: "Note", slotId: "note.headerPrimary" },
  { id: "incident", label: "Incident", slotId: "incident.context" },
] as const;

const metadata = {
  ...emptyWorkbenchExtensionMetadata,
  commands: resourceKinds.map((kind) => ({
    id: `example.command.${kind.id}`,
    extensionId: "example.resources",
    title: `Open ${kind.label.toLowerCase()}`,
  })),
  menuContributions: [
    ...resourceKinds.map((kind) => ({
      id: `example.menu.${kind.id}`,
      extensionId: "example.resources",
      commandId: `example.command.${kind.id}`,
      slotId: kind.slotId,
      label: `Open ${kind.label.toLowerCase()}`,
    })),
    {
      id: "example.menu.unknown",
      extensionId: "example.resources",
      commandId: "example.command.note",
      slotId: "unknown.headerPrimary",
      label: "Unknown action",
    },
  ],
} satisfies WorkbenchExtensionMetadata;

const result = buildWorkbenchExtensionMenuRegistrations({
  metadata,
  menuSlotsById: new Map([
    ["note.headerPrimary", { menuPath: ["example", "note", "header"], group: "primary" }],
    ["incident.context", { menuPath: ["example", "incident", "context"] }],
  ]),
});

const ResourceCard = (props: { id: string; label: string; slotId: string }) => {
  const { id, label, slotId } = props;
  const registration = result.registrations.find((item) => item.contribution.slotId === slotId);
  return (
    <Stack gap="sm" borderWidth="1px" borderColor="border" borderRadius="md" p="md" flex="1">
      <HStack justify="space-between">
        <Text textStyle="heading/S/semibold">{label}</Text>
        <Badge>{id}</Badge>
      </HStack>
      <Text textStyle="paragraph/XS/regular" color="fg.muted">
        {slotId}
      </Text>
      <Box borderWidth="1px" borderColor="border" borderRadius="sm" p="sm">
        <Text textStyle="paragraph/S/medium">{registration?.menuItem.label}</Text>
        <Text textStyle="paragraph/XS/regular" color="fg.muted">
          {registration?.menuPath.join(" / ")}
        </Text>
      </Box>
    </Stack>
  );
};

export const ResourceMenuSlotsExample = () => (
  <Stack gap="md" p="lg" bg="bg" minH="100vh">
    <Stack gap="2xs">
      <Text textStyle="heading/M/semibold">Resource menu slots</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Each resource kind owns its action placement. Missing targets stay visible as warnings.
      </Text>
    </Stack>
    <HStack align="stretch" gap="md">
      {resourceKinds.map((kind) => (
        <ResourceCard key={kind.id} {...kind} />
      ))}
    </HStack>
    {result.unresolved.map((item) => (
      <Box key={item.contribution.id} borderWidth="1px" borderColor="border.warning" borderRadius="md" p="sm">
        <Text textStyle="paragraph/S/semibold">Unresolved target</Text>
        <Text textStyle="paragraph/XS/regular" color="fg.muted">
          {item.targetId}
        </Text>
      </Box>
    ))}
  </Stack>
);
