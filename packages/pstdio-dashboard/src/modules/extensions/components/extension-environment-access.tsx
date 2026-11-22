import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { ExtensionProcessEnvironmentPermission } from "@pstdio/sdk/api";
import { AlertMessage, Checkbox } from "@pstdio/ui";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

export interface ExtensionEnvironmentAccessProps {
  permission: ExtensionProcessEnvironmentPermission;
  pending?: "grant" | "revoke";
  /** Local action feedback, shown beside the controls. */
  errorNotice?: ReactNode;
  onAllow: (names: string[]) => void;
  onRevoke: () => void;
}

const sameNames = (left: string[], right: string[]) =>
  left.length === right.length && left.every((name) => right.includes(name));

/**
 * Names an extension requests from the host environment and the person's grant. Never shows values.
 * The selection starts from the grant; callers remount it when the grant or source changes.
 */
export const ExtensionEnvironmentAccess = (props: ExtensionEnvironmentAccessProps) => {
  const { permission, pending, errorNotice, onAllow, onRevoke } = props;
  const { t } = useTranslation("projects");
  const { requested, granted, stale } = permission;
  const [selected, setSelected] = useState(granted);
  let statusKey = "allowed";
  if (granted.length === 0) statusKey = "notAllowed";
  else if (granted.length < requested.length) statusKey = "partlyAllowed";
  const busy = pending !== undefined;

  return (
    <Stack gap="sm" position="relative" data-testid="extension-environment-access">
      {errorNotice}
      <Stack gap="0">
        <HStack gap="sm" justifyContent="space-between">
          <Text textStyle="label/S/medium">{t("projectSettings.extensionsPanel.environmentAccess.title")}</Text>
          <Text textStyle="label/XS" color={granted.length > 0 ? "fg.success" : "fg.muted"}>
            {t(`projectSettings.extensionsPanel.environmentAccess.${statusKey}`, {
              count: granted.length,
              total: requested.length,
            })}
          </Text>
        </HStack>
        <Text textStyle="paragraph/XS/regular" color="fg.muted">
          {t("projectSettings.extensionsPanel.environmentAccess.description")}
        </Text>
      </Stack>

      {stale && (
        <AlertMessage compact status="warning" title={t("projectSettings.extensionsPanel.environmentAccess.stale")} />
      )}

      <Stack gap="2xs">
        {requested.map((name) => (
          <Checkbox
            key={name}
            size="sm"
            checked={selected.includes(name)}
            disabled={busy}
            onCheckedChange={({ checked }) =>
              setSelected((current) =>
                checked === true ? [...current, name] : current.filter((candidate) => candidate !== name),
              )
            }
          >
            <Text as="span" textStyle="label/XS" fontFamily="mono">
              {name}
            </Text>
          </Checkbox>
        ))}
      </Stack>

      <HStack gap="xs" flexWrap="wrap">
        <Button
          size="2xs"
          onClick={() => onAllow(selected)}
          data-testid="extension-environment-allow"
          loading={pending === "grant"}
          disabled={busy || selected.length === 0 || (!stale && sameNames(selected, granted))}
        >
          {t("projectSettings.extensionsPanel.environmentAccess.allow")}
        </Button>
        <Button
          size="2xs"
          variant="destructive"
          onClick={onRevoke}
          data-testid="extension-environment-revoke"
          loading={pending === "revoke"}
          disabled={busy || (granted.length === 0 && !stale)}
        >
          {t("projectSettings.extensionsPanel.environmentAccess.revoke")}
        </Button>
      </HStack>

      <Text textStyle="paragraph/XS/regular" color="fg.muted">
        {t("projectSettings.extensionsPanel.environmentAccess.fileAccess")}
      </Text>
    </Stack>
  );
};
