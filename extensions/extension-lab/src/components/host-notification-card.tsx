import { Button, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useLabHost } from "../hooks/host-context";
import { LabCard } from "./lab-card";

export const createLabInboxNotificationInput = () => ({
  title: "Review Extension Lab notification",
  body: "Durable notifications land in the dashboard inbox until a user resolves them.",
  kind: "needs_review",
  priority: "normal",
  target: {
    type: "lab.slide",
    id: "notification-demo",
    label: "Notification demo",
  },
  actions: [
    {
      id: "say-hello",
      label: "Say hello",
      kind: "command",
      command: "pstdio.extension-lab.command.say-hello",
      primary: true,
    },
  ],
  metadata: { demo: true },
});

export const HostNotificationCard = () => {
  const { host } = useLabHost();
  const [pendingAction, setPendingAction] = useState<"inbox" | "toast" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sayHello = async () => {
    if (pendingAction) return;

    setPendingAction("toast");
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
      setPendingAction(null);
    }
  };

  const sendInboxNotification = async () => {
    if (pendingAction) return;

    setPendingAction("inbox");
    setError(null);

    try {
      await host.call("notification.action", createLabInboxNotificationInput());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <LabCard title="Host notification" subtitle="Run host notification bridge calls from a webview.">
      <Stack gap="md">
        <Stack direction={{ base: "column", sm: "row" }} gap="sm" alignItems="start">
          <Button type="button" variant="primary" onClick={sayHello} disabled={pendingAction !== null}>
            {pendingAction === "toast" ? "Sending..." : "Say hello"}
          </Button>
          <Button type="button" variant="subtle" onClick={sendInboxNotification} disabled={pendingAction !== null}>
            {pendingAction === "inbox" ? "Creating..." : "Create inbox item"}
          </Button>
        </Stack>
        {error ? (
          <Text textStyle="paragraph/S/regular" color="fg.error">
            {error}
          </Text>
        ) : null}
      </Stack>
    </LabCard>
  );
};
