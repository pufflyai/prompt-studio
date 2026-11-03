import * as Y from "yjs";
import type { Page } from "../scripts/playwright-test";

type Observation =
  | { kind: "composition"; type: string; data: string; trusted: boolean }
  | { kind: "submit"; update: string; sequence: number; composing: boolean; started: number; ended: number }
  | { kind: "snapshot"; state: string; revision: number; composing: boolean; via: "open" | "stream" };

/** Observe public HTTP bytes and trusted DOM input without consuming extra stream data. */
export const observePublicTextInput = async (page: Page) => {
  const records: Observation[] = [];
  const snapshots: { text: string; revision: number; composing: boolean; via: "open" | "stream" }[] = [];
  await page.exposeFunction("recordPublicTextInput", (record: Observation) => {
    records.push(record);
    if (record.kind === "snapshot") {
      const document = new Y.Doc();
      try {
        Y.applyUpdate(document, Buffer.from(record.state, "base64"));
        snapshots.push({
          text: document.getText("content").toString(),
          revision: record.revision,
          composing: record.composing,
          via: record.via,
        });
      } finally {
        document.destroy();
      }
    }
  });
  await page.addInitScript(() => {
    const record = (window as unknown as { recordPublicTextInput: (value: Observation) => void }).recordPublicTextInput;
    let composing = false;
    let started = 0;
    let ended = 0;
    let activeHandle: string | undefined;
    let activeMember: string | undefined;
    for (const type of ["compositionstart", "compositionupdate", "compositionend"])
      document.addEventListener(
        type,
        (event) => {
          if (type === "compositionstart") {
            composing = true;
            started++;
          }
          if (type === "compositionend") {
            composing = false;
            ended++;
          }
          record({ kind: "composition", type, data: (event as CompositionEvent).data, trusted: event.isTrusted });
        },
        true,
      );
    const observeFrame = (frame: string) => {
      if (!frame.split("\n").includes("event: text")) return;
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n");
      if (!data) return;
      const event = JSON.parse(data);
      if (event.type === "snapshot" && event.handle === activeHandle && event.memberId === activeMember)
        record({
          kind: "snapshot",
          state: event.snapshot.state,
          revision: event.snapshot.revision,
          composing,
          via: "stream",
        });
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (...args: Parameters<typeof window.fetch>) => {
      const [input, init] = args;
      const url = input instanceof Request ? input.url : String(input);
      const request =
        url.endsWith("/text-editing/request") && typeof init?.body === "string"
          ? JSON.parse(init.body).request
          : undefined;
      if (request?.operation === "submit")
        record({ kind: "submit", update: request.update, sequence: request.sequence, composing, started, ended });
      const response = await originalFetch(...args);
      if (request?.operation === "open") {
        const json = response.json.bind(response);
        response.json = () =>
          json().then((reply) => {
            if (reply.ok) {
              activeHandle = reply.value.handle;
              activeMember = request.memberId;
              record({
                kind: "snapshot",
                state: reply.value.snapshot.state,
                revision: reply.value.snapshot.revision,
                composing,
                via: "open",
              });
            }
            return reply;
          });
      }
      const body = response.body;
      if (!url.endsWith("/text-editing/stream") || !body) return response;
      const getReader = body.getReader.bind(body);
      body.getReader = (() => {
        const reader = getReader();
        const read = reader.read.bind(reader);
        const decoder = new TextDecoder();
        let previous = "";
        reader.read = (() => {
          // The app requests this chunk after its previous synchronous SSE receive callbacks return.
          const frames = previous.split("\n\n");
          previous = frames.pop() ?? "";
          for (const frame of frames) observeFrame(frame);
          return read().then((result) => {
            if (result.value) previous += decoder.decode(result.value, { stream: true });
            return result;
          });
        }) as typeof reader.read;
        return reader;
      }) as typeof body.getReader;
      return response;
    }) as typeof window.fetch;
  });
  return {
    records,
    snapshots,
    submissions: () => records.filter((record) => record.kind === "submit"),
    compositions: () => records.filter((record) => record.kind === "composition"),
  };
};
