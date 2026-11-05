import type { FormInfo } from "@opencode/client";
import { buildHeaders, buildRequestUrl, type OpencodeFetcher, requestJson, requireResponseOk } from "./opencode-http";
import type { WithServerUrl } from "./opencode-server";

export const createQuestionApi = (input: { fetcher: OpencodeFetcher; withServerUrl: WithServerUrl }) => {
  const request = <T>(path: string, cwd = process.cwd(), method = "GET", body?: unknown, signal?: AbortSignal) =>
    input.withServerUrl(async (base) => {
      const result = await requestJson<T>(input.fetcher, buildRequestUrl(base, path, cwd), {
        method,
        body,
        signal,
        headers: buildHeaders(cwd),
      });
      requireResponseOk(result.response, result.text, "OpenCode question request failed");
      return result.parsed as T;
    });
  const listPendingQuestions = async (sessionId: string, cwd?: string) => {
    const { data } = await request<{ data: FormInfo[] }>(`/api/session/${sessionId}/form`, cwd);
    return data
      .filter((form) => form.metadata?.kind === "question")
      .map((form) => ({
        id: form.id,
        sessionID: sessionId,
        tool:
          form.metadata?.tool && typeof form.metadata.tool === "object" && !Array.isArray(form.metadata.tool)
            ? { messageID: String(form.metadata.tool.messageID), callID: String(form.metadata.tool.id) }
            : undefined,
        questions: form.fields.map((field) => ({
          question: field.description ?? field.title ?? form.title,
          header: field.title ?? form.title,
          options:
            "options" in field
              ? (field.options?.map((option) => ({ label: option.label, description: option.description })) ?? [])
              : [],
          multiple: field.type === "multiselect",
        })),
      }));
  };
  const replyQuestion = async (
    sessionId: string,
    requestId: string,
    answers: string[][],
    cwd?: string,
    signal?: AbortSignal,
  ) => {
    const path = `/api/session/${sessionId}/form/${encodeURIComponent(requestId)}`;
    const { data: form } = await request<{ data: FormInfo }>(path, cwd, "GET", undefined, signal);
    const answer = Object.fromEntries(
      form.fields.map((field, index) => {
        const values = (answers[index] ?? []).map((label) => {
          const options = "options" in field ? field.options : undefined;
          return options?.find((option) => option.label === label)?.value ?? label;
        });
        let value: string | string[] | number | boolean = values[0] ?? "";
        if (field.type === "multiselect") value = values;
        if (field.type === "boolean") value = value === "true";
        if (field.type === "number" || field.type === "integer") value = Number(value);
        return [field.key, value];
      }),
    );
    await request(`${path}/reply`, cwd, "POST", { answer }, signal);
  };
  return { listPendingQuestions, replyQuestion };
};
