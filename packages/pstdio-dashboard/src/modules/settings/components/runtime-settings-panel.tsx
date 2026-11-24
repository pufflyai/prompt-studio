import { Button, Stack, Text } from "@chakra-ui/react";
import {
  ActionErrorSlot,
  AlertMessage,
  NumberInputField,
  NumberInputRoot,
  ReadErrorRecovery,
  SettingsContentSkeleton,
  Switch,
} from "@pstdio/ui";
import { ParamEditorRow } from "@pstdio/ui/param-editor";
import { useSettingsChanges } from "@pstdio/workbench/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings, useUpdateSettings } from "../data/use-settings";
import { ProjectDefaultsCard } from "./project-defaults-card";

const parseLimit = (value: string | null) => {
  if (value === null) return null;
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
};
export const RuntimeSettingsPanel = (props: { projectId?: string }) => {
  const { t } = useTranslation("settings");
  const { data: settings, error, isLoading, refetch } = useSettings();
  const update = useUpdateSettings("runtime");
  const [draft, setDraft] = useState<string | null>();
  const confirmed = settings?.max_concurrent_sessions?.toString() ?? null;
  const value = draft === undefined ? confirmed : draft;
  const parsed = parseLimit(value);
  useSettingsChanges({
    dirty: Boolean(settings) && value !== confirmed,
    saving: update.isPending,
    disabled: parsed === undefined,
    onSave: async () => {
      if (parsed === undefined) throw new Error(t("runtimeSettings.maxConcurrentSessions.invalid"));
      await update.mutateAsync({ max_concurrent_sessions: parsed });
      setDraft((current) => (current === value ? undefined : current));
    },
    onReset: () => {
      setDraft(undefined);
      update.reset();
    },
  });
  if (isLoading) return <SettingsContentSkeleton />;
  return (
    <Stack gap="lg" position="relative">
      {error && !settings ? (
        <ReadErrorRecovery title={error.message} retry={() => void refetch()} retryLabel={t("runtimeSettings.retry")} />
      ) : null}
      {error && settings ? (
        <ActionErrorSlot>
          <AlertMessage
            compact
            status="error"
            title={error.message}
            endElement={<Button onClick={() => void refetch()}>{t("runtimeSettings.retry")}</Button>}
          />
        </ActionErrorSlot>
      ) : null}
      {settings ? (
        <ParamEditorRow
          param={{
            id: "limit-concurrency",
            name: t("runtimeSettings.maxConcurrentSessions.limit"),
            description: t("runtimeSettings.maxConcurrentSessions.helper"),
            type: "property",
            value: (
              <Switch
                aria-label={t("runtimeSettings.maxConcurrentSessions.limit")}
                checked={value !== null}
                onCheckedChange={({ checked }) => setDraft(checked ? "1" : null)}
              />
            ),
          }}
        />
      ) : null}
      {settings && value !== null ? (
        <ParamEditorRow
          param={{
            id: "concurrency",
            name: t("runtimeSettings.maxConcurrentSessions.label"),
            type: "property",
            value: (
              <NumberInputRoot
                size="sm"
                width="20"
                min={1}
                step={1}
                value={value}
                onValueChange={({ value }) => setDraft(value)}
              >
                <NumberInputField
                  aria-label={t("runtimeSettings.maxConcurrentSessions.label")}
                  aria-invalid={parsed === undefined}
                  aria-describedby={parsed === undefined ? "concurrency-validation" : undefined}
                />
              </NumberInputRoot>
            ),
          }}
        />
      ) : null}
      {parsed === undefined ? (
        <Text id="concurrency-validation" color="fg.error" textStyle="label/S/regular">
          {t("runtimeSettings.maxConcurrentSessions.invalid")}
        </Text>
      ) : null}
      {props.projectId ? <ProjectDefaultsCard projectId={props.projectId} /> : null}
    </Stack>
  );
};
