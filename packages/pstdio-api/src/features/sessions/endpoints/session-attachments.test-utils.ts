import { expect, mock } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  HarnessExit,
  HarnessResumeInput,
  HarnessSession,
  HarnessStartInput,
  SessionMessage,
} from "pstdio-api-contracts";
import { createApp } from "../../../app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

export const FAKE_ID = testHarnessId("fake");

const tempRoots: string[] = [];

type HarnessOptions = {
  deferExit?: boolean;
  delayHarnessResolutionAfterGets?: number;
  resumeThrows?: boolean;
  startThrows?: boolean;
  transcriptDropsAttachments?: boolean;
};

const createSessionCompleter = (deferExit: boolean | undefined) => {
  const pending: Array<(exit: HarnessExit) => void> = [];

  const completeSession = (agentSessionId: string): HarnessSession => {
    if (!deferExit) {
      return {
        agentSessionId,
        done: Promise.resolve({ status: "completed" } satisfies HarnessExit),
        stop: () => {},
      };
    }

    const done = new Promise<HarnessExit>((resolve) => pending.push(resolve));
    return { agentSessionId, done, stop: () => {} };
  };

  const completeAll = () => {
    while (pending.length > 0) {
      pending.shift()?.({ status: "completed" });
    }
  };

  return { completeAll, completeSession };
};

const userMessage = (
  id: string,
  prompt: string,
  attachments: NonNullable<HarnessStartInput["attachments"]>,
): SessionMessage => ({
  id,
  role: "user",
  parts: [
    { type: "text", text: prompt },
    ...attachments.map((attachment) => ({
      type: "file" as const,
      fileId: attachment.fileId,
      filename: attachment.fileName,
      mediaType: attachment.mimeType ?? undefined,
      size: attachment.sizeBytes,
      url: `/v1/projects/project/session-attachments/${attachment.fileId}/content`,
    })),
  ],
});

const transcriptUserMessage = (id: string, text: string): SessionMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

const promptWithSyntheticManifest = (prompt: string, attachments: NonNullable<HarnessStartInput["attachments"]>) =>
  [
    prompt,
    "",
    "<session-attachments>",
    ...attachments.map((attachment) => `- name="${attachment.fileName}" path="${attachment.localPath}"`),
    "</session-attachments>",
  ].join("\n");

const createAttachmentHarness = (options: HarnessOptions = {}) => {
  const sessions = new Map<string, SessionMessage[]>();
  const completer = createSessionCompleter(options.deferExit);
  const harnessResolution = Promise.withResolvers<void>();
  let harnessGetCount = 0;
  const start = mock((_ctx: unknown, input: HarnessStartInput) => {
    if (options.startThrows) {
      throw new Error("harness start failed");
    }

    const message = userMessage("user-start", input.prompt, input.attachments ?? []);
    const transcript = options.transcriptDropsAttachments
      ? [
          transcriptUserMessage(
            "user-start-transcript",
            promptWithSyntheticManifest(input.prompt, input.attachments ?? []),
          ),
        ]
      : [message];

    sessions.set("agent-start", transcript);
    input.events.push({ op: "add", path: "/messages/0", value: message });
    return completer.completeSession("agent-start");
  });
  const resume = mock((_ctx: unknown, input: HarnessResumeInput) => {
    if (options.resumeThrows) {
      throw new Error("harness resume failed");
    }

    const existing = sessions.get(input.agentSessionId) ?? [];
    const message = userMessage("user-resume", input.prompt, input.attachments ?? []);
    const transcriptMessage = options.transcriptDropsAttachments
      ? transcriptUserMessage(
          "user-resume-transcript",
          promptWithSyntheticManifest(input.prompt, input.attachments ?? []),
        )
      : message;

    sessions.set(input.agentSessionId, [...existing, transcriptMessage]);
    input.events.push({
      op: "add",
      path: `/messages/${input.messageOffset ?? 0}`,
      value: message,
    });
    return completer.completeSession(input.agentSessionId);
  });

  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("fake", {
      provider: {
        start,
        resume,
        getMessages: (_ctx, input) => sessions.get(input.agentSessionId) ?? [],
      },
    }),
  ]);

  return {
    completeAll: completer.completeAll,
    releaseHarnessResolution: harnessResolution.resolve,
    start,
    resume,
    registry: {
      ...registry,
      get: async (...args: Parameters<typeof registry.get>) => {
        const shouldDelay =
          options.delayHarnessResolutionAfterGets !== undefined &&
          harnessGetCount >= options.delayHarnessResolutionAfterGets;
        harnessGetCount += 1;

        if (shouldDelay) {
          await harnessResolution.promise;
        }
        return registry.get(...args);
      },
    },
  };
};

export const createIsolatedApp = async (harnessOptions?: Parameters<typeof createAttachmentHarness>[0]) => {
  const tempRoot = join(tmpdir(), `pstdio-session-attachments-test-${crypto.randomUUID()}`);
  tempRoots.push(tempRoot);
  const harness = createAttachmentHarness(harnessOptions);
  const appHandle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    harnessRegistry: harness.registry,
  });

  return { ...appHandle, harness };
};

export const createProject = async (app: Awaited<ReturnType<typeof createIsolatedApp>>["app"], name: string) => {
  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string };
};

export const uploadAttachment = async (
  app: Awaited<ReturnType<typeof createIsolatedApp>>["app"],
  projectId: string,
  input: { name: string; content: string; type: string },
) => {
  const res = await app.request(`/v1/projects/${projectId}/session-attachments`, {
    method: "POST",
    headers: {
      "content-type": input.type,
      "x-file-name": encodeURIComponent(input.name),
    },
    body: input.content,
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { file_id: string; name: string; mime_type: string | null; size_bytes: number };
};

export const waitForSessionStatus = async (
  app: Awaited<ReturnType<typeof createIsolatedApp>>["app"],
  sessionId: string,
  status: string,
) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await app.request(`/v1/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    const session = (await res.json()) as { status: string };
    if (session.status === status) return;
    await Bun.sleep(20);
  }

  throw new Error(`Session ${sessionId} did not reach ${status}`);
};

export const waitForCompleted = async (app: Awaited<ReturnType<typeof createIsolatedApp>>["app"], sessionId: string) =>
  waitForSessionStatus(app, sessionId, "completed");

export const cleanupSessionAttachmentTestRoots = () => {
  for (const tempRoot of tempRoots) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
};
