import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { AutomationTokenRecord } from "@pstdio/sdk/api";
import { AlertMessage, SettingsContentSkeleton } from "@pstdio/ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { classifyApiWrite } from "@pstdio/workbench";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useActionError } from "@/shared/components/use-action-error";
import { useMachineTokens } from "../data/use-automation-tokens";

interface MachineTokensPanelViewProps {
  tokens: AutomationTokenRecord[];
  issuedToken: string | null;
  name: string;
  scopes: string;
  expiresInDays: string;
  loading?: boolean;
  issuing?: boolean;
  unresolvedIssue?: boolean;
  revoking?: boolean;
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
    unresolvedIssue,
    revoking,
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
        {unresolvedIssue && (
          <AlertMessage compact status="warning" title="Token issuance could not be confirmed.">
            Review active tokens. The request is available in System activity.
          </AlertMessage>
        )}
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
        <Button size="sm" alignSelf="start" disabled={!canIssue || unresolvedIssue} loading={issuing} onClick={onIssue}>
          {t("projectSettings.machineTokens.issue")}
        </Button>
      </Stack>

      <Stack gap="sm">
        <Text textStyle="label/S/medium">{t("projectSettings.machineTokens.activeTitle")}</Text>
        {revoking && (
          <Text role="status" textStyle="label/S/regular">
            Revoking machine token…
          </Text>
        )}
        {loading ? <SettingsContentSkeleton /> : null}
        {!loading && !revoking && tokens.length === 0 ? (
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
              <Button size="2xs" variant="destructive" onClick={() => onRevoke(token.id)}>
                {t("projectSettings.machineTokens.revoke")}
              </Button>
            </HStack>
          ))}
      </Stack>
    </Stack>
  );
};

export const MachineTokensPanel = ({ projectId }: { projectId?: string }) => {
  const tokens = useMachineTokens(projectId ?? "");
  return projectId ? <MachineTokensForm key={tokens.formKey} {...tokens} /> : null;
};

const MachineTokensForm = (props: ReturnType<typeof useMachineTokens>) => {
  const { tokens, issue, revoke, presentation } = props;
  const { showError, errorNotice, clearError } = useActionError();
  const { t } = useTranslation("projects");
  const { draft, revokingIds } = presentation;
  const [name, setName] = useState(draft?.name ?? "");
  const [scopes, setScopes] = useState(draft?.commandScopes.join("\n") ?? "");
  const [expiresInDays, setExpiresInDays] = useState(
    draft?.expiresInSeconds ? String(draft.expiresInSeconds / 86_400) : "30",
  );
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

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
        onError: (error) => {
          if (classifyApiWrite(error) === "unknown") return;
          showError({
            title: t("projectSettings.machineTokens.issueFailed"),
            description: error.message,
          });
        },
      },
    );
  };

  return (
    <>
      {errorNotice}
      <MachineTokensPanelView
        tokens={tokens.data?.tokens.filter((token) => !token.revokedAt && !revokingIds.has(token.id)) ?? []}
        issuedToken={issuedToken}
        name={name}
        scopes={scopes}
        expiresInDays={expiresInDays}
        loading={tokens.isLoading}
        issuing={presentation.issuing}
        unresolvedIssue={presentation.unresolved}
        revoking={presentation.revoking}
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
