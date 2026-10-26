import type {
  HarnessAuthentication,
  HarnessAuthenticationPrompt,
  HarnessAuthenticationQuestion,
} from "pstdio-api-contracts";
import { useEffect, useRef, useState } from "react";
import { getApiClient } from "@/lib/api";
import { reserveAccountBrowser } from "./account-browser";
import { HarnessBrowserProgress } from "./harness-browser-progress";

interface AccountState {
  name: string;
  action: "login" | "logout";
  prompt?: Extract<HarnessAuthenticationPrompt, { type: "browser" }>;
  question?: HarnessAuthenticationQuestion;
  message?: string;
}
export const useBrowserHarnessAccount = (projectId?: string, agentId?: string, model?: string) => {
  const [state, setState] = useState<AccountState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<{
    controller: AbortController;
    scope: string;
    reply?: (value: string) => void;
    reserve?: () => void;
  } | null>(null);
  const scope = JSON.stringify([projectId, agentId, model]);
  useEffect(() => {
    setState(null);
    setError(null);
    return () => {
      if (active.current?.scope === scope) {
        active.current.controller.abort();
        active.current = null;
      }
    };
  }, [scope]);
  const cancel = () => {
    active.current?.controller.abort();
    active.current = null;
    setState(null);
  };
  const start = (
    action: "login" | "logout",
    name: string,
    authentication: HarnessAuthentication,
    onComplete: () => void | Promise<void>,
  ) => {
    if (!agentId) return;
    cancel();
    const controller = new AbortController();
    let page: ReturnType<typeof reserveAccountBrowser> | undefined;
    const reserve = () => {
      page?.closeUnused();
      page = reserveAccountBrowser();
    };
    const providers = authentication.providers.filter((provider) => provider.methods.length);
    if (
      action === "login" &&
      providers.length === 1 &&
      providers[0]?.methods.length === 1 &&
      providers[0]?.methods[0]?.kind === "oauth"
    )
      reserve();
    const operation = { controller, scope, reserve, reply: undefined as ((value: string) => void) | undefined };
    active.current = operation;
    setState({ action, name });
    setError(null);
    void getApiClient()
      .agents.authenticate(
        agentId,
        { action, model },
        {
          projectId,
          signal: controller.signal,
          onPrompt: (prompt) => {
            if (controller.signal.aborted) return;
            if (prompt.type === "browser") {
              setState((current) => (current ? { ...current, prompt } : current));
              page?.show(prompt.url);
            }
            if (prompt.type === "message")
              setState((current) => (current ? { ...current, message: prompt.message } : current));
          },
          onRequest: (question) =>
            new Promise<string>((resolve, reject) => {
              const abort = () => reject(controller.signal.reason);
              controller.signal.addEventListener("abort", abort, { once: true });
              operation.reply = (value) => {
                controller.signal.removeEventListener("abort", abort);
                if (
                  question.type === "select" &&
                  question.options.find((option) => option.id === value)?.kind === "oauth"
                )
                  reserve();
                operation.reply = undefined;
                setState((current) => (current ? { ...current, question: undefined } : current));
                resolve(value);
              };
              setState((current) => (current ? { ...current, question } : current));
            }),
        },
      )
      .then(async () => {
        if (active.current === operation) await onComplete();
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted && active.current === operation)
          setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        controller.abort();
        page?.closeUnused();
        if (active.current === operation) {
          active.current = null;
          setState(null);
        }
      });
  };
  return {
    start,
    cancel,
    error,
    dismissError: () => setError(null),
    reportError: setError,
    progress: state ? (
      <HarnessBrowserProgress {...state} onReply={(value) => active.current?.reply?.(value)} onCancel={cancel} />
    ) : null,
  };
};
