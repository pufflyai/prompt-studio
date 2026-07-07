export type TerminalStreamEvent =
  | { kind: "data"; chunk: Uint8Array }
  | { kind: "title"; title: string }
  | { kind: "exit"; code: number | null; signal: string | null }
  | { kind: "error"; message: string };

const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const parseBlock = (block: string): TerminalStreamEvent | null => {
  const lines = block.split("\n");
  const event = lines
    .find((line) => line.startsWith("event:"))
    ?.slice("event:".length)
    .trim();
  const data = lines
    .find((line) => line.startsWith("data:"))
    ?.slice("data:".length)
    .trim();
  if (!event || !data) return null;

  if (event === "data") return { kind: "data", chunk: decodeBase64((JSON.parse(data) as { chunk: string }).chunk) };
  if (event === "title") return { kind: "title", title: (JSON.parse(data) as { title: string }).title };
  if (event === "exit") {
    const exit = JSON.parse(data) as { code: number | null; signal: string | null };
    return { kind: "exit", code: exit.code, signal: exit.signal };
  }
  if (event === "error") return { kind: "error", message: (JSON.parse(data) as { message: string }).message };
  return null;
};

/**
 * Incremental parser for the `/v1/terminal/sessions/:id/events` SSE stream.
 * Fetch delivers arbitrary text chunks; blocks are only parsed once their
 * terminating blank line arrives.
 */
export const createTerminalSseParser = () => {
  let buffer = "";

  return {
    push(text: string) {
      buffer += text;
      const events: TerminalStreamEvent[] = [];

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseBlock(block);
        if (event) events.push(event);
        boundary = buffer.indexOf("\n\n");
      }

      return events;
    },
  };
};
