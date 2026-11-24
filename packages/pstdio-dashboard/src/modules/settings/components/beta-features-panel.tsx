import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { Settings, UpdateSettingsInput } from "@pstdio/sdk/api";
import { ActionErrorSlot, AlertMessage, ReadErrorRecovery, SettingsContentSkeleton, Switch } from "@pstdio/ui";
import { ParamEditorRow } from "@pstdio/ui/param-editor";
import { useTranslation } from "react-i18next";
import { useSettings, useSettingsRecovery, useUpdateSettings } from "../data/use-settings";

type BetaFeatureSettings = Pick<Settings, "notifications_enabled" | "machine_tokens_enabled">;

interface BetaFeaturesContentProps {
  settings?: BetaFeatureSettings;
  pending?: UpdateSettingsInput;
  onDismiss?: () => void;
  onCheck?: () => void;
  error?: string;
  onChange: (update: UpdateSettingsInput) => void;
  onRetry: () => void;
}

export const BetaFeaturesContent = (props: BetaFeaturesContentProps) => {
  const { settings, pending, error, onChange, onRetry, onDismiss, onCheck } = props;
  const { t } = useTranslation("settings");
  const features = [
    {
      key: "notifications_enabled",
      label: t("betaFeatures.notifications"),
      description: t("betaFeatures.notificationsDescription"),
    },
    {
      key: "machine_tokens_enabled",
      label: t("betaFeatures.machineTokens"),
      description: t("betaFeatures.machineTokensDescription"),
    },
  ] as const;
  if (!settings && error)
    return <ReadErrorRecovery title={error} retry={onRetry} retryLabel={t("runtimeSettings.retry")} />;
  const recover = onCheck ?? (onDismiss ? undefined : onRetry);
  const recoveryLabel = onCheck
    ? t("betaFeatures.checkAgain", { defaultValue: "Check again" })
    : t("runtimeSettings.retry");
  return (
    <Stack gap="md" position="relative">
      {settings
        ? features.map((feature) => {
            const checked = settings[feature.key] === true;
            return (
              <Stack key={feature.key} gap="0">
                <ParamEditorRow
                  param={{
                    id: feature.key,
                    name: feature.label,
                    type: "property",
                    value: (
                      <HStack gap="sm">
                        {pending?.[feature.key] !== undefined ? (
                          <Text as="span" role="status" color="fg.muted" textStyle="label/XS/regular">
                            {t("betaFeatures.saving", { defaultValue: "Saving…" })}
                          </Text>
                        ) : null}
                        <Switch
                          checked={checked}
                          inputProps={{ checked, "aria-label": feature.label }}
                          onCheckedChange={({ checked }) => onChange({ [feature.key]: checked })}
                        />
                      </HStack>
                    ),
                  }}
                />
                <Text px="sm" color="fg.muted" textStyle="paragraph/S/regular">
                  {feature.description}
                </Text>
              </Stack>
            );
          })
        : null}
      {!settings && !error ? <SettingsContentSkeleton /> : null}
      {error ? (
        <ActionErrorSlot>
          <AlertMessage
            compact
            status="error"
            title={error}
            onClose={onDismiss}
            closeLabel={t("betaFeatures.dismissError", { defaultValue: "Dismiss alert" })}
            endElement={recover ? <Button onClick={recover}>{recoveryLabel}</Button> : null}
          />
        </ActionErrorSlot>
      ) : null}
    </Stack>
  );
};

export const BetaFeaturesPanel = () => {
  const { t } = useTranslation("settings");
  const { data, error, pending, refetch } = useSettings();
  const update = useUpdateSettings("beta-features");
  const recovery = useSettingsRecovery("beta-features");
  const failure = recovery.entry;
  const errorMessage = failure?.error instanceof Error ? failure.error.message : update.error?.message;
  const message =
    failure?.status === "unknown"
      ? t("betaFeatures.unknown", { defaultValue: "The setting change could not be confirmed." })
      : errorMessage;
  const dismiss = () => {
    if (failure) recovery.dismiss();
    update.reset();
  };
  return (
    <BetaFeaturesContent
      settings={data}
      pending={pending}
      error={message ?? error?.message}
      onDismiss={message ? dismiss : undefined}
      onCheck={recovery.check}
      onChange={(input) => update.mutate(input)}
      onRetry={() => {
        update.reset();
        void refetch();
      }}
    />
  );
};
