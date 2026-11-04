import { Button, Stack, Text } from "@chakra-ui/react";
import { NumberInputField, NumberInputRoot, SettingsContentSkeleton, Switch } from "@pstdio/ui";
import { ParamEditorRow } from "@pstdio/ui/param-editor";
import { useSettingsChanges } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";
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
  const update = useUpdateSettings();
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    if (settings) setValue(settings.max_concurrent_sessions?.toString() ?? null);
  }, [settings]);
  const parsed = parseLimit(value);
  useSettingsChanges({
    dirty: Boolean(settings) && value !== (settings?.max_concurrent_sessions?.toString() ?? null),
    saving: update.isPending,
    disabled: parsed === undefined,
    onSave: async () => {
      if (parsed === undefined) throw new Error(t("runtimeSettings.maxConcurrentSessions.invalid"));
      await update.mutateAsync({ max_concurrent_sessions: parsed });
    },
    onReset: () => {
      setValue(settings?.max_concurrent_sessions?.toString() ?? null);
      update.reset();
    },
  });
  if (isLoading) return <SettingsContentSkeleton />;
  return (
    <Stack gap="lg">
      {(update.error ?? error) ? (
        <Text role="alert" color="fg.error">
          {(update.error ?? error)?.message}
        </Text>
      ) : null}
      {error ? (
        <Button alignSelf="start" variant="outline" onClick={() => void refetch()}>
          {t("runtimeSettings.retry")}
        </Button>
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
                disabled={update.isPending}
                onCheckedChange={({ checked }) => setValue(checked ? "1" : null)}
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
                disabled={update.isPending}
                onValueChange={({ value }) => setValue(value)}
              >
                <NumberInputField aria-label={t("runtimeSettings.maxConcurrentSessions.label")} />
              </NumberInputRoot>
            ),
          }}
        />
      ) : null}
      {parsed === undefined ? (
        <Text role="alert" color="fg.error">
          {t("runtimeSettings.maxConcurrentSessions.invalid")}
        </Text>
      ) : null}
      {props.projectId ? <ProjectDefaultsCard projectId={props.projectId} /> : null}
    </Stack>
  );
};
