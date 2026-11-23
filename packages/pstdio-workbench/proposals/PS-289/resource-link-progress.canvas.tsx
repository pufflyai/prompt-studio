import { Button, HStack, Stack } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { useState } from "react";
import { WorkbenchThemeProvider } from "../../src/react/theme/workbench-theme-provider";
import { ResourceLinkProgress } from "./resource-link-progress";

export default { title: "Proposals/PS-289 Resource links" };

export const LinkChangeFeedback = () => {
  const [state, setState] = useState<"idle" | "pending" | "unconfirmed">("idle");
  return (
    <WorkbenchThemeProvider>
      <Stack gap="3" p="4" maxW="md">
        <ResourceLinkProgress pending={state === "pending"} unconfirmed={state === "unconfirmed"} />
        <ListRow label="Build notes" description="Outgoing · context" />
        {state === "idle" && <ListRow label="Implementation workspace" description="Outgoing · source" />}
        <HStack>
          <Button onClick={() => setState("pending")}>Remove link</Button>
          <Button onClick={() => setState("unconfirmed")}>Lose response</Button>
          <Button onClick={() => setState("idle")}>Reset</Button>
        </HStack>
      </Stack>
    </WorkbenchThemeProvider>
  );
};
