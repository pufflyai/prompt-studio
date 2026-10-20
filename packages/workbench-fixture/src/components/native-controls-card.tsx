import { Button, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useLabHost } from "../hooks/host-context";
import { LabCard } from "./lab-card";

export function NativeControlsCard() {
  const { host } = useLabHost();
  const [result, setResult] = useState<string>();
  const read = async () => {
    try {
      const catalog = await host.call("harnesses.read", { harnessId: "pstdio.workbench-fixture.harness.fake" });
      const actions = await host.call("resources.actions", {
        operation: "list",
        resource: {
          type: "glass-lab-artifact",
          id: "native-controls",
          extensionId: "pstdio.workbench-fixture",
        },
      });
      setResult(JSON.stringify({ model: catalog.selection?.model, actions }));
    } catch (reason) {
      setResult(String(reason));
    }
  };
  return (
    <LabCard title="Native controls" subtitle="Project harness choices and native resource actions.">
      <Stack gap="md">
        <Button size="sm" onClick={() => void read()}>
          Read native controls
        </Button>
        <Text as="output" data-testid="native-controls-result" textStyle="paragraph/S/regular">
          {result}
        </Text>
      </Stack>
    </LabCard>
  );
}
