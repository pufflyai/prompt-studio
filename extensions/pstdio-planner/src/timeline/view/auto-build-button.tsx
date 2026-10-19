import { Button, CloseButton, Dialog, HStack, Portal, useRecipe } from "@chakra-ui/react";
import { installPrismGlobal, ScrollArea } from "@pstdio/ui";
import { psTheme } from "@pstdio/ui/theme";
import { Pause, Play } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import type { AutoBuildFormProps } from "./auto-build-form";
import { AutoBuildHelp } from "./auto-build-help";
import { AutoBuildIndicator, resolveAutoBuildIndicatorStatus } from "./auto-build-indicator";
import type { AutoBuildSession } from "./auto-build-session-row";
import { AutoBuildSessions } from "./auto-build-sessions";

const AutoBuildForm = lazy(async () => {
  await installPrismGlobal();
  return import("./auto-build-form").then((module) => ({ default: module.AutoBuildForm }));
});

export interface AutoBuildButtonProps {
  enabled: boolean;
  completed?: boolean;
  supervisor?: AutoBuildSession | null;
  sessions: AutoBuildSession[];
  running: number;
  capacity: number;
  error?: string;
  stuck?: boolean;
  disabled?: boolean;
  configuration?: Omit<AutoBuildFormProps, "onClose" | "t">;
  onTurnOff: () => Promise<boolean>;
  onOpenSession: (session: AutoBuildSession) => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildButton(props: AutoBuildButtonProps) {
  const {
    enabled,
    completed,
    supervisor,
    sessions,
    running,
    capacity,
    error,
    stuck,
    disabled,
    configuration,
    onTurnOff,
    onOpenSession,
    t,
  } = props;
  const [content, setContent] = useState<"configuration" | "sessions" | null>(null);
  const button = useRecipe({ recipe: psTheme.getRecipe("button") });
  const failed = (!completed && supervisor?.status === "failed") || Boolean(error);
  const inspectable = enabled || failed;
  const status = resolveAutoBuildIndicatorStatus({
    enabled,
    completed,
    failed,
    stuck,
    supervisorStatus: supervisor?.status,
    running,
  });
  const activity = status?.replaceAll("_", " ") ?? "off";
  const close = () => {
    if (!disabled) setContent(null);
  };
  const stop = async () => {
    if (await onTurnOff()) setContent(null);
  };

  return (
    <Dialog.Root
      lazyMount
      unmountOnExit
      open={content !== null}
      size="lg"
      scrollBehavior="inside"
      onOpenChange={({ open }) => !open && close()}
    >
      <Button
        aria-label={t("timeline.autoBuild.start", "Auto Build")}
        aria-description={enabled || failed ? `Auto Build ${activity}` : undefined}
        size="xs"
        variant="outline"
        disabled={disabled}
        onClick={() => setContent(inspectable ? "sessions" : "configuration")}
      >
        {status ? <AutoBuildIndicator status={status} label={`Auto Build ${activity}`} /> : <Play />}
        {t("timeline.autoBuild.start", "Auto Build")}
      </Button>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <HStack gap="xs">
                <Dialog.Title>{t("timeline.autoBuild.start", "Auto Build")}</Dialog.Title>
                <AutoBuildHelp t={t} />
              </HStack>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" disabled={disabled} />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            {content === "sessions" ? (
              <>
                <Dialog.Body flex="1" minH="0" p="0">
                  <ScrollArea h="full" contentProps={{ px: "lg", py: "md" }}>
                    <AutoBuildSessions
                      enabled={enabled}
                      completed={completed}
                      supervisor={supervisor}
                      sessions={sessions}
                      failed={failed}
                      error={error}
                      stuck={stuck}
                      running={running}
                      capacity={capacity}
                      onOpenSession={onOpenSession}
                      t={t}
                    />
                  </ScrollArea>
                </Dialog.Body>
                <Dialog.Footer>
                  {enabled ? (
                    <Button size="sm" variant="outline" disabled={disabled} onClick={() => void stop()}>
                      <Pause />
                      {t("timeline.autoBuild.stop", "Stop")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      css={button({ variant: "primary", size: "sm" })}
                      disabled={disabled}
                      onClick={() => setContent("configuration")}
                    >
                      <Play />
                      {t("timeline.autoBuild.start", "Auto Build")}
                    </Button>
                  )}
                </Dialog.Footer>
              </>
            ) : null}
            {content === "configuration" && configuration ? (
              <Suspense fallback={null}>
                <AutoBuildForm {...configuration} onClose={() => setContent(null)} t={t} />
              </Suspense>
            ) : null}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
