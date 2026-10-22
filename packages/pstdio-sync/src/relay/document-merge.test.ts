import { expect, spyOn, test } from "bun:test";
import * as Y from "yjs";
import { missingUpdate } from "./document-merge";

test("unchanged comparison reuses a deletion-aware result until either document changes", () => {
  const local = new Y.Doc();
  const remote = new Y.Doc();
  local.getMap("values").set("note", "saved");
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(local));
  const encode = spyOn(Y, "encodeStateAsUpdate");
  try {
    expect(missingUpdate(local, remote)).toBeNull();
    const calls = encode.mock.calls.length;
    for (let index = 0; index < 10; index++) expect(missingUpdate(local, remote)).toBeNull();
    expect(encode.mock.calls.length).toBe(calls);
    local.getMap("values").delete("note");
    const deletion = missingUpdate(local, remote);
    expect(deletion).not.toBeNull();
    Y.applyUpdate(remote, deletion!);
    expect(remote.getMap("values").has("note")).toBe(false);
    expect(missingUpdate(local, remote)).toBeNull();
    local.getMap("values").set("new", 1);
    expect(missingUpdate(local, remote)).not.toBeNull();
  } finally {
    encode.mockRestore();
    local.destroy();
    remote.destroy();
  }
});
