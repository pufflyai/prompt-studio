import { Button, Stack, Text } from "@chakra-ui/react";
import type { ChatRendererSnapshot, ControlValue } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "@pstdio/workbench";
import type { NativeChatHostProps, NativeChatHostServices } from "@pstdio/workbench/extensions";
import type { AgentInfo } from "pstdio-api-contracts";
import type { ReactNode } from "react";
import { openExtensionsPage } from "@/shared/workbench/page-navigation";
import { nativeHarnessReady } from "./native-harness-readiness";
import { SessionHarnessSignIn } from "./session-harness-sign-in";
import { SessionHarnessUnavailable } from "./session-harness-unavailable";
import { useAgents } from "./use-agents";
import { useHarnessAccount } from "./use-harness-account";

const readHarness = (value: ControlValue | undefined) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("harnessId" in value)) return {};
  return { harnessId: value.harnessId, model: value.model };
};

const NativeHarnessSetup = (props: {
  account: ReturnType<typeof useHarnessAccount>;
  agent?: AgentInfo;
  agentsChecked: boolean;
  selectionPending: boolean;
  workbench: WorkbenchCore;
}) => {
  const { account, agent, agentsChecked, workbench } = props;
  if (props.selectionPending || account.progress) return null;
  if (agent?.availability.type === "INSTALLED" && account.authenticationError)
    return (
      <Stack gap="xs">
        <Text role="alert">Could not check harness authentication.</Text>
        <Button size="xs" variant="ghost" onClick={account.retryAuthentication}>
          Retry
        </Button>
      </Stack>
    );
  if (!agentsChecked) return null;
  if (agent?.availability.type !== "INSTALLED")
    return <SessionHarnessUnavailable onReviewExtensions={() => openExtensionsPage(workbench)} />;
  if (!account.checked) return null;
  if (account.authentication?.status === "signed_out")
    return <SessionHarnessSignIn name={agent.name} onLogin={() => account.start("login")} />;
  return null;
};

export const useNativeHarnessAccount = (props: {
  workbench: WorkbenchCore;
  projectId?: string;
  binding: ChatRendererSnapshot["nativeHarnessAccount"];
  value: ControlValue | undefined;
  readOnly?: boolean;
  initializing?: boolean;
  session: NativeChatHostProps["session"];
}): NativeChatHostServices["account"] => {
  const { workbench, projectId, binding, value, readOnly, session } = props;
  const harness = readHarness(value);
  const { data: agents = [], isSuccess: agentsChecked } = useAgents(projectId);
  const agent =
    binding && !readOnly && !binding.remote ? agents.find((agent) => agent.id === harness.harnessId) : undefined;
  const account = useHarnessAccount(agent, { projectId, model: harness.model });
  const ready =
    !props.initializing &&
    nativeHarnessReady({
      remote: binding?.remote,
      agentsChecked,
      agent,
      authenticationChecked: account.checked,
      status: account.authentication?.status,
      model: harness.model,
      authenticating: Boolean(account.progress),
    });
  if (!binding) return undefined;
  const selectionPending = Boolean(props.initializing || (!harness.harnessId && agents.length));
  const needsSetup =
    !selectionPending &&
    agentsChecked &&
    (agent?.availability.type !== "INSTALLED" ||
      account.authenticationError ||
      account.authentication?.status === "signed_out");
  let setup: ReactNode;
  if (!binding.remote && !readOnly) {
    if (account.progress) setup = account.progress;
    else if (needsSetup)
      setup = (
        <NativeHarnessSetup
          account={account}
          agent={agent}
          agentsChecked={agentsChecked}
          selectionPending={selectionPending}
          workbench={workbench}
        />
      );
  }
  return {
    commands: account.commands,
    blocked: !ready,
    assertReady: () => {
      if (!ready) throw new Error("Sign in to an available harness before sending a message.");
    },
    isCommand: account.isCommand,
    submit: (text) =>
      account.submit(text, () => {
        if (session.getSnapshot().draft.text === text) session.changeDraft({ text: "" });
      }),
    progress: account.progress,
    notice: account.notice,
    setup,
  };
};
