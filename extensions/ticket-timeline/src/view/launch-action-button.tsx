// Launch a pending action prompt and keep failures visible without changing the ticket state.
import { Button, Icon, Stack, Text } from "@chakra-ui/react";
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import type { PlanClient } from "./use-plan";

export function LaunchActionButton({ ticket, client }: { ticket: string; client: PlanClient }) {
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string>();
  const launch = async () => {
    setLaunching(true);
    setError(undefined);
    try {
      await client.commands["action.launch"]({ ticket });
    } catch (reason) {
      setError(String(reason));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Stack gap="xs">
      <Button size="sm" variant="outline" loading={launching} onClick={() => void launch()}>
        <Icon as={MessageSquare} />
        Resolve action
      </Button>
      {error ? (
        <Text role="alert" color="fg.error">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
