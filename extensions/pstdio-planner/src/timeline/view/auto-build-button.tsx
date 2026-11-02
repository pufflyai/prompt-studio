import { Button, CloseButton, Dialog, HStack, Portal } from "@chakra-ui/react";
import { installPrismGlobal } from "@pstdio/ui";
import { Play } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import type { WaitingTicket } from "../../commands/next-ticket-types";
import type { ReviewRequestView, ReviewResponse } from "../../data/review-request-types";
import { AutoBuildActivity } from "./auto-build-activity";
import type { AutoBuildFormProps } from "./auto-build-form";
import { AutoBuildHelp } from "./auto-build-help";
import { AutoBuildIndicator, resolveAutoBuildIndicatorStatus } from "./auto-build-indicator";
import type { AutoBuildSession } from "./auto-build-session-row";

const AutoBuildForm = lazy(async () => {
  await installPrismGlobal();
  return import("./auto-build-form").then((module) => ({ default: module.AutoBuildForm }));
});

export interface AutoBuildButtonProps {
  enabled: boolean;
  paused?: boolean;
  reviewRequests?: ReviewRequestView[];
  requestErrors?: string[];
  onAnswerRequest?: (requestId: string, response: ReviewResponse) => Promise<unknown>;
  onOpenRequestChat?: (requestId: string) => Promise<unknown>;
  onPause?: () => Promise<boolean>;
  onResume?: () => Promise<boolean>;
  completed?: boolean;
  supervisor?: AutoBuildSession | null;
  sessions: AutoBuildSession[];
  running: number;
  capacity: number;
  matchingTicketCount?: number;
  readyTicketCount?: number;
  waitingTickets?: WaitingTicket[];
  starting?: boolean;
  error?: string;
  actionError?: string;
  stuck?: boolean;
  disabled?: boolean;
  configuration?: Omit<AutoBuildFormProps, "onClose" | "t">;
  onStop: () => Promise<boolean>;
  onOpenSession: (session: AutoBuildSession) => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildButton(props: AutoBuildButtonProps) {
  const {
    enabled,
    paused,
    completed,
    supervisor,
    running,
    error,
    stuck,
    disabled,
    configuration,
    onStop,
    starting,
    t,
  } = props;
  const [content, setContent] = useState<"configuration" | "sessions" | null>(null);
  const failed = (!completed && supervisor?.status === "failed") || Boolean(error);
  const inspectable = enabled || paused || failed;
  const status = resolveAutoBuildIndicatorStatus({
    enabled,
    paused,
    completed,
    failed,
    stuck,
    supervisorStatus: supervisor?.status,
    running,
    starting,
  });
  const activity = status?.replaceAll("_", " ") ?? "off";
  const close = () => {
    if (!disabled) setContent(null);
  };
  const stop = async () => {
    if (await onStop()) setContent(null);
  };

  return (
    <>
      <AutoBuildActivity
        {...props}
        trigger={
          <Button
            aria-label={t("timeline.autoBuild.start", "Auto Build")}
            aria-description={enabled || paused || failed ? `Auto Build ${activity}` : undefined}
            size="xs"
            variant="outline"
            disabled={disabled}
            onClick={(event) => {
              if (inspectable) return;
              event.preventDefault();
              setContent("configuration");
            }}
          >
            {status ? <AutoBuildIndicator status={status} label={`Auto Build ${activity}`} /> : <Play />}
            {t("timeline.autoBuild.start", "Auto Build")}
          </Button>
        }
        open={content === "sessions"}
        failed={failed}
        onOpenChange={(open) => {
          if (open) setContent("sessions");
          else close();
        }}
        onStop={() => void stop()}
        onConfigure={() => setContent("configuration")}
      />
      <Dialog.Root
        lazyMount
        unmountOnExit
        open={content === "configuration"}
        size="lg"
        scrollBehavior="inside"
        onOpenChange={({ open }) => !open && close()}
      >
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
              {content === "configuration" && configuration ? (
                <Suspense fallback={null}>
                  <AutoBuildForm {...configuration} onClose={() => setContent(null)} t={t} />
                </Suspense>
              ) : null}
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
