import { Badge, HStack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { ShieldCheck } from "lucide-react";
import { dashboardChecks } from "../mock-data/workspaces";

export const WorkspaceChecksWidget = () => (
  <ScrollArea flex="1" minH="0" contentProps={{ p: "sm", spaceY: "xs" }}>
    {dashboardChecks.map((check) => (
      <HStack key={check.id} gap="sm" py="xs" borderBottomWidth="1px" borderColor="border.muted">
        <ShieldCheck size={15} />
        <Text textStyle="label/S/regular" flex="1">
          {check.label}
        </Text>
        <Badge colorPalette={check.status === "passed" ? "green" : "blue"} variant="subtle">
          {check.status}
        </Badge>
      </HStack>
    ))}
  </ScrollArea>
);
