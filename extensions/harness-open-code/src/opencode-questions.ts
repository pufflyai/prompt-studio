import { buildHeaders, buildRequestUrl, type OpencodeFetcher, requestJson, requireResponseOk } from "./opencode-http";
import type { WithServerUrl } from "./opencode-server";

export type OpencodeQuestionRequest = {
  id: string;
  sessionID: string;
  questions: unknown[];
  tool?: {
    messageID?: string;
    callID?: string;
  };
};

export const createQuestionApi = (input: { fetcher: OpencodeFetcher; withServerUrl: WithServerUrl }) => {
  const { fetcher, withServerUrl } = input;

  const listPendingQuestions = async (cwd?: string) => {
    const directory = cwd?.trim() || process.cwd();

    const fetchQuestions = async (baseUrl: string) => {
      const headers = buildHeaders(directory);
      const url = buildRequestUrl(baseUrl, "/question", directory);

      const { response, text, parsed } = await requestJson<OpencodeQuestionRequest[]>(fetcher, url, {
        method: "GET",
        headers,
      });

      requireResponseOk(response, text, "OpenCode list questions failed");

      if (!parsed || !Array.isArray(parsed)) return [];

      return parsed as OpencodeQuestionRequest[];
    };

    return withServerUrl(fetchQuestions);
  };

  const replyQuestion = async (requestId: string, answers: string[][], cwd?: string) => {
    const directory = cwd?.trim() || process.cwd();

    const answerQuestion = async (baseUrl: string) => {
      const headers = buildHeaders(directory);
      const encodedRequestId = encodeURIComponent(requestId);
      const url = buildRequestUrl(baseUrl, `/question/${encodedRequestId}/reply`, directory);

      const { response, text } = await requestJson<boolean>(fetcher, url, {
        method: "POST",
        headers,
        body: { answers },
      });

      requireResponseOk(response, text, "OpenCode question.reply failed");
    };

    return withServerUrl(answerQuestion);
  };

  return { listPendingQuestions, replyQuestion };
};
