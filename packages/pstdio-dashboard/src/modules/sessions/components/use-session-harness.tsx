import type { HarnessCommandState } from "pstdio-api-contracts";
import type { ReactNode } from "react";
import { useAgents } from "@/shared/agents/use-agents";
import { openExtensionsPage } from "@/shared/workbench/page-navigation";
import type { SessionViewContext } from "../chat/session-view-context";
import { sessionHarnessAccess } from "../runtime/session-harness-access";
import { canSubmitSessionMessage } from "../runtime/session-runtime-selection";
import { SessionHarnessSignIn } from "./session-harness-sign-in";
import { SessionHarnessUnavailable } from "./session-harness-unavailable";
import { useHarnessAccount } from "./use-harness-account";

interface SessionHarnessInput {
  input: SessionViewContext;
  projectId?: string;
  selectedAgent: string;
  selectedModel: string;
  otherDevice: boolean;
  onInterrupt?: () => void;
}

export const useSessionHarness = (props: SessionHarnessInput) => {
  const { input, projectId, selectedAgent, selectedModel, otherDevice, onInterrupt } = props;
  const { data: agents = [], isSuccess } = useAgents(projectId);
  const agent = agents.find((item) => item.id === selectedAgent);
  const account = useHarnessAccount(otherDevice ? undefined : agent, { projectId, model: selectedModel });
  const access = otherDevice
    ? "ready"
    : sessionHarnessAccess(agents, selectedAgent, Boolean(projectId && isSuccess), account.authentication?.status);
  const noHarnessAvailable = access === "missing";
  const needsLogin = access === "signed_out";
  const canSubmit =
    !needsLogin &&
    !account.checking &&
    !account.progress &&
    canSubmitSessionMessage({
      agentOptions: agents.map((item) => ({ value: item.id, disabled: item.availability.type === "NOT_FOUND" })),
      selectedAgent,
      selectedModel,
      requiresModel: agent?.supportsModels ?? true,
    });
  let setup: ReactNode;
  if (noHarnessAvailable)
    setup = (
      <SessionHarnessUnavailable
        onInterrupt={onInterrupt}
        onReviewExtensions={() => openExtensionsPage(input.workbench)}
      />
    );
  if (needsLogin && agent) setup = <SessionHarnessSignIn name={agent.name} onLogin={() => account.start("login")} />;
  if (account.progress) setup = account.progress;
  return {
    account,
    canSubmit,
    noHarnessAvailable,
    needsLogin,
    setup,
    commands: (native: HarnessCommandState["commands"]) => [
      ...account.commands,
      ...(needsLogin
        ? []
        : native.filter((command) => !account.commands.some((account) => account.name === command.name))),
    ],
    submitAccountCommand: (text: string, onSubmitted: () => void) => {
      const command = account.submit(text, onSubmitted);
      if (command) return command;
      if (needsLogin || noHarnessAvailable || account.checking || account.progress)
        return Promise.reject(new Error("Sign in to an available harness before sending a message."));
      return undefined;
    },
  };
};
