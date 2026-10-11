import { Button, Popover, Portal, Spinner, Stack, Text } from "@chakra-ui/react";
import { Play } from "lucide-react";
import { useState } from "react";

interface AutoBuildSession {
  id: string;
  title: string;
  status?: string;
}
interface AutoBuildButtonProps {
  enabled: boolean;
  supervisor?: AutoBuildSession | null;
  sessions: AutoBuildSession[];
  disabled?: boolean;
  onConfigure: () => void;
  onTurnOff: () => Promise<boolean>;
  onOpenSession: (session: AutoBuildSession) => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildButton(props: AutoBuildButtonProps) {
  const { enabled, supervisor, sessions, disabled, onConfigure, onTurnOff, onOpenSession, t } = props;
  const [open, setOpen] = useState(false);
  const stop = async () => {
    if (await onTurnOff()) setOpen(false);
  };
  return (
    <Popover.Root
      open={open && enabled}
      onOpenChange={({ open }) => setOpen(enabled && open)}
      positioning={{ placement: "bottom-end" }}
    >
      <Popover.Trigger asChild>
        <Button
          size="2xs"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            if (!enabled) onConfigure();
          }}
        >
          {enabled ? <Spinner size="xs" /> : <Play />}
          {t("timeline.autoBuild.start", "Auto Build")}
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Header>
              <Popover.Title>{t("timeline.autoBuild.active", "Auto Build is on")}</Popover.Title>
            </Popover.Header>
            <Popover.Body>
              <Stack gap="sm">
                {supervisor ? (
                  <Stack gap="2xs">
                    <Text textStyle="label/S/medium">{t("timeline.autoBuild.supervisor", "Supervisor")}</Text>
                    <Button size="xs" variant="ghost" justifyContent="start" onClick={() => onOpenSession(supervisor)}>
                      {supervisor.title}
                    </Button>
                    <Text textStyle="paragraph/XS/regular" color="fg.muted">
                      {supervisor.status === "completed"
                        ? "Sleeping until more work can run"
                        : supervisor.status?.replaceAll("_", " ")}
                    </Text>
                  </Stack>
                ) : (
                  <Text textStyle="paragraph/S/regular">
                    {t("timeline.autoBuild.waiting", "Waiting for valid tickets and capacity")}
                  </Text>
                )}
                <Text textStyle="label/S/medium">
                  {t("timeline.autoBuild.sessions", "Running ticket sessions")} ({sessions.length})
                </Text>
                {sessions.map((session) => (
                  <Button
                    key={session.id}
                    size="xs"
                    variant="ghost"
                    justifyContent="start"
                    onClick={() => onOpenSession(session)}
                  >
                    {session.title}
                  </Button>
                ))}
                <Text textStyle="paragraph/XS/regular" color="fg.muted">
                  {t(
                    "timeline.autoBuild.stopDescription",
                    "Stopping prevents future supervisor prompts. Running sessions continue.",
                  )}
                </Text>
              </Stack>
            </Popover.Body>
            <Popover.Footer>
              <Button size="sm" variant="outline" disabled={disabled} onClick={() => void stop()}>
                {t("timeline.autoBuild.stop", "Stop Auto Build")}
              </Button>
            </Popover.Footer>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
