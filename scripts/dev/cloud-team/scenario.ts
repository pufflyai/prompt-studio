import { strict as assert } from "node:assert";
import { appendFile } from "node:fs/promises";
import type { AccountStatus, ManagedExtension, ProjectSyncStatus, TeamExtensionPolicy } from "pstdio-api-contracts";
import { api, control, exec, request } from "./infra";
import { pause, until } from "./process";
import type { Actor, Extension, Pair } from "./types";

export const evidence = async (pair: Pair, step: string, value: unknown = {}) => {
  console.log(step);
  await appendFile(
    `${pair.directory}/results.jsonl`,
    `${JSON.stringify({ at: new Date().toISOString(), step, ...Object(value) })}\n`,
  );
};
const membership = <T>(pair: Pair, actor: Actor, body: unknown, read = false) =>
  api<T>(pair, actor, `/v1/account/team-membership/${read ? "read" : "write"}`, { request: body });
const status = (pair: Pair, actor: Actor) => api<AccountStatus>(pair, actor, "/v1/account");
const extensions = async (pair: Pair, actor: Actor) =>
  (await api<{ extensions: Extension[] }>(pair, actor, `/v1/projects/${pair.projectId}/extensions`)).extensions;
const probe = async (pair: Pair, actor: Actor) =>
  (await extensions(pair, actor)).find((ext) => ext.extensionId === "example.team-probe");
const runCommand = async <T>(pair: Pair, actor: Actor, id: string, params = {}) => {
  const response = await api<{ outcome: { ok: boolean; value: T; error?: unknown } }>(
    pair,
    actor,
    `/v1/projects/${pair.projectId}/extensions/commands/example.team-probe.command.${id}/execute`,
    { params },
  );
  assert.equal(response.outcome.ok, true, JSON.stringify(response.outcome));
  return response.outcome.value;
};
const team = (pair: Pair) => ({ accountId: pair.teamId! });
const denied = async (
  pair: Pair,
  actor: Actor,
  path: string,
  body?: unknown,
  method?: string,
  expectedError?: string,
) => {
  const response = await request(pair, actor, path, body, method);
  assert.ok([400, 401, 403, 409].includes(response.status), `${path} must be denied, got ${response.status}`);
  if (expectedError)
    assert.ok(
      JSON.stringify(response.body).includes(expectedError),
      `${path}: wrong denial ${JSON.stringify(response.body)}`,
    );
  await evidence(pair, "denied", { path, status: response.status });
};
const createProject = async (pair: Pair, name: string) => {
  const path = `/workspace/cloud-team/project-${crypto.randomUUID()}`;
  await exec(pair, pair.owner!, [
    "bun",
    "-e",
    'await(await import("node:fs/promises")).mkdir(process.argv[1],{recursive:true})',
    path,
  ]);
  return api<{ id: string }>(pair, pair.owner!, "/v1/projects", {
    name,
    teamAccountId: pair.teamId,
    initial_workspace: { provider_id: "pstdio.root", params: { path } },
  });
};
export const setup = async (pair: Pair, save: () => Promise<void>) => {
  for (const [role, actor] of [
    ["owner", pair.owner!],
    ["member", pair.member!],
  ] as const) {
    const attempt = await api<{ id: string; url: string }>(pair, actor, "/v1/account/login", {
      managerOrigin: `https://${pair.name}-apps.${pair.namespace}.svc.cluster.local:8443`,
      provider: "microsoft",
    });
    const completed = await control<{ callback: string }>(pair, "/sign-in", { url: attempt.url, role });
    await exec(pair, actor, ["bun", "/workspace/repo/scripts/dev/cloud-team/actor.ts"], JSON.stringify(completed));
    const login = await until(`${role} signed in`, async () => {
      const value = await status(pair, actor);
      return value.login ? value : undefined;
    });
    await control(pair, "/grant-relay", { accountId: login.login!.accountId });
    await evidence(pair, `${role} signed in`, { accountId: login.login!.accountId, deviceId: login.login!.deviceId });
  }
  const a = await status(pair, pair.owner!);
  const b = await status(pair, pair.member!);
  assert.ok(a.login);
  assert.ok(b.login);
  assert.notEqual(a.login.accountId, b.login.accountId);
  assert.notEqual(a.login.deviceId, b.login.deviceId);
  pair.memberUserId = b.login.accountId;
  const created = await api<{ accountId: string }>(pair, pair.owner!, "/v1/account/teams", {
    name: `Cloud test ${pair.id}`,
  });
  pair.teamId = created.accountId;
  await save();
  await control(pair, "/grant-relay", { accountId: pair.teamId });
  const invite = await membership<{ code: string }>(pair, pair.owner!, { op: "inviteCode", ...team(pair) });
  await membership(pair, pair.member!, { op: "acceptInviteCode", code: invite.code });
  assert.equal((await membership<unknown[]>(pair, pair.owner!, { op: "members", ...team(pair) }, true)).length, 2);
  await prepareProjects(pair, save);
};
export const prepareProjects = async (pair: Pair, save: () => Promise<void>) => {
  pair.projectId = (await createProject(pair, "Shared team project")).id;
  pair.hiddenProjectId = (await createProject(pair, "Owner-only project")).id;
  await save();
  const before = await membership<{ workbenchId: string }[]>(
    pair,
    pair.member!,
    { op: "projectAccess", ...team(pair) },
    true,
  );
  assert.ok(!before.some((p) => p.workbenchId === pair.projectId), "Joining alone must not grant project access");
  await membership(pair, pair.owner!, {
    op: "setProjectAccess",
    ...team(pair),
    workbenchId: pair.projectId,
    userId: pair.memberUserId,
    granted: true,
  });
  await until(
    "member discovers granted team project",
    async () => (await status(pair, pair.member!)).teamProjects?.[pair.projectId!] === pair.teamId,
  );
  await api(pair, pair.member!, `/v1/account/projects/${pair.projectId}/download`, {}, "POST");
  await until("member downloads shared project", async () => {
    const sync = await api<ProjectSyncStatus>(pair, pair.member!, `/v1/account/projects/${pair.projectId}/sync`);
    return sync.offlineReady;
  });
  assert.equal((await status(pair, pair.member!)).teamProjects?.[pair.hiddenProjectId!], undefined);
  await evidence(pair, "invitation accepted; only granted project discovered");
  const installed = await api<{ instanceId: string }>(
    pair,
    pair.owner!,
    `/v1/projects/${pair.projectId}/extensions/installed/team-probe/enable`,
    {
      displayName: "Team probe",
      extensionId: "example.team-probe",
      name: "team-probe",
      manifest: { name: "team-probe" },
      sourceKind: "local_path",
      sourcePath: "/workspace/cloud-team/probe",
      version: "1.0.0",
    },
  );
  pair.required = await membership<ManagedExtension>(pair, pair.owner!, {
    op: "manageExtension",
    ...team(pair),
    projectId: pair.projectId,
    instanceId: installed.instanceId,
    expectedSelection: null,
  });
  await save();
  await api(pair, pair.member!, `/v1/account/projects/${pair.projectId}/retry`, {});
  await until("managed extension installed on second workspace", async () => {
    const ext = await probe(pair, pair.member!);
    return ext?.enabled && ext.status === "loaded" && ext;
  });
  await evidence(pair, "managed extension automatically installed on member");
  await exchange(pair);
};
const exchange = async (pair: Pair) => {
  const forward = `owner-${crypto.randomUUID()}`;
  await runCommand(pair, pair.owner!, "write", { value: forward });
  await until(
    "owner data reaches member",
    async () => (await runCommand<{ text: string }>(pair, pair.member!, "read"))?.text === forward,
  );
  const backward = `member-${crypto.randomUUID()}`;
  await runCommand(pair, pair.member!, "write", { value: backward });
  await until(
    "member data reaches owner",
    async () => (await runCommand<{ text: string }>(pair, pair.owner!, "read"))?.text === backward,
  );
  await evidence(pair, "bidirectional shared record sync passed", { forward, backward });
};
export const verify = async (pair: Pair) => {
  assert.ok(pair.required && pair.projectId && pair.teamId, "Run up first");
  const member = pair.member!;
  const owner = pair.owner!;
  const ext = await probe(pair, member);
  assert.ok(ext?.enabled);
  assert.equal(ext.choiceRestriction, "team-managed");
  await denied(
    pair,
    member,
    `/v1/projects/${pair.projectId}/extensions/${ext.id}`,
    { enabled: false },
    "PATCH",
    "managed by your team owner",
  );
  await denied(
    pair,
    member,
    `/v1/projects/${pair.projectId}/extensions/${ext.id}`,
    undefined,
    "DELETE",
    "managed by your team owner",
  );
  await denied(
    pair,
    member,
    "/v1/account/team-membership/write",
    {
      request: {
        op: "unmanageExtension",
        ...team(pair),
        extensionId: pair.required.extensionId,
        expectedSelection: pair.required.selectionId,
      },
    },
    "POST",
    "This team action is unavailable to the signed-in account",
  );
  await denied(
    pair,
    member,
    "/v1/account/team-membership/write",
    { request: { op: "inviteCode", ...team(pair) } },
    "POST",
    "This team action is unavailable to the signed-in account",
  );
  await denied(pair, member, `/v1/account/projects/${pair.hiddenProjectId}/download`, {}, "POST");
  await exchange(pair);
  const released = await membership<{ ok: true }>(pair, owner, {
    op: "unmanageExtension",
    ...team(pair),
    extensionId: pair.required.extensionId,
    expectedSelection: pair.required.selectionId,
  });
  assert.deepEqual(released, { ok: true });
  const policy = await membership<TeamExtensionPolicy[]>(pair, owner, { op: "extensionPolicy", ...team(pair) }, true);
  const decision = policy.find((row) => row.extensionId === pair.required!.extensionId);
  assert.ok(decision);
  assert.equal(decision.required, null);
  assert.notEqual(decision.selectionId, pair.required.selectionId);
  await api(pair, member, `/v1/account/projects/${pair.projectId}/retry`, {});
  await until("released extension remains installed and controls return", async () => {
    const current = await probe(pair, member);
    return current?.enabled && !current.choiceRestriction && current;
  });
  await api(pair, member, `/v1/projects/${pair.projectId}/extensions/${ext.id}`, { enabled: false }, "PATCH");
  await api(pair, member, `/v1/projects/${pair.projectId}/extensions/${ext.id}`, { enabled: true }, "PATCH");
  await evidence(pair, "owner released policy; member disable/re-enable works");
  const before = await runCommand<{ text: string }>(pair, member, "read");
  await membership(pair, owner, { op: "removeMember", ...team(pair), userId: pair.memberUserId });
  await api(pair, member, `/v1/account/projects/${pair.projectId}/retry`, {}).catch(() => {});
  await until(
    "member loses cloud membership",
    async () => (await status(pair, member)).teamProjects?.[pair.projectId!] !== pair.teamId,
  );
  // Access JWT lifetime is 30 seconds. Observe after that cutover, not immediately after the button press.
  await pause(35_000);
  const after = `after-revocation-${crypto.randomUUID()}`;
  await runCommand(pair, owner, "write", { value: after });
  await until("owner uploads future edit after revocation", async () => {
    const sync = await api<ProjectSyncStatus>(pair, owner, `/v1/account/projects/${pair.projectId}/sync`);
    return sync.state === "synced" && sync.pendingItems === 0;
  });
  const retained = await runCommand<{ text: string }>(pair, member, "read");
  assert.deepEqual(retained, before, "Removed member received a future shared edit");
  assert.equal((await runCommand<{ text: string }>(pair, owner, "read")).text, after);
  await denied(pair, member, "/v1/account/team-membership/read", { request: { op: "members", ...team(pair) } });
  await denied(pair, member, `/v1/account/projects/${pair.projectId}/download`, {}, "POST");
  await evidence(pair, "revocation cutover passed; owner remains usable; member retains only old local copy");
};
