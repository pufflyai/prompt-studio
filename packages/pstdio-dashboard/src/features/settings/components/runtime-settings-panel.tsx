import { Box, Button, HStack, Input, Spinner, Stack, Text } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings, useUpdateSettings } from "../hooks/use-settings";

const parseLimit = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
};

export const RuntimeSettingsPanel = () => {
  const { t } = useTranslation("settings");
  const { data: settings, error, isError, isLoading, refetch } = useSettings();
  const updateSettings = useUpdateSettings();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (settings) {
      setValue(settings.max_concurrent_sessions?.toString() ?? "");
    }
  }, [settings]);

  const parsedLimit = parseLimit(value);
  const isInvalid = parsedLimit === undefined;
  const isUnchanged = (settings?.max_concurrent_sessions ?? null) === parsedLimit;
  const isSaveDisabled = isLoading || isInvalid || isUnchanged || updateSettings.isPending;

  const handleSave = () => {
    if (parsedLimit === undefined) return;

    updateSettings.mutate(
      { max_concurrent_sessions: parsedLimit },
      {
        onSuccess: () => {
          toaster.create({ type: "success", title: t("runtimeSettings.saveSuccess") });
        },
        onError: (error) => {
          toaster.create({ type: "error", title: t("runtimeSettings.saveError"), description: error.message });
        },
      },
    );
  };

  return (
    <Stack gap="md" padding="lg" maxW="720px">
      <Stack gap="2xs">
        <Text textStyle="heading/S">{t("runtimeSettings.title")}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("runtimeSettings.description")}
        </Text>
      </Stack>

      {isLoading ? (
        <Box py="md" display="flex" justifyContent="center">
          <Spinner size="sm" />
        </Box>
      ) : isError ? (
        <Stack gap="sm" borderWidth="1px" borderColor="border.muted" borderRadius="md" padding="md">
          <Stack gap="2xs">
            <Text textStyle="label/S/medium" color="fg.error">
              {t("runtimeSettings.loadError")}
            </Text>
            <Text textStyle="paragraph/XS/regular" color="fg.muted">
              {error instanceof Error ? error.message : t("runtimeSettings.loadErrorDescription")}
            </Text>
          </Stack>
          <Button size="sm" alignSelf="start" variant="outline" onClick={() => refetch()}>
            {t("runtimeSettings.retry")}
          </Button>
        </Stack>
      ) : (
        <Stack gap="sm" borderWidth="1px" borderColor="border.muted" borderRadius="md" padding="md">
          <Stack gap="2xs">
            <Text textStyle="label/S/medium">{t("runtimeSettings.maxConcurrentSessions.label")}</Text>
            <Text textStyle="paragraph/XS/regular" color="fg.muted">
              {t("runtimeSettings.maxConcurrentSessions.helper")}
            </Text>
          </Stack>

          <HStack alignItems="start" gap="sm">
            <Stack gap="2xs" flex="1">
              <Input
                value={value}
                type="number"
                min={1}
                placeholder={t("runtimeSettings.maxConcurrentSessions.placeholder")}
                disabled={updateSettings.isPending}
                onChange={(event) => setValue(event.target.value)}
              />
              <Text textStyle="paragraph/XS/regular" color={isInvalid ? "fg.error" : "fg.muted"}>
                {isInvalid
                  ? t("runtimeSettings.maxConcurrentSessions.invalid")
                  : t("runtimeSettings.maxConcurrentSessions.current", {
                      value:
                        settings?.max_concurrent_sessions == null
                          ? t("runtimeSettings.maxConcurrentSessions.none")
                          : settings.max_concurrent_sessions,
                    })}
              </Text>
            </Stack>
            <Button size="sm" onClick={handleSave} disabled={isSaveDisabled} loading={updateSettings.isPending}>
              {t("runtimeSettings.save")}
            </Button>
          </HStack>
        </Stack>
      )}
    </Stack>
  );
};
