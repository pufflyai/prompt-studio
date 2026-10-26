import { Button, Stack, Text } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgentInfo } from "pstdio-api-contracts";
import { useTranslation } from "react-i18next";
import { getApiClient } from "@/lib/api";
import { useBrowserHarnessAccount } from "@/shared/agents/use-browser-harness-account";
import { harnessAccountCommand } from "../chat/harness-account-command";

/** Account replies use a dedicated channel, outside commands and conversation history. */
export const useHarnessAccount = (
  agent: AgentInfo | undefined,
  options: { projectId?: string; model?: string } = {},
) => {
  const { projectId, model } = options;
  const { t } = useTranslation("projects");
  const queries = useQueryClient();
  const query = useQuery({
    queryKey: ["harness-authentication", projectId, agent?.id, model],
    queryFn: () => getApiClient().agents.authentication(agent!.id, { projectId, model }),
    enabled: agent?.availability.type === "INSTALLED",
    refetchInterval: 15_000,
  });
  const browser = useBrowserHarnessAccount(projectId, agent?.id, model);
  const authentication = query.data;
  const refresh = () =>
    Promise.all([
      queries.invalidateQueries({ queryKey: ["harness-authentication"] }),
      queries.invalidateQueries({ queryKey: ["agent-models"] }),
    ]).then(() => {});
  const start = (action: "login" | "logout") => {
    if (authentication && agent) browser.start(action, agent.name, refresh);
  };
  const commands = authentication?.providers.length
    ? (["login", "logout"] as const).map((action) => ({
        name: "/" + action,
        description: t("harnessAccount." + action),
        onSelect: () => start(action),
      }))
    : [];
  return {
    start,
    authentication,
    checking: query.isFetching && !query.data,
    progress: browser.progress,
    commands,
    isCommand: (text: string) => Boolean(authentication && harnessAccountCommand(text)),
    submit: (text: string, onSubmitted?: () => void) => {
      const command = authentication && harnessAccountCommand(text);
      if (!command) return undefined;
      if (command.argument) {
        const message = t("harnessAccount.noArguments", { command: "/" + command.action });
        browser.reportError(message);
        return Promise.reject(new Error(message));
      }
      start(command.action);
      onSubmitted?.();
      return Promise.resolve();
    },
    notice: browser.error ? (
      <Stack gap="xs">
        <Text color="fg.error" textStyle="paragraph/S/regular">
          {browser.error}
        </Text>
        <Button size="sm" variant="ghost" onClick={browser.dismissError}>
          {t("harnessAccount.close")}
        </Button>
      </Stack>
    ) : null,
  };
};
