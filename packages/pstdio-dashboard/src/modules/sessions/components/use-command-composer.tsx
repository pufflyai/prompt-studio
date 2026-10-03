import { AlertMessage } from "@pstdio/ui";
import { type ChatInputQuestionResponse, HarnessControls } from "@pstdio/ui/chat-ui";
import type {
  DraftHarnessCommandInput,
  HarnessCommandState,
  HarnessOperation,
  SessionAttachment,
} from "pstdio-api-contracts";
import { useEffect, useRef, useState } from "react";
import {
  assertSingleCommand,
  type ComposerIntent,
  composerCommandProblem,
  taggedCommandOperation,
} from "../chat/composer-command";
import { handOffNativeCommand, type SubmittedCommand, takeNativeCommand } from "../chat/native-command-handoff";
import { useHarnessCommands } from "../hooks/use-harness-commands";
import type { useSessionChatDraft } from "./use-session-chat-draft";
export const useCommandComposer = (
  sessionId: string | null,
  selectedAgent: string,
  chatDraft: ReturnType<typeof useSessionChatDraft>,
  reconnect: () => void,
  status: string | undefined,
  lastRequestStarted: string | null | undefined,
  draft: DraftHarnessCommandInput | undefined,
  createCommand: Parameters<typeof useHarnessCommands>[3],
  onCreated: (sessionId: string, title: string) => void,
) => {
  const scope = JSON.stringify([sessionId, selectedAgent, sessionId ? undefined : draft]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const pendingCommand = useRef<{
    scope: string;
    text: string;
    previousRequest: string | null | undefined;
    message?: string;
    submitted?: SubmittedCommand;
  } | null>(null);
  const draftText = useRef(chatDraft.seed);
  const commands = useHarnessCommands(sessionId, selectedAgent, draft, createCommand);
  const [commandText, setCommandText] = useState("");
  const [commandError, setCommandError] = useState<string | null>(null);
  const [commandOutcome, setCommandOutcome] = useState<string | null>(null);
  const [intent, setIntent] = useState<ComposerIntent | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedCommand | null>(null);
  const previousSession = useRef(sessionId);
  const intentProblem = intent ? composerCommandProblem(intent, selectedAgent, commands.state) : undefined;
  const invokeCommand = async (operation: HarnessOperation, modeSnapshot?: HarnessCommandState["modes"][number]) => {
    const requestScope = scope;
    try {
      setCommandError(null);
      setCommandOutcome(null);
      const result = await commands.invoke.mutateAsync({ operation, modeSnapshot });
      if (currentScope.current !== requestScope) throw new DOMException("The conversation changed.", "AbortError");
      setCommandOutcome(result.message ?? null);
      reconnect();
      return result;
    } catch (error) {
      if (currentScope.current === requestScope)
        setCommandError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
  useEffect(() => {
    setCommandText(chatDraft.seed);
    draftText.current = chatDraft.seed;
  }, [chatDraft.seed]);
  const previousScope = useRef<string | null>(null);
  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    if (previousSession.current !== sessionId) setIntent(null);
    previousSession.current = sessionId;
    const handedOff = takeNativeCommand(sessionId, selectedAgent);
    pendingCommand.current = handedOff?.kind === "pending" ? { scope, ...handedOff } : null;
    setCommandError(null);
    setCommandOutcome(handedOff?.kind === "outcome" ? (handedOff.message ?? null) : null);
    setSubmitted(handedOff?.submitted ?? null);
  }, [scope, sessionId, selectedAgent]);

  useEffect(() => {
    if (
      submitted?.intent.command.composer?.modeId &&
      commands.state?.modes.some((mode) => mode.id === submitted.intent.command.composer?.modeId)
    )
      setSubmitted(null);
  }, [submitted, commands.state]);

  useEffect(() => {
    const pending = pendingCommand.current;
    if (!status || !pending || pending.scope !== scope || lastRequestStarted === pending.previousRequest) return;
    if (["in_progress", "awaiting_input", "queued"].includes(status)) return;
    pendingCommand.current = null;
    if (status === "failed" || status === "disconnected") {
      if (!draftText.current) {
        chatDraft.restore(pending.submitted?.objective ?? pending.text);
        setIntent(pending.submitted?.intent ?? null);
      }
      setSubmitted(null);
      setCommandError(
        pending.message ?? `Native command ${pending.text} ${status}. Check the conversation before retrying.`,
      );
    }
  }, [scope, status, lastRequestStarted, chatDraft]);
  const acceptCommand = (result: Awaited<ReturnType<typeof invokeCommand>>, text: string, onSubmitted?: () => void) => {
    const reference = intent ? { intent, objective: text.trim() } : undefined;
    if (result.status === "started") {
      if (result.sessionId)
        handOffNativeCommand(result.sessionId, {
          kind: "pending",
          harnessId: selectedAgent,
          text,
          previousRequest: null,
          message: result.message,
          submitted: reference,
        });
      else pendingCommand.current = { scope, text, previousRequest: lastRequestStarted, submitted: reference };
    } else if (result.sessionId)
      handOffNativeCommand(result.sessionId, {
        kind: "outcome",
        harnessId: selectedAgent,
        message: result.message,
        submitted: reference,
      });
    onSubmitted?.();
    draftText.current = "";
    setIntent(null);
    setSubmitted(reference ?? null);
    setCommandText("");
    if (result.sessionId) onCreated(result.sessionId, text);
  };
  const operationForDraft = (
    text: string,
    attachments: SessionAttachment[],
    questionResponse?: ChatInputQuestionResponse,
  ) => {
    if (intent) {
      if (questionResponse) throw new Error("Remove the draft tag before answering the agent's question.");
      return taggedCommandOperation(intent, text, selectedAgent, commands.state, attachments.length);
    }
    if (questionResponse || !/^\/[^\s/]+(?:\s|$)/.test(text)) return undefined;
    if (!commands.state)
      throw new Error(
        commands.loading
          ? "Commands are still loading. Try again when they are ready."
          : "Native commands are unavailable. Reload the session and try again.",
      );
    if (!commands.state.slashCommands) return undefined;
    if (attachments.length) throw new Error("Remove attachments before running this command.");
    assertSingleCommand(text, commands.state);
    return { kind: "command" as const, text };
  };
  return {
    suggestions:
      commands.state?.slashCommands && !commands.invoke.isPending
        ? commands.state.commands.map((command) => ({
            ...command,
            disabledReason:
              command.disabledReason ??
              (intent && command.name !== intent.command.name
                ? `Remove ${intent.command.composer?.label} first.`
                : undefined),
            ...(command.composer
              ? {
                  onSelect: () => {
                    setIntent({ harnessId: selectedAgent, command });
                  },
                }
              : {}),
          }))
        : [],
    submit: (
      text: string,
      attachments: SessionAttachment[],
      questionResponse: ChatInputQuestionResponse | undefined,
      onSubmitted?: () => void,
    ) => {
      try {
        const operation = operationForDraft(text, attachments, questionResponse);
        if (!operation) return undefined;
        return invokeCommand(operation).then((result) => acceptCommand(result, text, onSubmitted));
      } catch (error) {
        setCommandError(error instanceof Error ? error.message : String(error));
        return Promise.reject(error);
      }
    },
    controls: (
      <HarnessControls
        modes={commands.state?.modes ?? []}
        draftTag={
          intent
            ? {
                label: intent.command.composer?.label ?? intent.command.name,
                closeLabel: `Remove ${intent.command.composer?.label ?? intent.command.name}`,
                description:
                  intentProblem ??
                  `${intent.command.composer?.label}: ${commandText.trim() || "draft input"} · ${commands.invoke.isPending ? "Starting" : "Draft"}`,
                onClose: () => setIntent(null),
              }
            : undefined
        }
        sentTag={
          submitted && !commands.state?.modes.some((mode) => mode.id === submitted.intent.command.composer?.modeId)
            ? {
                label: submitted.intent.command.composer?.label ?? submitted.intent.command.name,
                description: `${submitted.objective} · Native status is not confirmed. Closing hides this reference only.`,
                onClose: () => setSubmitted(null),
                closeLabel: `Hide submitted ${submitted.intent.command.composer?.label?.toLowerCase() ?? "input"}`,
              }
            : undefined
        }
        pending={commands.invoke.isPending}
        unavailable={Boolean(commands.error)}
        error={commandError ? { message: commandError, onClose: () => setCommandError(null) } : undefined}
        onRefresh={commands.refresh}
        onAction={async (modeId, actionId, argument, modeSnapshot) => {
          const result = await invokeCommand({ kind: "mode-action", modeId, actionId, argument }, modeSnapshot);
          if (result.sessionId) onCreated(result.sessionId, "New session");
        }}
      />
    ),
    change: (text: string) => {
      draftText.current = text;
      chatDraft.change(text);
      setCommandText(text);
    },
    notices: (
      <>
        {commandError ? (
          <AlertMessage status="error" title="Command failed" onClose={() => setCommandError(null)}>
            {commandError}
          </AlertMessage>
        ) : null}
        {commandOutcome ? (
          <AlertMessage status="info" title="Command result" onClose={() => setCommandOutcome(null)}>
            {commandOutcome}
          </AlertMessage>
        ) : null}
      </>
    ),
  };
};
