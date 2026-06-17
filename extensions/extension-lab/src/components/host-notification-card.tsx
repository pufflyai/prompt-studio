import { Button, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useLabHost } from "../hooks/host-context";
import { LabCard } from "./lab-card";

export const HostNotificationCard = () => {
  const { host } = useLabHost();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sayHello = async () => {
    if (isPending) return;

    setIsPending(true);
    setError(null);

    try {
      await host.call("notification.show", {
        level: "success",
        message: "The Extension Lab webview reached the dashboard host bridge.",
        title: "Hello from Extension Lab",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <LabCard title="Host notification" subtitle="Run a command that emits a dashboard toast.">
      <Stack gap="md">
        <Button type="button" variant="primary" onClick={sayHello} disabled={isPending} alignSelf="start">
          {isPending ? "Sending..." : "Say hello"}
        </Button>
        {error ? (
          <Text textStyle="paragraph/S/regular" color="fg.error">
            {error}
          </Text>
        ) : null}
      </Stack>
    </LabCard>
  );
};
