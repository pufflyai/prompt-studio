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
export const processEnvironmentSourceIdentity = (source: ProcessEnvironmentSource) =>
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

const createGrantLoader = (path: string) => {
  let loaded: Promise<Map<string, ProcessEnvironmentGrant>> | undefined;
  return () => {
    if (!loaded) {
      const reading = readGrantFile(path);
      loaded = reading;
      void reading.catch(() => {
        if (loaded === reading) loaded = undefined;
      });
    }
    return loaded;
  };
};

/**
 * Owns which host environment names each extension source may pass to the children it starts,
 * per project. Grants hold names and the source identity only; values stay in the host
 * environment. Running children are tracked so a revocation can stop them before it takes effect.
 */
export const createProcessEnvironmentPermissions = (input: {
  path: string;
  findSource: (
    projectId: string,
    extensionId: string,
    enabledOnly?: boolean,
  ) => Promise<ProcessEnvironmentSource | undefined>;
}) => {
  const grants = createGrantLoader(input.path);
  let writes = Promise.resolve();
  // The change reaches the shared map only once the file holds it, so a failed save changes nothing.
  const persist = (
    map: Map<string, ProcessEnvironmentGrant>,
    key: string,
    next: ProcessEnvironmentGrant | undefined,
    validate?: () => Promise<unknown>,
  ) => {
    const update = (target: Map<string, ProcessEnvironmentGrant>) =>
      next ? target.set(key, next) : target.delete(key);
    const write = writes.then(async () => {
      await validate?.();
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
    const identity = processEnvironmentSourceIdentity(source);
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

  const validateGrant = async (projectId: string, extensionId: string, sourceIdentity: string, names: string[]) => {
    const source = await requireSource(projectId, extensionId);
    if (processEnvironmentSourceIdentity(source) !== sourceIdentity)
      throw new ProcessEnvironmentPermissionError(
        "process_environment_source_changed",
        `The ${extensionId} extension source changed after these names were shown. Review its requested names again.`,
      );
    const requested = requestedNames(source);
    const unrequested = names.filter((name) => !requested.includes(name));
    if (unrequested.length)
      throw new ProcessEnvironmentPermissionError(
        "process_environment_not_requested",
        `${extensionId} does not request ${unrequested.join(", ")} in pstdio.processEnvironment.`,
      );
  };

  // Children started under the previous grant stop before the change takes effect. New children are
  // refused until the grant is replaced and saved, so none can start between the steps.
  const applyGrant = async (
    key: string,
    next: ProcessEnvironmentGrant | undefined,
    reason: Error,
    validate?: () => Promise<unknown>,
  ) => {
    await validate?.();
    const map = await grants();
    const previous = map.get(key);
    const retire =
      previous !== undefined &&
      (previous.sourceIdentity !== next?.sourceIdentity || previous.names.some((name) => !next.names.includes(name)));
    retiring.add(key);
    try {
      if (retire) {
        const results = await Promise.allSettled(
          [...(leases.get(key) ?? [])].map(async (lease) => {
            lease.revoked = reason;
            await lease.stop?.(reason);
          }),
        );
        const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
        if (failures.length) throw new AggregateError(failures, "Could not stop the extension's granted processes.");
      }
      await persist(map, key, next, validate);
    } finally {
      retiring.delete(key);
    }
  };

  const replaceGrant = (
    key: string,
    next: ProcessEnvironmentGrant | undefined,
    reason: Error,
    validate?: () => Promise<unknown>,
  ) => {
    const run = (changes.get(key) ?? Promise.resolve()).then(() => applyGrant(key, next, reason, validate));
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
      const names = [...new Set(request.names)];
      const identity = request.sourceIdentity;
      const validate = () => validateGrant(projectId, extensionId, identity, names);
      const key = grantKey(projectId, extensionId);
      await replaceGrant(
        key,
        { projectId, extensionId, sourceIdentity: identity, names, grantedAt: new Date().toISOString() },
        new Error(`Environment access for ${extensionId} changed while the command was running.`),
        validate,
      );
      const current = await requireSource(projectId, extensionId);
      return describe(projectId, current, (await grants()).get(key));
    },

    revoke: (projectId: string, extensionId: string) =>
      replaceGrant(
        grantKey(projectId, extensionId),
        undefined,
        new Error(`Environment access for ${extensionId} was revoked while the command was running.`),
      ),

    /**
     * Checks names a child is about to receive against the invocation's source generation and the
     * current grant. The returned lease owns the synchronous start and must be released once the
     * process tree exits. A change may invalidate the lease before its start callback is called.
     */
    async authorize(projectId: string, source: ProcessEnvironmentSource, names: string[]) {
      const extensionId = source.extension_id;
      const namesToAuthorize = [...names];
      const identity = processEnvironmentSourceIdentity(source);
      const requested = requestedNames(source);
      const undeclared = namesToAuthorize.filter((name) => !requested.includes(name));
      if (undeclared.length)
        throw new ProcessEnvironmentPermissionError(
          "process_environment_not_requested",
          `envFromHost asks for ${undeclared.join(", ")}, which ${extensionId} does not list in pstdio.processEnvironment. Add the names to its package.json and reload the extension.`,
        );
      const key = grantKey(projectId, extensionId);
      const map = await grants();
      const current = await input.findSource(projectId, extensionId, true);
      // From here to the lease nothing awaits, so a revocation either sees this lease or runs first.
      const grant = map.get(key);
      const usable =
        !retiring.has(key) &&
        current !== undefined &&
        processEnvironmentSourceIdentity(current) === identity &&
        grant?.sourceIdentity === identity;
      const missing = namesToAuthorize.filter((name) => !usable || !grant.names.includes(name));
      if (missing.length)
        throw new ProcessEnvironmentPermissionError(
          "process_environment_not_granted",
          `Environment access not granted: ${extensionId} needs ${missing.join(", ")} for this project and source. ${grantHint(extensionId)}`,
        );

      const lease: Lease = {};
      const active = leases.get(key) ?? new Set();
      active.add(lease);
      leases.set(key, active);
      const release = () => {
        active.delete(lease);
        if (active.size === 0 && leases.get(key) === active) leases.delete(key);
      };
      return {
        start<T>(spawn: () => { value: T; stop: StopChild }): T {
          if (lease.revoked !== undefined) throw lease.revoked;
          if (retiring.has(key) || !active.has(lease) || lease.stop)
            throw new ProcessEnvironmentPermissionError(
              "process_environment_not_granted",
              `Environment access for ${extensionId} is no longer available for this child.`,
            );
          const { value, stop } = spawn();
          lease.stop = stop;
          return value;
        },
        release,
        releaseUnused() {
          if (!lease.stop) release();
        },
      };
    },

    /** Selects implicit grants for the exact source that implements a harness or provider. */
    async grantedNames(projectId: string, source: ProcessEnvironmentSource) {
      const { extension_id: extensionId } = source;
      const key = grantKey(projectId, extensionId);
      const map = await grants();
      const current = await input.findSource(projectId, extensionId, true);
      const identity = processEnvironmentSourceIdentity(source);
      if (!current || processEnvironmentSourceIdentity(current) !== identity)
        throw new ProcessEnvironmentPermissionError(
          "process_environment_source_changed",
          `The ${extensionId} invocation no longer belongs to the enabled source in this project.`,
        );
      const grant = map.get(key);
      if (!grant || grant.sourceIdentity !== identity || retiring.has(key)) return [];
      const requested = requestedNames(source);
      return grant.names.filter((name) => requested.includes(name));
    },
  };
  return permissions;
};

export type ProcessEnvironmentPermissions = ReturnType<typeof createProcessEnvironmentPermissions>;
export type ProcessEnvironmentLease = Awaited<ReturnType<ProcessEnvironmentPermissions["authorize"]>>;
