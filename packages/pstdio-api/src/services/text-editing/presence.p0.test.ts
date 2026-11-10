import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { nativePresenceLimits } from "pstdio-api-contracts";
import type { TextEditingEvent } from "pstdio-api-contracts/extension-kernel";
import * as Y from "yjs";
import { selected, textEditingFixture } from "./text-editing.test-fixture";

const until = async (condition: () => boolean) => {
  const end = Date.now() + 1000;
  while (!condition() && Date.now() < end) await Bun.sleep(1);
  expect(condition()).toBe(true);
};
const openPlacement = async (f: Awaited<ReturnType<typeof textEditingFixture>>, target = selected) => {
  const address = {
    projectId: "project-1",
    token: (await f.text.connect("project-1", { kind: "placement", target })).token,
  };
  const events: TextEditingEvent[] = [];
  const stop = f.text.listen(address, (event) => events.push(event));
  const grant = await f.text.request(address, { operation: "current" });
  const memberId = crypto.randomUUID();
  await f.text.request(address, { operation: "register", memberId });
  const opened = await f.text.request(address, { operation: "open", memberId, input: { grant: grant! } });
  return { address, events, stop, opened };
};

test("durable text updates continue when optional presence rooms are full", async () => {
  const f = await textEditingFixture();
  const occupied: Awaited<ReturnType<typeof f.documents.presence.join>>[] = [];
  let placement: Awaited<ReturnType<typeof openPlacement>> | undefined;
  try {
    await writeFile(
      join(f.root, "extension.ts"),
      `export default {views:[{id:"document",ref:{kind:"view",id:"document"},title:"Document",body:{kind:"file",load:async(ctx,{renderer})=>{const path="capacity-"+renderer.pageParams.index+".md";return {documentSource:{kind:"workspace",path},content:await ctx.workspaceFiles.readText(path),fileName:path};},save:async(ctx,{renderer,content})=>ctx.workspaceFiles.writeText("capacity-"+renderer.pageParams.index+".md",content)}}]};`,
    );
    f.deps.extensionRuntimeCatalog.invalidate({ projectId: "project-1", reason: "enablement_changed" });
    for (let index = 0; index <= nativePresenceLimits.rooms; index++) {
      await writeFile(join(f.root, `capacity-${index}.md`), `source ${index}`);
      if (index === nativePresenceLimits.rooms) break;
      const room = await f.documents.open({
        ...selected,
        projectId: "project-1",
        pageParams: { index: String(index) },
      });
      occupied.push(await f.documents.presence.join({ ...room, projectId: "project-1" }));
    }
    const target = { ...selected, pageParams: { index: String(nativePresenceLimits.rooms) } };
    placement = await openPlacement(f, target);
    await until(() => placement!.events.some((event) => event.type === "snapshot"));
    const peer = await f.documents.open({ ...target, projectId: "project-1" });
    const author = new Y.Doc();
    try {
      Y.applyUpdate(author, peer.state);
      const before = Y.encodeStateVector(author);
      author.getText("content").insert(0, "Peer edit ");
      await f.documents.submit({
        projectId: "project-1",
        roomId: peer.roomId,
        update: Y.encodeStateAsUpdate(author, before),
      });
      await until(() =>
        placement!.events.some(
          (event) => event.type === "snapshot" && event.snapshot.revision !== placement!.opened.snapshot.revision,
        ),
      );
      expect(placement.events.filter((event) => event.type === "error")).toEqual([]);
    } finally {
      author.destroy();
    }
  } finally {
    placement?.stop();
    for (const connection of occupied) connection.close();
    await f.cleanup();
  }
});

test("presence excludes its own editor and hides selections from incompatible histories", async () => {
  const f = await textEditingFixture();
  let placement: Awaited<ReturnType<typeof openPlacement>> | undefined;
  try {
    await writeFile(join(f.root, "native"), "");
    placement = await openPlacement(f);
    await until(() => placement!.events.some((event) => event.type === "presence"));
    const participants = () => placement!.events.filter((event) => event.type === "presence").at(-1)!.participants;
    expect(participants()).toEqual([]);
    const documentKey = JSON.parse(
      f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })[0]!,
    )[1];
    const participantId = crypto.randomUUID();
    const selection = { anchor: "AA==", head: "AQ==" };
    const frame = {
      kind: "native-document-presence",
      version: 1,
      action: "upsert",
      extensionId: "example.context",
      documentKey,
      participantId,
      label: "Peer",
      deviceName: "Laptop",
      selection,
    };
    f.documents.live.receive("project-1", "other-device", { ...frame, seedId: "c".repeat(64) });
    expect(participants()).toEqual([
      { id: participantId, deviceId: "other-device", label: "Peer", deviceName: "Laptop", selection: null },
    ]);
    f.documents.live.receive("project-1", "other-device", { ...frame, seedId: placement.opened.snapshot.seedId });
    expect(participants()).toEqual([
      { id: participantId, deviceId: "other-device", label: "Peer", deviceName: "Laptop", selection },
    ]);
    const secondParticipantId = crypto.randomUUID();
    f.documents.live.receive("project-1", "other-device", {
      ...frame,
      participantId: secondParticipantId,
      seedId: placement.opened.snapshot.seedId,
    });
    expect(participants().map((person) => person.id)).toEqual([participantId, secondParticipantId]);
    f.documents.live.receive("project-1", "other-device", {
      kind: frame.kind,
      version: 1,
      action: "leave",
      extensionId: frame.extensionId,
      documentKey,
      participantId: secondParticipantId,
    });
    f.documents.live.receive("project-1", "other-device", {
      kind: frame.kind,
      version: 1,
      action: "leave",
      extensionId: frame.extensionId,
      documentKey,
      participantId,
    });
    expect(participants()).toEqual([]);
  } finally {
    placement?.stop();
    await f.cleanup();
  }
});
