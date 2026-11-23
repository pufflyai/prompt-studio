import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ActionErrorSlot, AlertMessage, Switch } from "@pstdio/ui";
import { ParamEditorRow } from "@pstdio/ui/param-editor";
import { useState } from "react";

export default { title: "Proposals/PS-289 Settings feedback" };

type Setting = "Notifications" | "Machine tokens";
type Settings = Record<Setting, boolean>;

const confirmedDefaults: Settings = { Notifications: false, "Machine tokens": false };

export const SharedPendingAndRecovery = () => {
  const [confirmed, setConfirmed] = useState(confirmedDefaults);
  const [intents, setIntents] = useState<Partial<Settings>>({});
  const [attempt, setAttempt] = useState<boolean | undefined>();
  const [showSource, setShowSource] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const toggle = (field: Setting, value: boolean) => setIntents((previous) => ({ ...previous, [field]: value }));
  const settle = (reject: boolean) => {
    if (reject) {
      setAttempt(intents.Notifications);
      setDismissed(false);
      setConfirmed((previous) => ({
        ...previous,
        "Machine tokens": intents["Machine tokens"] ?? previous["Machine tokens"],
      }));
    } else {
      setConfirmed((previous) => ({ ...previous, ...intents }));
    }
    setIntents({});
  };
  const settings = { ...confirmed, ...intents };

  return (
    <Stack p="md" gap="md" width="lg">
      <Text>Navigation</Text>
      <Text fontWeight="medium">{settings.Notifications ? "Home · Notifications" : "Home"}</Text>
      {showSource ? (
        <>
          {(["Notifications", "Machine tokens"] as const).map((field) => (
            <ParamEditorRow
              key={field}
              param={{
                id: field,
                type: "property",
                name: field,
                value: (
                  <HStack>
                    {intents[field] !== undefined ? (
                      <Text role="status" color="fg.muted">
                        Saving…
                      </Text>
                    ) : null}
                    <Switch
                      aria-label={field}
                      checked={settings[field]}
                      onCheckedChange={({ checked }) => toggle(field, checked)}
                    />
                  </HStack>
                ),
              }}
            />
          ))}
          {attempt !== undefined && !dismissed ? (
            <ActionErrorSlot>
              <AlertMessage
                compact
                status="error"
                title="Could not change Notifications"
                onClose={() => setDismissed(true)}
                closeLabel="Dismiss alert"
              />
            </ActionErrorSlot>
          ) : null}
        </>
      ) : null}
      <HStack>
        <Button size="sm" onClick={() => setShowSource(!showSource)}>
          {showSource ? "Close settings" : "Open settings"}
        </Button>
        <Button size="sm" disabled={Object.keys(intents).length === 0} onClick={() => settle(false)}>
          Confirm change
        </Button>
        <Button size="sm" disabled={intents.Notifications === undefined} onClick={() => settle(true)}>
          Reject Notifications
        </Button>
      </HStack>
      {attempt !== undefined ? (
        <HStack aria-label="System activity">
          <Text>Could not change Notifications</Text>
          <Button
            size="sm"
            onClick={() => {
              setShowSource(true);
              setDismissed(false);
            }}
          >
            Return to source
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setAttempt(undefined)}>
            Discard draft
          </Button>
        </HStack>
      ) : null}
    </Stack>
  );
};
