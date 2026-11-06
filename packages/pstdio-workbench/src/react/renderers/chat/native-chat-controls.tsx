import { Button, Flex, Text } from "@chakra-ui/react";
import type { ChatDraft, ChatRendererSnapshot, ControlValueMap } from "@pstdio/sdk/extensions";
import { HarnessControls } from "@pstdio/ui/chat-ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { controlValueSchema } from "pstdio-api-contracts";
import type { ReactNode } from "react";
import type { ChatSession } from "../../../extensions/contributions/chat-session";
import type { CommandParamFieldRenderer } from "../../command-palette/command-param-field";
import { HarnessControl } from "../controls/harness-control";
import type { NativeChatHostServices } from "./native-chat-host";

interface NativeChatControlsProps {
  run: ChatSession["run"];
  conversation: ChatRendererSnapshot;
  draft: ChatDraft;
  renderParamField?: CommandParamFieldRenderer;
  editingQueuedRequest?: boolean;
  unavailable?: boolean;
  initializing?: boolean;
  reconnect?(): void;
  changeValues(values: ControlValueMap): void;
}

const inputTag = (tag: ChatRendererSnapshot["draftTag"], run: ChatSession["run"], values: ControlValueMap) =>
  tag
    ? {
        ...tag,
        onClose: () => {
          void run({ type: "operation", id: tag.clearActionId, values }).catch(() => undefined);
        },
      }
    : undefined;

export const NativeChatHarnessControls = (
  props: Pick<NativeChatControlsProps, "run" | "conversation" | "draft" | "unavailable" | "initializing">,
) => {
  const { run, conversation, draft } = props;
  if (!conversation.harness && !conversation.draftTag && !conversation.sentTag) return null;
  return (
    <HarnessControls
      modes={conversation.harness?.modes ?? []}
      unavailable={conversation.readOnly || props.unavailable || props.initializing}
      draftTag={inputTag(conversation.draftTag, run, draft.values)}
      sentTag={inputTag(conversation.sentTag, run, draft.values)}
      onRequestConfirmation={(modeId) => {
        void run({ type: "confirmation", modeId, values: draft.values }).catch(() => undefined);
      }}
      onAction={async (modeId, actionId, argument, modeSnapshot) => {
        await run({
          type: "harness",
          operation: { kind: "mode-action", modeId, actionId, argument },
          modeSnapshot,
          values: draft.values,
        });
      }}
    />
  );
};

export const NativeChatControls = (props: NativeChatControlsProps) => {
  const { run, conversation, draft, renderParamField, changeValues } = props;
  const change = (id: string, value: unknown) => {
    if (props.initializing) return;
    const values = { ...draft.values, [id]: controlValueSchema.parse(value) };
    changeValues(values);
    void run({ type: "control", id, values }).catch(() => undefined);
  };
  return (
    <Flex align="center" gap="2xs" wrap="wrap">
      {conversation.controls
        ?.filter((param) => param.type === "harness")
        .map((param) => (
          <HarnessControl
            key={param.id}
            presentation="chat"
            param={{ ...param, preserveSettings: param.preserveSettings || props.editingQueuedRequest }}
            value={draft.values[param.id] ?? param.defaultValue}
            readOnly={Boolean(conversation.readOnly || props.initializing)}
            renderParamField={renderParamField}
            onChange={(value) => change(param.id, value)}
          />
        ))}
      {conversation.controls?.some((param) => param.type !== "harness") ? (
        <ParamEditor
          variant="small"
          params={conversation.controls.filter((param) => param.type !== "harness")}
          defaultValues={draft.values}
          readOnly={conversation.readOnly || props.initializing}
          onChange={change}
        />
      ) : null}
      <NativeChatHarnessControls
        run={run}
        conversation={conversation}
        draft={draft}
        unavailable={props.unavailable}
        initializing={props.initializing}
      />
      {conversation.operations?.length ? (
        <Flex gap="xs" wrap="wrap">
          {conversation.operations.map((operation) => (
            <Button
              key={operation.id}
              size="xs"
              variant="ghost"
              disabled={operation.disabled || (operation.refresh ? !props.reconnect : conversation.readOnly)}
              onClick={() => {
                if (operation.refresh) props.reconnect?.();
                else void run({ type: "operation", id: operation.id, values: draft.values }).catch(() => undefined);
              }}
            >
              {operation.label}
            </Button>
          ))}
        </Flex>
      ) : null}
    </Flex>
  );
};

export const NativeChatApproval = (props: { run: ChatSession["run"]; conversation: ChatRendererSnapshot }) => {
  const { run, conversation } = props;
  const approval = conversation.approval;
  if (!approval) return null;
  return (
    <Flex direction="column" gap="xs">
      <Text>{approval.title}</Text>
      <Flex gap="xs">
        {approval.choices.map((choice) => (
          <Button
            key={choice.id}
            size="xs"
            disabled={conversation.readOnly}
            onClick={() => void run({ type: "approve", id: approval.id, choice: choice.id }).catch(() => undefined)}
          >
            {choice.label}
          </Button>
        ))}
      </Flex>
    </Flex>
  );
};

export const nativeChatCommands = (
  conversation: ChatRendererSnapshot,
  account: NativeChatHostServices["account"],
  run: ChatSession["run"],
  values?: ControlValueMap,
) => [
  ...(account?.commands ?? []),
  ...((account?.blocked ? [] : conversation.harness?.commands)
    ?.filter((command) => !account?.commands.some((local) => local.name === command.name))
    .map((command) => ({
      ...command,
      onSelect: command.composer
        ? () => {
            void run({ type: "selectCommand", name: command.name, values }).catch(() => undefined);
          }
        : undefined,
    })) ?? []),
];

export const nativeChatDecision = (
  conversation: ChatRendererSnapshot,
  controls: ReactNode,
  run: ChatSession["run"],
  values: ControlValueMap,
  pending: boolean,
) => {
  const decision = conversation.decision;
  if (!decision) return undefined;
  return {
    ...decision,
    controls,
    pending,
    onAction: async (actionId: string) => {
      await run({ type: "decision", id: decision.id, actionId, values, modeSnapshot: decision.modeSnapshot });
    },
  };
};
