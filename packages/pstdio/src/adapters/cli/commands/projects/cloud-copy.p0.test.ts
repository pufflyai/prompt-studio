import { expect, mock, test } from "bun:test";
import type { CloudProjectDeletion, LocalRemovalPreflight } from "@pstdio/sdk/client";
import type { Arguments } from "yargs";
import { createProjectCloudCommands } from "./cloud-copy";

const args = <T>(values: T) => ({ $0: "pstdio", _: [], ...values }) as Arguments<T>;
const projectId = "project-x";
const preflight: LocalRemovalPreflight = {
  projectId,
  name: "Shared notes",
  uploadState: "pending",
  requiresDiscard: true,
  removesManagedFolder: true,
  providerWorkspaceCount: 1,
};
const deletion: CloudProjectDeletion = {
  projectId,
  operationId: "operation-x",
  state: "deleting",
  startedAt: "2026-11-18T10:30:00Z",
  completedAt: null,
};

const account = { accountId: "team-x", managerOrigin: "https://manager.example" };
const login = {
  accountId: "account-x",
  managerOrigin: account.managerOrigin,
  relayOrigin: account.managerOrigin,
  deviceId: "device-x",
};

const fixture = (signedOut = false) => {
  const device = mock(async () => (signedOut ? null : login));
  const output = mock((_value: unknown) => {});
  const scope = mock((_message: string) => {});
  const catalog = mock(async () => ({
    projects: [],
    deletions: [{ ...deletion, name: preflight.name }],
    account: signedOut ? undefined : account,
  }));
  const inspect = mock(async () => preflight);
  const remove = mock(async () => ({ projectId, presence: "cloud-only" as const }));
  const download = mock(async () => ({ projectId, presence: "downloading" as const }));
  const erase = mock(async () => {
    expect(scope).toHaveBeenCalledWith(expect.stringContaining("Permanently delete"));
    return deletion;
  });
  const status = mock(
    async (): Promise<CloudProjectDeletion> => ({
      ...deletion,
      state: "completed",
      completedAt: "2026-11-18T10:32:00Z",
    }),
  );
  const commands = createProjectCloudCommands({
    device,
    output,
    scope,
    catalog,
    inspect,
    remove,
    download,
    erase,
    status,
  });
  return { device, output, scope, catalog, inspect, remove, download, erase, status, commands };
};

test("delete-local requires acknowledgement before submitting unverified removal", async () => {
  const { commands, inspect, remove, scope, output } = fixture();
  await expect(commands.remove.handler(args({ "project-id": projectId }))).rejects.toThrow("--discard-unsynced");
  expect(remove).not.toHaveBeenCalled();
  await commands.remove.handler(args({ "project-id": projectId, "discard-unsynced": true }));
  expect(scope).toHaveBeenCalledWith(expect.stringContaining("this device"));
  expect(inspect).toHaveBeenCalledWith(projectId, login);
  expect(remove).toHaveBeenCalledWith(projectId, { discardUnsynced: true, expectedDevice: login });
  expect(output).toHaveBeenCalledWith({ projectId, presence: "cloud-only" });
});

test("delete-cloud prints the affected scope and submits only with explicit confirmation", async () => {
  const { commands, erase, catalog, output } = fixture();
  await expect(commands.erase.handler(args({ "project-id": projectId }))).rejects.toThrow("--confirm");
  expect(catalog).not.toHaveBeenCalled();
  expect(erase).not.toHaveBeenCalled();
  await commands.erase.handler(args({ "project-id": projectId, confirm: true }));
  expect(catalog).toHaveBeenCalledWith(undefined, login);
  expect(erase).toHaveBeenCalledWith(projectId, { confirm: true, expectedAccount: account, expectedDevice: login });
  expect(output).toHaveBeenCalledWith(deletion);
});

test("download and deletion-status print their operation state", async () => {
  const { commands, download, status, output } = fixture();
  await commands.download.handler(args({ "project-id": projectId }));
  expect(download).toHaveBeenCalledWith(projectId);
  expect(output).toHaveBeenCalledWith({ projectId, presence: "downloading" });
  await commands.status.handler(args({ "project-id": projectId }));
  expect(status).toHaveBeenCalledWith(projectId);
  expect(output).toHaveBeenCalledWith(
    expect.objectContaining({ operationId: deletion.operationId, state: "completed" }),
  );
});

test("delete-cloud cannot carry a signed-out confirmation into a later account login", async () => {
  const { commands, erase, output } = fixture(true);
  await expect(commands.erase.handler(args({ "project-id": projectId, confirm: true }))).rejects.toThrow("Sign in");
  expect(erase).not.toHaveBeenCalled();
  expect(output).not.toHaveBeenCalled();
});

test("delete-cloud pins the account even when replaying a deletion absent from the catalog", async () => {
  const { commands, catalog, erase } = fixture();
  catalog.mockResolvedValueOnce({ projects: [], deletions: [], account });
  await commands.erase.handler(args({ "project-id": projectId, confirm: true }));
  expect(erase).toHaveBeenCalledWith(projectId, { confirm: true, expectedAccount: account, expectedDevice: login });
});
