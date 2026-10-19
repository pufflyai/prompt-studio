import { dirname, join } from "node:path";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { RouteDeps } from "../../features/deps";
import type { RelayWorkbench } from "../relay/config";
import { ManagerRequestDenied, managerOriginSchema, managerRequest } from "./manager-client";
import { startNativeLogin } from "./native-login";
import { assertSameOwner, createNativeStore } from "./native-store";
import { readPrivateFile, serializeNativeWrite, writePrivateFile } from "./private-file";

const intentSchema = z.object({
  requestId: identitySchema,
  accountId: identitySchema,
  workbenchId: identitySchema,
  environmentId: identitySchema,
  managerOrigin: managerOriginSchema,
  expiresAt: z.iso.datetime(),
  replacesId: identitySchema.optional(),
});
const stateSchema = z.strictObject({
  sessions: z.array(z.strictObject({ managerOrigin: managerOriginSchema, token: z.string().min(1) })),
  pending: z.array(intentSchema),
});
const grantSchema = z.object({
  id: identitySchema,
  accountId: identitySchema,
  workbenchId: identitySchema,
  environmentId: identitySchema,
  token: z.string().nullable(),
});
const accountsSchema = z.array(z.object({ accountId: identitySchema }));
export const enrollmentInputSchema = z.strictObject({
  managerOrigin: managerOriginSchema,
  accountId: identitySchema,
  expiresAt: z.iso.datetime(),
});

const currentAccess = async (connection: RelayWorkbench) => {
  try {
    await managerRequest(connection.managerOrigin, "/v1/environment-access", connection.renewalGrant, {
      workbenchId: connection.workbenchId,
    });
    return true;
  } catch (error) {
    if (error instanceof ManagerRequestDenied && error.status === 401) return false;
    throw error;
  }
};
const pendingEnrollment = (
  state: z.infer<typeof stateSchema>,
  next: Omit<z.infer<typeof intentSchema>, "requestId" | "replacesId">,
) => {
  const pending = state.pending.find((entry) => entry.workbenchId === next.workbenchId);
  if (
    pending &&
    (pending.accountId !== next.accountId ||
      pending.managerOrigin !== next.managerOrigin ||
      pending.environmentId !== next.environmentId)
  )
    throw new Error("Native relay owner mismatch");
  if (pending && new Date(pending.expiresAt) > new Date()) return pending;
  state.pending = state.pending.filter((entry) => entry !== pending);
  const created = intentSchema.parse({ ...next, requestId: crypto.randomUUID() });
  state.pending.push(created);
  return created;
};
const issueEnrollment = async (pending: z.infer<typeof intentSchema>, token: string) => {
  const { accountId, managerOrigin, ...body } = pending;
  const path = `/v1/accounts/${encodeURIComponent(accountId)}/environments${pending.replacesId ? "/replace" : ""}`;
  const issued = grantSchema.parse(await managerRequest(managerOrigin, path, token, body));
  if (
    issued.accountId !== accountId ||
    issued.workbenchId !== pending.workbenchId ||
    issued.environmentId !== pending.environmentId
  )
    throw new Error("Native relay owner mismatch");
  return issued;
};

export const createNativeAccount = (input: {
  stateFile: string;
  connectionsFile: string;
  environment: RouteDeps["environmentService"];
  project: Pick<RouteDeps["projectService"], "get">;
  connected: (connection: RelayWorkbench) => Promise<void>;
}) => {
  const store = createNativeStore(input.connectionsFile);
  const read = () => readPrivateFile(input.stateFile, stateSchema, { sessions: [], pending: [] });
  const save = (state: z.infer<typeof stateSchema>) => writePrivateFile(input.stateFile, state);
  const serialized = <T>(action: () => Promise<T>) => serializeNativeWrite(input.stateFile, action);
  const session = async (origin: string) => {
    const token = (await read()).sessions.find((entry) => entry.managerOrigin === origin)?.token;
    if (!token) throw new Error("Sign in to this account service first");
    return token;
  };
  const logins = new Map<string, ReturnType<typeof startNativeLogin>>();
  const safeConnections = async () => (await store.read()).connections.map(({ renewalGrant: _, ...owner }) => owner);
  return {
    async login(managerOrigin: string) {
      const origin = managerOriginSchema.parse(managerOrigin);
      for (const [id, login] of logins)
        if (login.status() !== "pending") {
          login.close();
          logins.delete(id);
        }
      const id = crypto.randomUUID();
      const login = startNativeLogin(origin, (token, signal) =>
        serialized(async () => {
          const state = await read();
          signal.throwIfAborted();
          state.sessions = [
            ...state.sessions.filter((entry) => entry.managerOrigin !== origin),
            { managerOrigin: origin, token },
          ];
          await save(state);
        }),
      );
      logins.set(id, login);
      return { id, url: login.url };
    },
    loginStatus: (id: string) => ({ status: logins.get(id)?.status() ?? "failed" }),
    async inspect(managerOrigin: string) {
      const origin = managerOriginSchema.parse(managerOrigin);
      const token = await session(origin);
      const current = z
        .object({
          user: z.object({ id: z.string(), email: z.string(), name: z.string() }),
          session: z.object({ expiresAt: z.string() }),
        })
        .parse(await managerRequest(origin, "/api/auth/get-session", token));
      return {
        ...current,
        accounts: accountsSchema.parse(await managerRequest(origin, "/v1/owner/accounts", token)),
        connections: await safeConnections(),
      };
    },
    async createAccount(managerOrigin: string) {
      const origin = managerOriginSchema.parse(managerOrigin);
      return z
        .object({ accountId: identitySchema })
        .parse(await managerRequest(origin, "/v1/owner/accounts", await session(origin), {}));
    },
    async logout(managerOrigin: string) {
      const origin = managerOriginSchema.parse(managerOrigin);
      for (const login of logins.values()) if (login.origin === origin) login.close();
      await managerRequest(origin, "/api/auth/sign-out", await session(origin), {});
      await serialized(async () => {
        const state = await read();
        state.sessions = state.sessions.filter((entry) => entry.managerOrigin !== origin);
        await save(state);
      });
      return { ok: true };
    },
    async list(managerOrigin: string, accountId: string, kind: "workbenches" | "environments") {
      const origin = managerOriginSchema.parse(managerOrigin);
      identitySchema.parse(accountId);
      return managerRequest(origin, `/v1/accounts/${encodeURIComponent(accountId)}/${kind}`, await session(origin));
    },
    async revoke(managerOrigin: string, accountId: string, environmentId: string) {
      const origin = managerOriginSchema.parse(managerOrigin);
      identitySchema.parse(accountId);
      identitySchema.parse(environmentId);
      await managerRequest(
        origin,
        `/v1/accounts/${encodeURIComponent(accountId)}/environments/revoke`,
        await session(origin),
        { requestId: crypto.randomUUID(), environmentId },
      );
      return { ok: true };
    },
    connections: safeConnections,
    connect: (workbenchId: string, body: z.input<typeof enrollmentInputSchema>) =>
      serialized(async () => {
        const intent = enrollmentInputSchema.parse(body);
        identitySchema.parse(workbenchId);
        if (!(await input.project.get(workbenchId))) throw new Error("Bind or create this workbench locally first");
        const { environmentId } = await input.environment.get();
        const token = await session(intent.managerOrigin);
        const accountPath = `/v1/accounts/${encodeURIComponent(intent.accountId)}`;
        // Permission is checked even when a matching local enrollment already exists.
        await managerRequest(intent.managerOrigin, `${accountPath}/workbenches`, token);
        const current = (await store.read()).connections.find((entry) => entry.workbenchId === workbenchId);
        if (current) {
          assertSameOwner(current, {
            accountId: intent.accountId,
            managerOrigin: intent.managerOrigin,
            relayOrigin: current.relayOrigin,
            workbenchId,
            environmentId,
          });
          if (await currentAccess(current)) {
            await input.connected(current);
            return { accountId: current.accountId, workbenchId, environmentId, connected: true };
          }
        }
        const state = await read();
        const pending = pendingEnrollment(state, { ...intent, workbenchId, environmentId });
        await save(state);
        let grant = await issueEnrollment(pending, token);
        if (!grant.token) {
          pending.replacesId = grant.id;
          pending.requestId = crypto.randomUUID();
          await save(state);
          grant = await issueEnrollment(pending, token);
        }
        if (!grant.token) throw new Error("Enrollment response unavailable; retry connect");
        // The manager's configured relay audience owns the relay URL, not a caller-supplied URL.
        const configuration = z
          .object({ relayOrigin: managerOriginSchema })
          .parse(await managerRequest(intent.managerOrigin, "/v1/owner/configuration", token));
        const connection = {
          accountId: intent.accountId,
          workbenchId,
          environmentId,
          managerOrigin: intent.managerOrigin,
          relayOrigin: configuration.relayOrigin,
          renewalGrant: grant.token,
        };
        await store.connect(connection);
        state.pending = state.pending.filter((entry) => entry !== pending);
        await save(state);
        await input.connected(connection);
        return { accountId: intent.accountId, workbenchId, environmentId, connected: true };
      }),
    close() {
      for (const login of logins.values()) login.close();
      logins.clear();
    },
  };
};

export const nativeAccountPaths = (databasePath: string, storageRoot: string, connectionsFile?: string) => {
  const root = databasePath === ":memory:" ? storageRoot : dirname(databasePath);
  return {
    stateFile: join(root, "native-account.json"),
    connectionsFile: connectionsFile ?? join(root, "relay-connections.json"),
  };
};
