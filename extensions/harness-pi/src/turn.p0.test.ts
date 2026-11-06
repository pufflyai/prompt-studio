import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import { startPiTurn } from "./turn";

test("a long Pi turn publishes only changes, including an earlier tool result and prompt attachments", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-incremental-"));
  try {
    const script = join(root, "provider.ts");
    await Bun.write(
      script,
      `
      const emit = value => console.log(JSON.stringify(value));
      const message = message => { emit({type:"message_start",message}); emit({type:"message_end",message}); };
      emit({type:"session",id:"native"});
      message({role:"user",content:"Native prompt"});
      message({role:"assistant",content:[{type:"toolCall",id:"call",name:"read",arguments:{path:"file"}}]});
      for (let index=0; index<500; index++) message({role:"assistant",content:"message "+index});
      message({role:"toolResult",toolCallId:"call",content:"done"});
    `,
    );
    const messages: SessionMessage[] = [];
    const patches: JsonPatch[] = [];
    const events = {
      getMessages: () => messages,
      push(patch: JsonPatch) {
        patches.push(patch);
        const index = Number(patch.path.split("/").at(-1));
        if (patch.op === "remove") messages.splice(index, 1);
        else if (patch.op === "add") messages.splice(index, 0, patch.value as SessionMessage);
        else messages[index] = patch.value as SessionMessage;
      },
    };
    const turn = startPiTurn(
      {
        prompt: "Read the file",
        sessionId: "host",
        cwd: root,
        events,
        attachments: [
          {
            fileId: "file",
            fileName: "file.txt",
            mimeType: "text/plain",
            localPath: join(root, "file.txt"),
            url: "/file",
            sizeBytes: 1,
          },
        ],
      },
      { command: [process.execPath, script] },
    );
    await turn.session;
    expect(await turn.done).toEqual({ status: "completed" });
    expect(messages).toHaveLength(502);
    expect(messages[0].parts).toContainEqual(expect.objectContaining({ type: "file", fileId: "file" }));
    expect(messages[1].parts[0]).toMatchObject({ type: "tool", status: "completed", state: { output: "done" } });
    expect(patches.every((patch) => patch.path !== "/messages")).toBe(true);
    expect(patches.at(-1)?.path).toBe("/messages/1");
    expect(Buffer.byteLength(JSON.stringify(patches))).toBeLessThan(500000);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
