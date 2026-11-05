import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { AutomationTokenRecord } from "@pstdio/sdk/api";
import { SettingsContentSkeleton } from "@pstdio/ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useActionError } from "@/shared/components/use-action-error";
import { useAutomationTokens, useIssueAutomationToken, useRevokeAutomationToken } from "../data/use-automation-tokens";

interface MachineTokensPanelViewProps {
  tokens: AutomationTokenRecord[];
  issuedToken: string | null;
  name: string;
  scopes: string;
  expiresInDays: string;
  loading?: boolean;
  issuing?: boolean;
  revokingTokenId?: string;
  onNameChange: (value: string) => void;
  onScopesChange: (value: string) => void;
  onExpiresInDaysChange: (value: string) => void;
  onIssue: () => void;
  onRevoke: (tokenId: string) => void;
  onCopy: () => void;
}

export const MachineTokensPanelView = (props: MachineTokensPanelViewProps) => {
  const {
    tokens,
    issuedToken,
    name,
    scopes,
    expiresInDays,
    loading,
    issuing,
    revokingTokenId,
    onNameChange,
    onScopesChange,
    onExpiresInDaysChange,
    onIssue,
    onRevoke,
    onCopy,
  } = props;
  const { t } = useTranslation("projects");
  const validExpiry = Number.isInteger(Number(expiresInDays)) && Number(expiresInDays) > 0;
  const canIssue = Boolean(name.trim() && scopes.trim() && validExpiry);

  return (
    <Stack gap="md">
      {issuedToken && (
        <Stack gap="sm" borderWidth="1px" borderColor="border.success" borderRadius="md" padding="md">
          <Stack gap="0">
            <Text textStyle="label/S/medium">{t("projectSettings.machineTokens.issuedTitle")}</Text>
            <Text textStyle="paragraph/XS/regular" color="fg.muted">
              {t("projectSettings.machineTokens.issuedDescription")}
            </Text>
          </Stack>
          <HStack gap="xs">
            <Input value={issuedToken} readOnly fontFamily="mono" />
            <Button size="sm" variant="outline" onClick={onCopy}>
              {t("projectSettings.machineTokens.copy")}
            </Button>
          </HStack>
        </Stack>
      )}

      <Stack gap="sm">
        <Text textStyle="label/L/medium">{t("projectSettings.machineTokens.issueTitle")}</Text>
        <ParamEditor
          fullWidth
          readOnly={issuing}
          params={[
            {
              id: "name",
              name: t("projectSettings.machineTokens.name"),
              type: "text",
              singleLine: true,
              defaultValue: name,
            },
            {
              id: "scopes",
              name: t("projectSettings.machineTokens.scopes"),
              description: t("projectSettings.machineTokens.scopesHint"),
              type: "text",
              defaultValue: scopes,
            },
            {
              id: "expiry",
              name: t("projectSettings.machineTokens.expiry"),
              type: "text",
              singleLine: true,
              defaultValue: expiresInDays,
            },
          ]}
          onChange={(id, value) => {
            if (id === "name") onNameChange(String(value));
            if (id === "scopes") onScopesChange(String(value));
            if (id === "expiry") onExpiresInDaysChange(String(value));
          }}
        />
        <Button size="sm" alignSelf="start" disabled={!canIssue} loading={issuing} onClick={onIssue}>
          {t("projectSettings.machineTokens.issue")}
        </Button>
      </Stack>

      <Stack gap="sm">
        <Text textStyle="label/S/medium">{t("projectSettings.machineTokens.activeTitle")}</Text>
        {loading ? <SettingsContentSkeleton /> : null}
        {!loading && tokens.length === 0 ? (
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {t("projectSettings.machineTokens.empty")}
          </Text>
        ) : null}
        {!loading &&
          tokens.map((token) => (
            <HStack
              key={token.id}
              gap="md"
              borderWidth="1px"
              borderColor="border.subtle"
              borderRadius="md"
              padding="md"
            >
              <Stack gap="0" flex="1" minW="0">
                <Text textStyle="label/S/medium">{token.name}</Text>
                <Text textStyle="label/XS" color="fg.muted" fontFamily="mono" truncate>
                  {token.tokenPrefix} · {token.commandScopes.join(", ")}
                </Text>
                <Text textStyle="label/XS" color="fg.subtle">
                  {t("projectSettings.machineTokens.expires", {
                    date: new Date(token.expiresAt).toLocaleString(),
                  })}
                </Text>
              </Stack>
              <Button
                size="2xs"
                variant="destructive"
                loading={revokingTokenId === token.id}
                onClick={() => onRevoke(token.id)}
              >
                {t("projectSettings.machineTokens.revoke")}
              </Button>
            </HStack>
          ))}
      </Stack>
    </Stack>
  );
};

export const MachineTokensPanel = (props: { projectId?: string }) => {
  const { projectId } = props;
  const { showError, errorNotice, clearError } = useActionError();
  const { t } = useTranslation("projects");
  const tokens = useAutomationTokens(projectId ?? "");
  const issue = useIssueAutomationToken(projectId ?? "");
  const revoke = useRevokeAutomationToken(projectId ?? "");
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  if (!projectId) return null;

  const handleIssue = () => {
    clearError();
    issue.mutate(
      {
        name,
        commandScopes: scopes
          .split(/\r?\n/)
          .map((scope) => scope.trim())
          .filter(Boolean),
        expiresInSeconds: Number(expiresInDays) * 24 * 60 * 60,
      },
      {
        onSuccess: (result) => {
          setIssuedToken(result.token);
          setName("");
          setScopes("");
        },
        onError: (error) =>
          showError({
            title: t("projectSettings.machineTokens.issueFailed"),
            description: error.message,
          }),
      },
    );
  };

  return (
    <>
      {errorNotice}
      <MachineTokensPanelView
        tokens={tokens.data?.tokens.filter((token) => !token.revokedAt) ?? []}
        issuedToken={issuedToken}
        name={name}
        scopes={scopes}
        expiresInDays={expiresInDays}
        loading={tokens.isLoading}
        issuing={issue.isPending}
        revokingTokenId={revoke.isPending ? revoke.variables : undefined}
        onNameChange={setName}
        onScopesChange={setScopes}
        onExpiresInDaysChange={setExpiresInDays}
        onIssue={handleIssue}
        onRevoke={(tokenId) => {
          clearError();
          revoke.mutate(tokenId, { onError: (error) => showError({ title: error.message }) });
        }}
        onCopy={() => {
          if (issuedToken) void navigator.clipboard.writeText(issuedToken);
        }}
      />
    </>
  );
};
