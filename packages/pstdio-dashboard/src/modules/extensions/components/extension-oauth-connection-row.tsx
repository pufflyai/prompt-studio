import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { useActionError } from "@/shared/components/use-action-error";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { type ConnectionDefinition, getExtensionConnectionOperations } from "../data/use-extension-connections";
import { ExtensionOAuthConnectionControls } from "./extension-oauth-connection-controls";

interface ExtensionOAuthConnectionRowProps {
  authority: string;
  definition: ConnectionDefinition;
  projectId: string;
}

export const ExtensionOAuthConnectionRow = (props: ExtensionOAuthConnectionRowProps) => {
  const { authority, definition, projectId } = props;
  const owner = getRuntimeCollections();
  const api = getRuntimeApiClient(owner).extensions;
  const [busy, setBusy] = useState<"connect" | "disconnect">();
  const [authorizationUrl, setAuthorizationUrl] = useState<string>();
  const { t } = useTranslation("projects");
  const { clearError, errorNotice, showError } = useActionError();
  const address = [projectId, definition.extensionId, definition.localId] as const;
  const current = () => getExtensionConnectionOperations(owner).authority() === authority;
  const queryClient = useQueryClient();
  const queryKey = ["extension-oauth-status", authority, ...address] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => api.connectionOAuthStatus(...address),
    refetchOnWindowFocus: "always",
    refetchInterval: (query) => {
      if (query.state.data?.status === "authorizing") return 1_500;
      return query.state.data?.status === "connected" ? 15_000 : false;
    },
  });

  const change = async (action: "connect" | "disconnect") => {
    if (!current() || busy) return;
    const { accountId, accountOrigin } = getDashboardScopedQueries(owner).getScope();
    const expected = accountId && accountOrigin ? { accountId, managerOrigin: accountOrigin } : null;
    clearError();
    setBusy(action);
    setAuthorizationUrl(undefined);
    try {
      if (action === "disconnect") {
        await api.disconnectConnectionOAuth(...address, expected);
      } else {
        const started = await api.startConnectionOAuth(...address, expected);
        if (current()) {
          queryClient.setQueryData(queryKey, { status: "authorizing" });
          setAuthorizationUrl(started.authorizationUrl);
          window.open(started.authorizationUrl, "_blank", "noopener,noreferrer");
        }
      }
    } catch (cause) {
      if (current())
        showError({
          title: t("projectSettings.extensionsPanel.connections.actionFailed"),
          description: cause instanceof Error ? cause.message : String(cause),
        });
    } finally {
      if (current()) {
        await query.refetch();
        setBusy(undefined);
      }
    }
  };

  return (
    <ExtensionOAuthConnectionControls
      label={resolveLocalizableString(definition.label, definition.extensionId, undefined, owner, projectId)}
      status={query.data?.status}
      busy={busy}
      authorizationUrl={authorizationUrl}
      error={errorNotice}
      failed={query.isError && !query.data}
      onRetry={() => void query.refetch()}
      onConnect={() => void change("connect")}
      onDisconnect={() => void change("disconnect")}
    />
  );
};
