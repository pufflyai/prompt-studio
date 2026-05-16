import { Stack } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { readmeResource } from "../data";
import { InventoryRow, Panel } from "./panel";

export const FilePreviewWidget = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
    <Stack gap="md" maxW="3xl">
      <Panel title="README.md">
        <Stack gap="sm">
          <InventoryRow icon="FileText" label="Resource URI" value={readmeResource.uri} />
          <InventoryRow icon="GitBranch" label="Branch" value="feature/runtime-modules" />
          <InventoryRow icon="Package" label="Owner" value="dynamic-modules.explorer" />
        </Stack>
      </Panel>
    </Stack>
  </ScrollArea>
);
