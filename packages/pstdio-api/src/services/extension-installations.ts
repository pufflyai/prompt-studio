import type { ExtensionInstallation } from "pstdio-api-contracts";
import { createInstallationStorage } from "./extension-installations-storage";

type InstallationIdentity = Pick<ExtensionInstallation, "installName" | "displayName" | "extensionId" | "projectId">;
interface InstallationWork {
  job: ExtensionInstallation;
  related: (InstallationIdentity & { id: string })[];
  targets: string[];
  request?: { kind: "catalog"; name: string };
  operation: (signal: AbortSignal) => Promise<unknown>;
  afterOperation?: () => Promise<void>;
  completion: ReturnType<typeof Promise.withResolvers<unknown>>;
}
interface InstallationOptions {
  path?: string;
  installCatalog: (installName: string, signal: AbortSignal, projectId?: string) => Promise<void>;
}
const completion = () => {
  const pending = Promise.withResolvers<unknown>();
  void pending.promise.catch(() => {});
  return pending;
};
const snapshot = (entry: InstallationWork, id: string) => ({
  ...entry.job,
  ...entry.related.find((item) => item.id === id),
});
const retainSuccessfulOperation = (operation: InstallationWork["operation"]) => {
  let result: Promise<unknown> | undefined;
  return (signal: AbortSignal) => {
    result ??= Promise.resolve()
      .then(() => operation(signal))
      .catch((error) => {
        result = undefined;
        throw error;
      });
    return result;
  };
};

/** One owner for scheduling, retry, persistence and shutdown of extension installations. */
class ExtensionInstallationService {
  private readonly work = new Map<string, InstallationWork>();
  private readonly owners = new Map<string, string>();
  private readonly active = new Set<string>();
  private readonly installing = new Set<string>();
  private readonly locked = new Set<string>();
  private readonly lifetime = new AbortController();
  private readonly storage: ReturnType<typeof createInstallationStorage>;
  private scheduled = false;
  private closing?: Promise<void>;

  constructor(private readonly options?: InstallationOptions) {
    this.storage = createInstallationStorage(options?.path);
    for (const stored of this.storage.read()) {
      if (!options) throw new Error("Catalog installation is unavailable.");
      const job = { ...stored.job };
      if (job.status === "running") job.status = "queued";
      const pending = completion();
      this.work.set(job.id, {
        job,
        related: [],
        targets: [job.installName],
        request: stored.request,
        operation: (signal) => options.installCatalog(stored.request.name, signal, job.projectId),
        completion: pending,
      });
      this.owners.set(job.id, job.id);
      if (job.status === "completed") pending.resolve(undefined);
      if (job.status === "failed") pending.reject(new Error(job.error));
    }
    this.schedule();
  }

  private persist() {
    return this.storage.save(
      [...this.work.values()].flatMap((entry) => (entry.request ? [{ job: entry.job, request: entry.request }] : [])),
    );
  }
  private schedule() {
    if (this.scheduled || this.lifetime.signal.aborted) return;
    this.scheduled = true;
    queueMicrotask(() => this.pump());
  }
  private pump() {
    this.scheduled = false;
    if (this.lifetime.signal.aborted) return;
    for (const entry of this.work.values()) {
      if (this.installing.size >= 2) break;
      const names = entry.targets;
      if (entry.job.status !== "queued" || names.some((name) => this.locked.has(name))) continue;
      this.active.add(entry.job.id);
      this.installing.add(entry.job.id);
      for (const name of names) this.locked.add(name);
      entry.job = { ...entry.job, status: "running", startedAt: new Date().toISOString() };
      void this.execute(entry, names);
    }
  }
  private releaseInstallation(entry: InstallationWork, names: string[]) {
    if (!this.installing.delete(entry.job.id)) return;
    for (const name of names) this.locked.delete(name);
    this.schedule();
  }
  private async execute(entry: InstallationWork, names: string[]) {
    try {
      await this.persist();
      const result = await entry.operation(this.lifetime.signal);
      this.releaseInstallation(entry, names);
      await entry.afterOperation?.();
      entry.job = { ...entry.job, status: "completed", completedAt: new Date().toISOString() };
      await this.persist();
      entry.completion.resolve(result);
    } catch (error) {
      const interrupted = this.lifetime.signal.aborted && entry.request !== undefined;
      const message = error instanceof Error ? error.message : String(error);
      entry.job = {
        ...entry.job,
        status: interrupted ? "queued" : "failed",
        completedAt: interrupted ? undefined : new Date().toISOString(),
        error: interrupted ? undefined : message,
      };
      // Storage failure must not replace the operation's error.
      await this.persist().catch(() => {});
      entry.completion.reject(error);
    } finally {
      this.active.delete(entry.job.id);
      this.releaseInstallation(entry, names);
    }
  }
  private enqueueGroup(
    identities: InstallationIdentity[],
    operation: InstallationWork["operation"],
    request?: InstallationWork["request"],
    targets = identities.map((identity) => identity.installName),
    afterOperation?: InstallationWork["afterOperation"],
  ) {
    this.lifetime.signal.throwIfAborted();
    const [identity, ...rest] = identities;
    const job: ExtensionInstallation = {
      ...identity,
      id: crypto.randomUUID(),
      status: "queued",
      queuedAt: new Date().toISOString(),
    };
    const related = rest.map((identity) => ({ ...identity, id: crypto.randomUUID() }));
    this.work.set(job.id, {
      job,
      related,
      targets,
      request,
      afterOperation,
      operation: retainSuccessfulOperation(operation),
      completion: completion(),
    });
    for (const id of [job.id, ...related.map((item) => item.id)]) this.owners.set(id, job.id);
    void this.persist().catch(() => {});
    this.schedule();
    return { ...job };
  }
  private find(id: string) {
    return this.work.get(this.owners.get(id) ?? id);
  }

  enqueue(identity: InstallationIdentity, operation: InstallationWork["operation"]) {
    return this.enqueueGroup([identity], operation);
  }
  enqueueCatalog(identity: InstallationIdentity) {
    const options = this.options;
    if (!options) throw new Error("Catalog installation is unavailable.");
    const previous = [...this.work.values()].find(
      (entry) => entry.request?.name === identity.installName && entry.job.projectId === identity.projectId,
    );
    if (previous) return { ...previous.job };
    return this.enqueueGroup(
      [identity],
      (signal) => options.installCatalog(identity.installName, signal, identity.projectId),
      {
        kind: "catalog",
        name: identity.installName,
      },
    );
  }
  wait(id: string) {
    const entry = this.find(id);
    if (!entry) throw new Error("Extension installation not found.");
    return entry.completion.promise;
  }
  async runGroup<T>(
    identities: InstallationIdentity[],
    operation: (signal: AbortSignal) => Promise<T>,
    targets?: string[],
    afterOperation?: (result: T) => Promise<void>,
  ) {
    if (!identities.length) return operation(this.lifetime.signal);
    let result!: T;
    const job = this.enqueueGroup(
      identities,
      async (signal) => {
        result = await operation(signal);
      },
      undefined,
      targets,
      afterOperation ? () => afterOperation(result) : undefined,
    );
    await this.wait(job.id);
    return result;
  }
  run<T>(
    identity: InstallationIdentity,
    operation: (signal: AbortSignal) => Promise<T>,
    target = identity.installName,
    afterOperation?: (result: T) => Promise<void>,
  ) {
    return this.runGroup([identity], operation, [target], afterOperation);
  }
  retry(id: string) {
    this.lifetime.signal.throwIfAborted();
    const entry = this.find(id);
    if (!entry) return null;
    if (entry.job.status !== "failed") return snapshot(entry, id);
    entry.job = {
      ...entry.job,
      status: "queued",
      queuedAt: new Date().toISOString(),
      startedAt: undefined,
      completedAt: undefined,
      error: undefined,
    };
    entry.completion = completion();
    void this.persist().catch(() => {});
    this.schedule();
    return snapshot(entry, id);
  }
  list() {
    return [...this.work.values()].flatMap((entry) => [
      { ...entry.job },
      ...entry.related.map((item) => snapshot(entry, item.id)),
    ]);
  }
  flush() {
    return this.storage.flush();
  }
  dispose() {
    if (this.closing) return this.closing;
    this.lifetime.abort(new Error("The runtime is shutting down."));
    const pending = [...this.active].map((id) => this.work.get(id)!.completion.promise);
    for (const entry of this.work.values()) {
      if (!this.active.has(entry.job.id) && entry.job.status === "queued")
        entry.completion.reject(this.lifetime.signal.reason);
    }
    this.closing = Promise.allSettled(pending).then(() => this.storage.flush());
    return this.closing;
  }
}
export const createExtensionInstallations = (options?: InstallationOptions) =>
  new ExtensionInstallationService(options);
export type ExtensionInstallations = ReturnType<typeof createExtensionInstallations>;
