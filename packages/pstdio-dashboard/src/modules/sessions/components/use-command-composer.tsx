import { AlertMessage } from "@pstdio/ui";
import { type ChatInputQuestionResponse, HarnessControls } from "@pstdio/ui/chat-ui";
import type { SessionAttachment } from "pstdio-api-contracts";
import { useEffect, useRef, useState } from "react";
import { useHarnessCommands } from "../hooks/use-harness-commands";
import type { useSessionChatDraft } from "./use-session-chat-draft";
export const useCommandComposer = (
  sessionId: string | null,
  selectedAgent: string,
  chatDraft: ReturnType<typeof useSessionChatDraft>,
  reconnect: () => void,
  status: string | undefined,
  lastRequestStarted: string | null | undefined,
) => {
  const scope = JSON.stringify([sessionId, selectedAgent]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const pendingCommand = useRef<{ scope: string; text: string; previousRequest: string | null | undefined } | null>(
    null,
  );
  const draftText = useRef(chatDraft.seed);
  const commands = useHarnessCommands(sessionId, selectedAgent);
  const [commandText, setCommandText] = useState("");
  const [literalCommand, setLiteralCommand] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [commandOutcome, setCommandOutcome] = useState<string | null>(null);
  const invokeCommand = async (operation: Parameters<typeof commands.invoke.mutateAsync>[0]) => {
    const requestScope = scope;
    try {
      setCommandError(null);
      setCommandOutcome(null);
      const result = await commands.invoke.mutateAsync(operation);
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
  const previousScope = useRef(scope);
  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    pendingCommand.current = null;
    setLiteralCommand(false);
    setCommandError(null);
    setCommandOutcome(null);
  }, [scope]);

  useEffect(() => {
    const pending = pendingCommand.current;
    if (!status || !pending || pending.scope !== scope || lastRequestStarted === pending.previousRequest) return;
    if (["in_progress", "awaiting_input", "queued"].includes(status)) return;
    pendingCommand.current = null;
    if (status === "failed" || status === "disconnected") {
      if (!draftText.current) chatDraft.restore(pending.text);
      setCommandError(`Native command ${pending.text} ${status}. Check the conversation before retrying.`);
    }
  }, [scope, status, lastRequestStarted, chatDraft]);
  return {
    submit: (
      text: string,
      attachments: SessionAttachment[],
      questionResponse: ChatInputQuestionResponse | undefined,
      onSubmitted?: () => void,
    ) => {
      if (!sessionId || literalCommand || questionResponse || !/^\/[^\s/]+(?:\s|$)/.test(text)) return undefined;
      if (!commands.state) {
        const message = commands.loading
          ? "Commands are still loading. Try again when they are ready."
          : "Native commands are unavailable. Reload the session and try again.";
        setCommandError(message);
        return Promise.reject(new Error(message));
      }
      if (!commands.state.slashCommands) return undefined;
      if (attachments.length) {
        setCommandError("Remove attachments or send this command as a message.");
        return Promise.reject(new Error("Command attachments are not supported."));
      }
      return invokeCommand({ kind: "command", text }).then((result) => {
        if (result.status === "started") pendingCommand.current = { scope, text, previousRequest: lastRequestStarted };
        onSubmitted?.();
        draftText.current = "";
        setCommandText("");
      });
    },
    header: commands.state ? (
      <HarnessControls
        slashCommands={commands.state.slashCommands}
        commands={commands.state.commands}
        modes={commands.state.modes}
        query={commandText}
        pending={commands.invoke.isPending}
        literal={literalCommand}
        onLiteralChange={setLiteralCommand}
        onInsert={(text) => {
          chatDraft.restore(text);
          setCommandText(text);
        }}
        onAction={async (modeId, actionId, argument) => {
          await invokeCommand({ kind: "mode-action", modeId, actionId, argument });
        }}
      />
    ) : undefined,
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
