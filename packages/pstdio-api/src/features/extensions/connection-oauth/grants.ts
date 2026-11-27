import { createHash } from "node:crypto";
import type { ExtensionOAuthStatus } from "pstdio-api-contracts/extension-kernel";
import { deleteSecret } from "../extension-connection-cleanup";
import {
  type ConnectionKey,
  connectionKey,
  type ExtensionConnectionServiceDeps,
} from "../extension-connection-service-types";
import { ConnectionInputError } from "../extension-connection-transport";
import { createOAuthConsent } from "./consent";
import {
  exchangeTokens,
  type OAuthProvider,
  type OAuthTarget,
  type OAuthTokens,
  oauthTarget,
  revokeTokens,
} from "./provider";

type Mutate = <T>(operation: () => Promise<T>) => Promise<T>;
type Owner = () => Promise<string>;
type Key = ReturnType<typeof connectionKey>;
export interface OAuthGrantScope {
  principal: string;
  key: Key;
  slot: string;
  target: OAuthTarget;
}

interface Grant {
  binding: string;
  grantId: string;
  provider?: OAuthProvider;
  tokens?: OAuthTokens;
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const ownedKey = (input: ConnectionKey, owner: string) => ({
  ...connectionKey(input),
  contributionId: `oauth:${input.connectionId}:${digest(owner)}`,
});
const slotFor = (key: Key) => JSON.stringify([key.projectId, key.extensionId, key.contributionId]);

class ReconnectRequired extends ConnectionInputError {
  readonly code = "reconnect_required";
  constructor() {
    super("Reconnect this connection in your browser (reconnect_required).");
  }
}

export const createOAuthGrants = (deps: ExtensionConnectionServiceDeps, mutate: Mutate) => {
  const fetchFn = deps.fetch ?? globalThis.fetch;
  const now = deps.now ?? Date.now;
  const owner = deps.oauthOwner ?? (async () => "local");
  const credentials = deps.connectionsDBService.credentials;
  const targetFor = async (input: ConnectionKey) => {
    const contribution = await deps.getContribution(input);
    if (!contribution) throw new ConnectionInputError("This OAuth connection is unavailable.");
    return oauthTarget(contribution);
  };

  const owned = async (input: ConnectionKey, resolveOwner: Owner = owner) => {
    const principal = await resolveOwner();
    const key = ownedKey(input, principal);
    return { principal, key, slot: slotFor(key), target: await targetFor(input) };
  };

  const load = async (key: Key) => {
    const row = await credentials.get(key);
    if (row?.auth_type !== "oauth") return null;
    const raw = await deps.secretStore.get(row.secret_ref);
    const grant = raw ? (JSON.parse(raw) as Grant) : null;
    return { row, grant };
  };

  const save = async (key: Key, issuer: string, grant: Grant, previousRef?: string) => {
    const ref = await deps.secretStore.set(JSON.stringify(grant));
    try {
      await credentials.upsert({
        ...key,
        authType: "oauth",
        provider: issuer,
        secretRef: ref,
        scopes: grant.tokens?.scopes,
        expiresAt: grant.tokens?.expiresAt,
      });
    } catch (error) {
      await deleteSecret(deps, ref, "discard_oauth_secret");
      throw error;
    }
    if (previousRef) await deleteSecret(deps, previousRef, "replace_oauth_secret");
  };

  const assertOwner = async (principal: string) => {
    if (principal !== (await owner())) throw new ConnectionInputError("The host account changed during authorization.");
  };

  const assertTarget = async (input: ConnectionKey, binding: string) => {
    if ((await targetFor(input)).binding !== binding)
      throw new ConnectionInputError("The OAuth connection changed during authorization.");
  };

  const assertCurrent = async (input: ConnectionKey, principal: string, binding: string) => {
    await assertOwner(principal);
    await assertTarget(input, binding);
  };

  const consent = createOAuthConsent({
    fetchFn,
    now,
    resolve: owned,
    assertCurrent,
    save: (flow, provider, tokens, assertFlow) =>
      mutate(async () => {
        const previous = await load(flow.key);
        await assertFlow();
        await save(
          flow.key,
          provider.issuer,
          { provider, tokens, binding: flow.target.binding, grantId: crypto.randomUUID() },
          previous?.row.secret_ref,
        );
      }),
  });

  const status = async (input: ConnectionKey, resolveOwner?: Owner): Promise<ExtensionOAuthStatus> => {
    const scope = await owned(input, resolveOwner);
    await assertOwner(scope.principal);
    if (consent.isAuthorizing(scope.slot)) return { status: "authorizing" };
    const saved = await mutate(() => load(scope.key));
    if (!saved) return { status: "disconnected" };
    const tokens = saved.grant?.tokens;
    if (
      saved.grant?.binding !== scope.target.binding ||
      !tokens ||
      (tokens.expiresAt && Date.parse(tokens.expiresAt) <= now() && !tokens.refreshToken)
    )
      return { status: "reconnect_required" };
    return {
      status: "connected",
      grantId: saved.grant.grantId,
      scopes: saved.row.scopes,
      expiresAt: saved.row.expires_at,
    };
  };

  const disconnect = async (input: ConnectionKey) => {
    const principal = await owner();
    const key = ownedKey(input, principal);
    const saved = await mutate(async () => {
      await assertOwner(principal);
      consent.cancel(slotFor(key));
      const saved = await load(key);
      if (!saved) return null;
      await credentials.remove(key);
      await deleteSecret(deps, saved.row.secret_ref, "disconnect_oauth_grant");
      return saved.grant;
    });
    if (saved?.provider && saved.tokens) await revokeTokens(fetchFn, saved.provider, saved.tokens);
  };

  const refreshing = new Map<string, Promise<void>>();

  const invalidate = async (scope: OAuthGrantScope, ref: string) =>
    mutate(async () => {
      const current = await load(scope.key);
      if (current?.row.secret_ref !== ref || !current.grant?.tokens) return;
      const { binding, grantId } = current.grant;
      await save(scope.key, current.row.provider, { binding, grantId }, ref);
    });

  const refresh = async (input: ConnectionKey, scope: OAuthGrantScope, ref: string, grant: Grant) => {
    // A waiter can finish reading the previous secret after an earlier refresh has settled.
    // Reusing that refresh token could cause a provider to revoke the entire rotated grant.
    if ((await credentials.get(scope.key))?.secret_ref !== ref) return;
    if (!grant.provider || !grant.tokens?.refreshToken) return invalidate(scope, ref);
    const { provider, tokens, binding, grantId } = grant;
    const updated = await exchangeTokens(
      fetchFn,
      provider,
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken!,
      }),
      tokens.scopes,
      now,
    );
    if (!updated) return invalidate(scope, ref);
    updated.refreshToken ??= tokens.refreshToken;
    const stored = await mutate(async () => {
      const current = await credentials.get(scope.key);
      if (current?.secret_ref !== ref) return false;
      await assertTarget(input, scope.target.binding);
      await save(scope.key, provider.issuer, { binding, grantId, provider, tokens: updated }, ref);
      return true;
    });
    if (!stored) await revokeTokens(fetchFn, provider, updated).catch(() => undefined);
  };

  const access = async (input: ConnectionKey, binding: string, resolveOwner?: Owner, rejectedRef?: string) => {
    const scope = await owned(input, resolveOwner);
    if (scope.target.binding !== binding) throw new ConnectionInputError("The OAuth connection changed.");
    await assertCurrent(input, scope.principal, binding);
    // Credential replacement updates the DB reference and retires its file under the
    // same queue. Read both together so a rotation cannot look like a missing grant.
    let saved = await mutate(() => load(scope.key));
    if (!saved?.grant?.tokens || saved.grant.binding !== scope.target.binding) throw new ReconnectRequired();
    const { expiresAt } = saved.grant.tokens;
    if (saved.row.secret_ref === rejectedRef || (expiresAt && Date.parse(expiresAt) <= now())) {
      const existing = refreshing.get(scope.slot);
      if (existing) await existing;
      else {
        const job = refresh(input, scope, saved.row.secret_ref, saved.grant);
        refreshing.set(scope.slot, job);
        try {
          await job;
        } finally {
          refreshing.delete(scope.slot);
        }
      }
      await assertCurrent(input, scope.principal, binding);
      saved = await mutate(() => load(scope.key));
    }
    const tokens = saved?.grant?.tokens;
    if (
      !saved ||
      !tokens ||
      saved.grant?.binding !== scope.target.binding ||
      (tokens.expiresAt && Date.parse(tokens.expiresAt) <= now())
    )
      throw new ReconnectRequired();
    const ref = saved.row.secret_ref;
    const secrets = [tokens.accessToken, tokens.refreshToken, saved.grant.provider?.client.clientSecret].filter(
      (value): value is string => Boolean(value),
    );
    return {
      accessToken: tokens.accessToken,
      secrets,
      ref,
      reject: async () => {
        await invalidate(scope, ref);
        throw new ReconnectRequired();
      },
    };
  };

  return {
    start: consent.start,
    accept: consent.accept,
    status,
    disconnect,
    cancelPending: consent.cancelForProject,
    access,
    currentOwner: owner,
  };
};
export type ExtensionOAuthGrants = ReturnType<typeof createOAuthGrants>;
