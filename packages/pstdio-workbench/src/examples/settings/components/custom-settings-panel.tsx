import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, Switch } from "@pstdio/ui";
import { useState } from "react";
import { WorkbenchIcon } from "../../../react";

// A contributor-owned custom settings view. The workbench renders it verbatim — it is
// NOT schema-driven. Stands in for a mounted extension webview/view.
export const CustomSettingsPanel = () => {
  const [telemetry, setTelemetry] = useState(true);
  const [experiments, setExperiments] = useState(false);

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "lg" }}>
      <Stack gap="xs">
        <HStack gap="sm">
          <WorkbenchIcon name="FlaskConical" size={18} />
          <Text textStyle="heading/M/semibold">Lab settings</Text>
        </HStack>
        <Text textStyle="paragraph/S/regular" color="fg.muted" maxW="640px">
          A fully custom panel rendered by the contributing extension.
        </Text>
        <HStack gap="xs">
          <Badge colorPalette="orange">custom component</Badge>
          <Badge variant="outline">extension-lab</Badge>
        </HStack>
      </Stack>

      <Box borderWidth="1px" borderColor="border.muted" borderRadius="sm" p="md" maxW="640px">
        <Stack gap="md">
          <HStack justify="space-between" gap="sm">
            <Stack gap="2xs">
              <Text textStyle="label/S/semibold">Usage telemetry</Text>
              <Text textStyle="paragraph/XS/regular" color="fg.muted">
                Share anonymized lab usage with the extension author.
              </Text>
            </Stack>
            <Switch checked={telemetry} onCheckedChange={(event) => setTelemetry(event.checked)} />
          </HStack>

          <HStack justify="space-between" gap="sm">
            <Stack gap="2xs">
              <Text textStyle="label/S/semibold">Experimental features</Text>
              <Text textStyle="paragraph/XS/regular" color="fg.muted">
                Opt into in-development lab tools.
              </Text>
            </Stack>
            <Switch checked={experiments} onCheckedChange={(event) => setExperiments(event.checked)} />
          </HStack>

          <Button size="sm" variant="outline" w="fit-content" onClick={() => setExperiments(false)}>
            <WorkbenchIcon name="RotateCcw" />
            Reset experiments
          </Button>
        </Stack>
      </Box>
    </ScrollArea>
  );
};
