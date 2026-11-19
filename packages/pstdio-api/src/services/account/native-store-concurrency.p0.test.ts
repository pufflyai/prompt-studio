import { expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate as nextTurn } from "node:timers/promises";
import { createNativeStore } from "./native-store";
import * as privateFiles from "./private-file";

const login = {
  managerOrigin: "https://manager.test",
  relayOrigin: "https://relay.test",
  accountId: "account",
  deviceId: "device",
  token: "first-credential",
};
const newer = { ...login, token: "newer-credential" };

test.each(["login", "sign-in requirement"])("saving credentials waits for an admitted %s read", async (kind) => {
  const root = await mkdtemp(join(tmpdir(), "native-account-read-owner-"));
  const file = join(root, "native-account.json");
  const store = createNativeStore(file);
  const writer = createNativeStore(file);
  const gate = Promise.withResolvers<void>();
  const pending: Promise<unknown>[] = [];
  const restore: (() => void)[] = [];
  const readPrivateFile = privateFiles.readPrivateFile;
  const writePrivateFile = privateFiles.writePrivateFile;
  let holdNextRead = true;
  let activeRead = false;

  const controlledRead: typeof privateFiles.readPrivateFile = async (path, schema, empty) => {
    if (path !== file || !holdNextRead) return readPrivateFile(path, schema, empty);
    holdNextRead = false;
    activeRead = true;
    try {
      await gate.promise;
      return await readPrivateFile(path, schema, empty);
    } finally {
      activeRead = false;
    }
  };
  const controlledWrite: typeof privateFiles.writePrivateFile = async (path, value) => {
    // Model the observed platform refusal without claiming which real handle caused it.
    if (path === file && activeRead)
      throw Object.assign(new Error("Credential replacement crossed an active credential read"), { code: "EPERM" });
    await writePrivateFile(path, value);
  };
  try {
    await store.save(login);
    const read = spyOn(privateFiles, "readPrivateFile").mockImplementation(controlledRead);
    restore.push(() => read.mockRestore());
    const write = spyOn(privateFiles, "writePrivateFile").mockImplementation(controlledWrite);
    restore.push(() => write.mockRestore());
    const reading = kind === "login" ? store.read() : store.signInRequired(login.deviceId);
    pending.push(reading);
    await nextTurn();
    expect(activeRead).toBe(true);

    const saving = writer.save(newer).then(
      () => ({ error: null }),
      (error: unknown) => ({ error }),
    );
    pending.push(saving);
    await nextTurn();
    gate.resolve();
    expect(await reading).toEqual(kind === "login" ? login : false);
    expect((await saving).error).toBeNull();
    expect(await store.read()).toEqual(newer);
  } finally {
    gate.resolve();
    await Promise.allSettled(pending);
    for (const release of restore.reverse()) release();
    await rm(root, { recursive: true, force: true });
  }
});

test("a credential read admitted after a pending replacement observes the newer login", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-write-owner-"));
  const file = join(root, "native-account.json");
  const store = createNativeStore(file);
  const observer = createNativeStore(file);
  const gate = Promise.withResolvers<void>();
  const pending: Promise<unknown>[] = [];
  const restore: (() => void)[] = [];
  const readPrivateFile = privateFiles.readPrivateFile;
  const writePrivateFile = privateFiles.writePrivateFile;
  let holdNextWrite = true;
  let activeWrite = false;
  let readCrossedWrite = false;

  const controlledWrite: typeof privateFiles.writePrivateFile = async (path, value) => {
    if (path !== file || !holdNextWrite) return writePrivateFile(path, value);
    holdNextWrite = false;
    activeWrite = true;
    try {
      await gate.promise;
      await writePrivateFile(path, value);
    } finally {
      activeWrite = false;
    }
  };
  const controlledRead: typeof privateFiles.readPrivateFile = async (path, schema, empty) => {
    if (path === file && activeWrite) readCrossedWrite = true;
    return readPrivateFile(path, schema, empty);
  };
  try {
    await store.save(login);
    const read = spyOn(privateFiles, "readPrivateFile").mockImplementation(controlledRead);
    restore.push(() => read.mockRestore());
    const write = spyOn(privateFiles, "writePrivateFile").mockImplementation(controlledWrite);
    restore.push(() => write.mockRestore());
    const saving = store.save(newer);
    pending.push(saving);
    await nextTurn();
    expect(activeWrite).toBe(true);
    const reading = observer.read();
    pending.push(reading);
    await nextTurn();
    gate.resolve();
    await saving;
    const observed = await reading;
    expect(readCrossedWrite).toBe(false);
    expect(observed).toEqual(newer);
  } finally {
    gate.resolve();
    await Promise.allSettled(pending);
    for (const release of restore.reverse()) release();
    await rm(root, { recursive: true, force: true });
  }
});

test("an admitted credential read leaves another native account file independent", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-path-owners-"));
  const firstFile = join(root, "first.json");
  const secondFile = join(root, "second.json");
  const first = createNativeStore(firstFile);
  const second = createNativeStore(secondFile);
  const gate = Promise.withResolvers<void>();
  const pending: Promise<unknown>[] = [];
  const restore: (() => void)[] = [];
  const readPrivateFile = privateFiles.readPrivateFile;
  const writePrivateFile = privateFiles.writePrivateFile;
  let holdNextRead = true;
  let activeRead = false;
  let secondWriteAdmitted = false;

  const controlledRead: typeof privateFiles.readPrivateFile = async (path, schema, empty) => {
    if (path !== firstFile || !holdNextRead) return readPrivateFile(path, schema, empty);
    holdNextRead = false;
    activeRead = true;
    try {
      await gate.promise;
      return await readPrivateFile(path, schema, empty);
    } finally {
      activeRead = false;
    }
  };
  const controlledWrite: typeof privateFiles.writePrivateFile = async (path, value) => {
    if (path === secondFile) secondWriteAdmitted = true;
    await writePrivateFile(path, value);
  };
  try {
    await first.save(login);
    const read = spyOn(privateFiles, "readPrivateFile").mockImplementation(controlledRead);
    restore.push(() => read.mockRestore());
    const write = spyOn(privateFiles, "writePrivateFile").mockImplementation(controlledWrite);
    restore.push(() => write.mockRestore());
    const reading = first.read();
    pending.push(reading);
    await nextTurn();
    expect(activeRead).toBe(true);
    const saving = second.save(newer).then(
      () => ({ error: null }),
      (error: unknown) => ({ error }),
    );
    pending.push(saving);
    await nextTurn();
    expect(secondWriteAdmitted).toBe(true);
    expect(activeRead).toBe(true);
    gate.resolve();
    expect((await saving).error).toBeNull();
    expect(await second.read()).toEqual(newer);
    expect(await reading).toEqual(login);
  } finally {
    gate.resolve();
    await Promise.allSettled(pending);
    for (const release of restore.reverse()) release();
    await rm(root, { recursive: true, force: true });
  }
});

test("a rejected credential read does not retain ownership over a later save", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-read-failure-"));
  const file = join(root, "native-account.json");
  const store = createNativeStore(file);
  const readPrivateFile = privateFiles.readPrivateFile;
  const restore: (() => void)[] = [];
  let failNextRead = true;

  const controlledRead: typeof privateFiles.readPrivateFile = async (path, schema, empty) => {
    if (path === file && failNextRead) {
      failNextRead = false;
      throw new Error("Credential read interrupted");
    }
    return readPrivateFile(path, schema, empty);
  };
  try {
    await store.save(login);
    const read = spyOn(privateFiles, "readPrivateFile").mockImplementation(controlledRead);
    restore.push(() => read.mockRestore());
    await expect(store.read()).rejects.toThrow("Credential read interrupted");
    await store.save(newer);
    expect(await store.read()).toEqual(newer);
  } finally {
    for (const release of restore.reverse()) release();
    await rm(root, { recursive: true, force: true });
  }
});
