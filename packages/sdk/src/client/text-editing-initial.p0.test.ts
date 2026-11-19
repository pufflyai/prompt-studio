import { expect, test } from "bun:test";
import type { TextEditingOpened } from "pstdio-api-contracts/extension-kernel";
import type { RequestFn } from "./request";
import { createTextTransportClient, type TextEditingConnection } from "./text-editing";
import { createTextGuestMembers } from "./text-editing-members";

const memberId = "admitted";
const receipt = (handle: string): TextEditingOpened => ({
  handle,
  grant: { token: "selected" },
  sourceIdentity: "history",
  snapshot: { state: "", revision: 1, editable: true, seedId: "history", sourceSeedId: "history" },
});

test("an abandoned initial receipt cannot reopen its old handle", async () => {
  const calls: string[] = [];
  const request: RequestFn = async (path, options) => {
    const operation = (options?.body as { request?: { operation: string } })?.request?.operation;
    calls.push(operation ?? path.split("/").at(-1)!);
    if (path.endsWith("/open")) return { ok: true, value: { token: "lease", opened: receipt("old") } } as never;
    return { ok: true, value: operation === "openSelected" ? receipt("replacement") : undefined } as never;
  };
  const connection = await createTextTransportClient(request, {} as never).connect({
    projectId: "project",
    scope: { kind: "placement", viewId: "editor" },
    initial: { memberId, active: true },
  });
  await connection.request({ operation: "abandon", memberId });
  expect((await connection.request({ operation: "openSelected", memberId })).handle).toBe("replacement");
  expect(calls).toEqual(["open", "abandon", "openSelected"]);
});

test("a late guest admission cannot restore an abandoned member", async () => {
  const arrived = Promise.withResolvers<TextEditingOpened>();
  const members = createTextGuestMembers(
    {
      request: (input) => (input.operation === "openSelected" ? arrived.promise : Promise.resolve()),
    } as TextEditingConnection,
    () => 0,
  );
  const opening = members.request({ operation: "openSelected", memberId });
  await members.request({ operation: "abandon", memberId });
  arrived.resolve(receipt("old"));
  await expect(opening).rejects.toMatchObject({ code: "session_closed" });
  expect([...members.entries()]).toEqual([]);
});
