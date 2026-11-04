import { createResultHash } from "./result-hash";
import { visitJson, visitText } from "./result-json";
import { createResultTextWindow, fitResultText, utf8Bytes } from "./result-text-window";
import type { SessionMessage, ToolPart, ToolResultSummary } from "./session-messages";

export const TOOL_RESULT_LIMIT_BYTES = 256 * 1024;
const resultFields = (part: ToolPart) => ({
  output: part.state?.output,
  errorText: part.state?.errorText,
  metadata: part.state?.metadata,
  resultSummary: part.state?.resultSummary,
});

export const toolResultBytes = (part: ToolPart) => {
  let bytes = 0;
  visitJson(resultFields(part), (chunk) => {
    bytes += utf8Bytes(chunk);
  });
  return bytes;
};

const fingerprint = (value: unknown) => {
  const hash = createResultHash();
  visitJson(value, (chunk) => hash.update(chunk));
  return hash.digest();
};

const originalOutputFingerprint = (part: ToolPart) => {
  if (part.state?.resultSummary) return part.state.resultSummary.outputFingerprint;
  const output = part.state?.output;
  const comparison = output && typeof output === "object" && "returnDisplay" in output ? output.returnDisplay : output;
  return fingerprint(comparison);
};

const originalErrorFingerprint = (part: ToolPart) => {
  if (part.state?.errorText !== undefined) return fingerprint(part.state.errorText);
  return part.state?.resultSummary?.errorFingerprint ?? fingerprint(undefined);
};

const originalMetadataFingerprint = (part: ToolPart) => {
  if (part.state?.metadata !== undefined) return fingerprint(part.state.metadata);
  return part.state?.resultSummary?.metadataFingerprint ?? fingerprint(undefined);
};

export const toolOutputFingerprint = (part: ToolPart) =>
  `${originalOutputFingerprint(part)}:${originalErrorFingerprint(part)}:${originalMetadataFingerprint(part)}`;

const marker = (omitted: number) => `\n[... ${omitted} UTF-8 bytes omitted ...]\n`;

const summarize = (head: string, tail: string, identity: ToolResultSummary, allowance: number) => {
  const overhead = utf8Bytes(
    JSON.stringify({
      output: marker(identity.originalBytes),
      resultSummary: {
        ...identity,
        omittedBytes: identity.originalBytes,
        headChars: allowance,
        tailChars: allowance,
      },
    }),
  );
  const half = Math.max(0, Math.floor((allowance - overhead) / 2));
  head = fitResultText(head, half, false);
  tail = fitResultText(tail, half, true);
  const omittedBytes = identity.originalBytes - utf8Bytes(head) - utf8Bytes(tail);
  return {
    output: head + marker(omittedBytes) + tail,
    resultSummary: { ...identity, omittedBytes, headChars: head.length, tailChars: tail.length },
  };
};

export const normalizeToolResult = (part: ToolPart, allowance = TOOL_RESULT_LIMIT_BYTES) => {
  if (!part.state || toolResultBytes(part) <= allowance) return part;
  const saved = part.state.resultSummary;
  let summary: ReturnType<typeof summarize>;
  if (saved && typeof part.state.output === "string") {
    const text = part.state.output;
    const identity = {
      ...saved,
      errorFingerprint: originalErrorFingerprint(part),
      metadataFingerprint: originalMetadataFingerprint(part),
    };
    if (part.state.errorText !== undefined && saved.errorFingerprint !== identity.errorFingerprint)
      identity.originalBytes += utf8Bytes(part.state.errorText);
    if (part.state.metadata !== undefined && saved.metadataFingerprint !== identity.metadataFingerprint) {
      visitJson(part.state.metadata, (chunk) => {
        identity.originalBytes += utf8Bytes(chunk);
      });
    }
    identity.fingerprint = fingerprint([
      identity.outputFingerprint,
      identity.errorFingerprint,
      identity.metadataFingerprint,
    ]);
    summary = summarize(text.slice(0, saved.headChars), text.slice(text.length - saved.tailChars), identity, allowance);
  } else {
    const window = createResultTextWindow(allowance);
    const write = (chunk: string) => window.append(chunk);
    if (
      typeof part.state.output === "string" &&
      part.state.errorText === undefined &&
      part.state.metadata === undefined
    )
      visitText(part.state.output, write);
    else visitJson(resultFields(part), write);
    const outputFingerprint = originalOutputFingerprint(part);
    const errorFingerprint = originalErrorFingerprint(part);
    const metadataFingerprint = originalMetadataFingerprint(part);
    summary = summarize(
      window.head(),
      window.tail(),
      {
        version: 1,
        originalBytes: window.size,
        omittedBytes: 0,
        fingerprint: fingerprint([outputFingerprint, errorFingerprint, metadataFingerprint]),
        outputFingerprint,
        errorFingerprint,
        metadataFingerprint,
        headChars: 0,
        tailChars: 0,
      },
      allowance,
    );
  }
  const { output: _output, errorText: _error, metadata: _metadata, resultSummary: _summary, ...rest } = part.state;
  return { ...part, state: { ...rest, ...summary } };
};

export const normalizeMessageResults = (message: SessionMessage) => {
  const parts = message.parts.map((part) => (part.type === "tool" ? normalizeToolResult(part) : part));
  return parts.every((part, index) => part === message.parts[index]) ? message : { ...message, parts };
};

/** Keeps bounded text before a harness publishes each whole-message revision. */
export const createToolOutputBuffer = (allowance = TOOL_RESULT_LIMIT_BYTES) => {
  const window = createResultTextWindow(allowance);
  const hash = createResultHash();
  hash.update('"');
  let pending = "";
  const append = (delta: string) => {
    let text = pending + delta;
    pending = "";
    const last = text.charCodeAt(text.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) {
      pending = text.slice(-1);
      text = text.slice(0, -1);
    }
    visitText(text, (chunk) => {
      window.append(chunk);
      hash.update(JSON.stringify(chunk).slice(1, -1));
    });
  };
  return {
    append,
    appendJson: (value: unknown) => visitJson(value, append, false),
    get retainedBytes() {
      return window.retainedBytes + utf8Bytes(pending);
    },
    result() {
      const size = window.size + utf8Bytes(pending);
      const output = window.head() + pending;
      if (size <= allowance && utf8Bytes(JSON.stringify({ output })) <= allowance)
        return { output, resultSummary: undefined };
      const id = hash.digest(`${JSON.stringify(pending).slice(1, -1)}"`);
      return summarize(
        window.head(),
        window.tail() + pending,
        {
          version: 1,
          originalBytes: size,
          omittedBytes: 0,
          fingerprint: fingerprint([id, fingerprint(undefined), fingerprint(undefined)]),
          outputFingerprint: id,
          errorFingerprint: fingerprint(undefined),
          metadataFingerprint: fingerprint(undefined),
          headChars: 0,
          tailChars: 0,
        },
        allowance,
      );
    },
  };
};
