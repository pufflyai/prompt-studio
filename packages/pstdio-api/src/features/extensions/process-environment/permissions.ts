import { createHash } from "node:crypto";
import type { GrantExtensionProcessEnvironmentInput } from "pstdio-api-contracts";
import { parseProcessEnvironmentDeclaration } from "pstdio-extensions";
import { grantKey, type ProcessEnvironmentGrant, readGrantFile, writeGrantFile } from "./grant-file";

/** The installed source fields a grant depends on. */
export interface ProcessEnvironmentSource {
  extension_id: string;
  source_path: string;
  source_hash: string | null;
  manifest_json: unknown;
}

type ErrorCode =
  | "extension_not_found"
  | "process_environment_not_granted"
  | "process_environment_not_requested"
  | "process_environment_source_changed";

export class ProcessEnvironmentPermissionError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

type StopChild = (reason: unknown) => Promise<void>;
interface Lease {
  stop?: StopChild;
  revoked?: unknown;
}

// Content and location together: the same content installed elsewhere is a different source.
const sourceIdentity = (source: ProcessEnvironmentSource) =>
  createHash("sha256")
    .update(JSON.stringify([source.source_path, source.source_hash]))
    .digest("hex");

const requestedNames = (source: ProcessEnvironmentSource) => {
  const declared = (source.manifest_json as { pstdio?: { processEnvironment?: unknown } } | null)?.pstdio
    ?.processEnvironment;
  return declared === undefined ? [] : (parseProcessEnvironmentDeclaration(declared).names ?? []);
};

const grantHint = (extensionId: string) =>
  `Allow them in the extension's details, or run \`pst extensions permissions show ${extensionId}\` and then \`pst extensions permissions grant\`.`;

/**
 * Owns which host environment names each extension source may pass to the children it starts,
 * per project. Grants hold names and the source identity only; values stay in the host
 * environment. Running children are tracked so a revocation can stop them before it takes effect.
 */
export const createProcessEnvironmentPermissions = (input: {
  path: string;
  findSource: (projectId: string, extensionId: string) => Promise<ProcessEnvironmentSource | undefined>;
}) => {
  let loaded: Promise<Map<string, ProcessEnvironmentGrant>> | undefined;
  const grants = () => {
    loaded ??= readGrantFile(input.path);
    return loaded;
  };
  let writes = Promise.resolve();
  // The change reaches the shared map only once the file holds it, so a failed save changes nothing.
  const persist = (
    map: Map<string, ProcessEnvironmentGrant>,
    key: string,
    next: ProcessEnvironmentGrant | undefined,
  ) => {
    const update = (target: Map<string, ProcessEnvironmentGrant>) =>
      next ? target.set(key, next) : target.delete(key);
    const write = writes.then(async () => {
      const saved = new Map(map);
      update(saved);
      await writeGrantFile(input.path, saved.values());
      update(map);
    });
    writes = write.catch(() => {});
    return write;
  };
  const leases = new Map<string, Set<Lease>>();
  const retiring = new Set<string>();
  // Grant changes for one extension run one at a time, so each sees the leases started under the last.
  const changes = new Map<string, Promise<void>>();

  const requireSource = async (projectId: string, extensionId: string) => {
    const source = await input.findSource(projectId, extensionId);
    if (!source)
      throw new ProcessEnvironmentPermissionError("extension_not_found", `Extension not found: ${extensionId}`);
    return source;
  };

  const describe = (projectId: string, source: ProcessEnvironmentSource, grant?: ProcessEnvironmentGrant) => {
    const identity = sourceIdentity(source);
    const requested = requestedNames(source);
    const current = grant?.sourceIdentity === identity;
    return {
      extensionId: source.extension_id,
      projectId,
      sourceIdentity: identity,
      requested,
      granted: current ? grant.names.filter((name) => requested.includes(name)) : [],
      stale: grant !== undefined && !current,
    };
  };

  // Children started under the previous grant stop before the change takes effect. New children are
  // refused until the grant is replaced and saved, so none can start between the steps.
  const applyGrant = async (key: string, next: ProcessEnvironmentGrant | undefined, reason: unknown) => {
    const map = await grants();
    const previous = map.get(key);
    const retire =
      previous !== undefined &&
      (previous.sourceIdentity !== next?.sourceIdentity || previous.names.some((name) => !next.names.includes(name)));
    retiring.add(key);
    try {
      if (retire)
        await Promise.all(
          [...(leases.get(key) ?? [])].map((lease) => {
            lease.revoked = reason;
            return lease.stop?.(reason);
          }),
        );
      await persist(map, key, next);
    } finally {
      retiring.delete(key);
    }
  };

  const replaceGrant = (key: string, next: ProcessEnvironmentGrant | undefined, reason: unknown) => {
    const run = (changes.get(key) ?? Promise.resolve()).then(() => applyGrant(key, next, reason));
    const settled = run.catch(() => {});
    changes.set(key, settled);
    void settled.then(() => {
      if (changes.get(key) === settled) changes.delete(key);
    });
    return run;
  };

  const permissions = {
    read: async (projectId: string, extensionId: string) =>
      describe(
        projectId,
        await requireSource(projectId, extensionId),
        (await grants()).get(grantKey(projectId, extensionId)),
      ),

    async grant(projectId: string, extensionId: string, request: GrantExtensionProcessEnvironmentInput) {
      const source = await requireSource(projectId, extensionId);
      if (sourceIdentity(source) !== request.sourceIdentity)
        throw new ProcessEnvironmentPermissionError(
          "process_environment_source_changed",
          `The ${extensionId} extension source changed after these names were shown. Review its requested names again.`,
        );
      const requested = requestedNames(source);
      const unrequested = request.names.filter((name) => !requested.includes(name));
      if (unrequested.length)
        throw new ProcessEnvironmentPermissionError(
          "process_environment_not_requested",
          `${extensionId} does not request ${unrequested.join(", ")} in pstdio.processEnvironment.`,
        );
      const key = grantKey(projectId, extensionId);
      const names = [...new Set(request.names)];
      await replaceGrant(
        key,
        { projectId, extensionId, sourceIdentity: request.sourceIdentity, names, grantedAt: new Date().toISOString() },
        new Error(`Environment access for ${extensionId} changed while the command was running.`),
      );
      return describe(projectId, source, (await grants()).get(key));
    },

    revoke: (projectId: string, extensionId: string) =>
      replaceGrant(
        grantKey(projectId, extensionId),
        undefined,
        new Error(`Environment access for ${extensionId} was revoked while the command was running.`),
      ),

    /**
     * Checks names a child is about to receive against the invocation's source generation and the
     * current grant. The returned lease must be attached to the child once it starts and released
     * when it ends.
     */
    async authorize(projectId: string, source: ProcessEnvironmentSource, names: string[]) {
      const extensionId = source.extension_id;
      const requested = requestedNames(source);
      const undeclared = names.filter((name) => !requested.includes(name));
      if (undeclared.length)
        throw new ProcessEnvironmentPermissionError(
          "process_environment_not_requested",
          `envFromHost asks for ${undeclared.join(", ")}, which ${extensionId} does not list in pstdio.processEnvironment. Add the names to its package.json and reload the extension.`,
        );
      const key = grantKey(projectId, extensionId);
      const map = await grants();
      const current = await input.findSource(projectId, extensionId);
      // From here to the lease nothing awaits, so a revocation either sees this lease or runs first.
      const grant = map.get(key);
      const usable =
        !retiring.has(key) &&
        current !== undefined &&
        sourceIdentity(current) === sourceIdentity(source) &&
        grant?.sourceIdentity === sourceIdentity(source);
      const missing = names.filter((name) => !usable || !grant.names.includes(name));
      if (missing.length)
        throw new ProcessEnvironmentPermissionError(
          "process_environment_not_granted",
          `Environment access not granted: ${extensionId} needs ${missing.join(", ")} for this project and source. ${grantHint(extensionId)}`,
        );

      const lease: Lease = {};
      const active = leases.get(key) ?? new Set();
      active.add(lease);
      leases.set(key, active);
      return {
        attach(stop: StopChild) {
          if (lease.revoked === undefined) lease.stop = stop;
          else void stop(lease.revoked);
        },
        release() {
          active.delete(lease);
          if (active.size === 0 && leases.get(key) === active) leases.delete(key);
        },
      };
    },

    /**
     * The names allowed for the extension's current source in the project, for processes the host
     * starts on its behalf, such as a harness's or a workspace provider's. Empty when none are.
     */
    async grantedNames(projectId: string, extensionId: string) {
      const source = await input.findSource(projectId, extensionId);
      const grant = (await grants()).get(grantKey(projectId, extensionId));
      if (!source || !grant || retiring.has(grantKey(projectId, extensionId))) return [];
      if (grant.sourceIdentity !== sourceIdentity(source)) return [];
      const requested = requestedNames(source);
      return grant.names.filter((name) => requested.includes(name));
    },

    /** Authorizes names against the extension's current source, for those host-started processes. */
    async authorizeCurrent(projectId: string, extensionId: string, names: string[]) {
      const source = await input.findSource(projectId, extensionId);
      if (!source)
        throw new ProcessEnvironmentPermissionError(
          "extension_not_found",
          `${extensionId} is not enabled in this project, so it has no environment access.`,
        );
      return permissions.authorize(projectId, source, names);
    },
  };
  return permissions;
};

export type ProcessEnvironmentPermissions = ReturnType<typeof createProcessEnvironmentPermissions>;
export type ProcessEnvironmentLease = Awaited<ReturnType<ProcessEnvironmentPermissions["authorize"]>>;
