import { Button, Stack, Text } from "@chakra-ui/react";
import { SettingsContentSkeleton } from "@pstdio/ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useSettingsChanges } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings, useUpdateSettings } from "../data/use-settings";
import { ProjectDefaultsCard } from "./project-defaults-card";

const parseLimit = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
};
export const RuntimeSettingsPanel = (props: { projectId?: string }) => {
  const { t } = useTranslation("settings");
  const { data: settings, error, isLoading, refetch } = useSettings();
  const update = useUpdateSettings();
  const [value, setValue] = useState("");
  useEffect(() => {
    if (settings) setValue(settings.max_concurrent_sessions?.toString() ?? "");
  }, [settings]);
  const parsed = parseLimit(value);
  useSettingsChanges({
    dirty: Boolean(settings) && value !== (settings?.max_concurrent_sessions?.toString() ?? ""),
    saving: update.isPending,
    disabled: parsed === undefined,
    onSave: async () => {
      if (parsed === undefined) throw new Error(t("runtimeSettings.maxConcurrentSessions.invalid"));
      await update.mutateAsync({ max_concurrent_sessions: parsed });
    },
    onReset: () => {
      setValue(settings?.max_concurrent_sessions?.toString() ?? "");
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
        <ParamEditor
          changeDelay={0}
          fullWidth
          readOnly={update.isPending}
          params={[
            {
              id: "concurrency",
              name: t("runtimeSettings.maxConcurrentSessions.label"),
              description: t("runtimeSettings.maxConcurrentSessions.helper"),
              type: "text",
              singleLine: true,
              defaultValue: value,
            },
          ]}
          onChange={(_id, next) => setValue(String(next))}
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
