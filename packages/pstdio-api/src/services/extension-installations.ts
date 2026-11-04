import { createInstallationStorage, type ExtensionInstallation } from "./extension-installations-storage";

type InstallationIdentity = Pick<ExtensionInstallation, "installName" | "displayName" | "extensionId" | "projectId">;
interface InstallationEntry {
  job: ExtensionInstallation;
  completion: ReturnType<typeof Promise.withResolvers<void>>;
}
interface InstallationOptions {
  path?: string;
  installCatalog: (installName: string, signal: AbortSignal, projectId: string) => Promise<void>;
  afterCatalogInstall?: (installName: string, projectId: string) => Promise<void>;
}

const MAX_CONCURRENT_INSTALLATIONS = 2;
const keyOf = (identity: Pick<ExtensionInstallation, "installName" | "projectId">) =>
  JSON.stringify([identity.projectId, identity.installName]);
const completion = () => {
  const pending = Promise.withResolvers<void>();
  void pending.promise.catch(() => {});
  return pending;
};

/**
 * Background catalog selections made by extensions for their project.
 * Each project keeps at most one entry per catalog extension: submitting it again retries a failure
 * and replaces a completed entry. Only unfinished and failed work is persisted across restarts.
 */
class ExtensionInstallationService {
  private readonly entries = new Map<string, InstallationEntry>();
  private readonly active = new Set<Promise<void>>();
  private readonly running = new Set<string>();
  private readonly lifetime = new AbortController();
  private readonly storage: ReturnType<typeof createInstallationStorage>;
  private started = false;
  private scheduled = false;
  private closing?: Promise<void>;

  constructor(private readonly options: InstallationOptions) {
    this.storage = createInstallationStorage(options.path);
    for (const job of this.storage.read()) {
      const entry = {
        job: job.status === "running" ? { ...job, status: "queued" as const } : job,
        completion: completion(),
      };
      if (entry.job.status === "failed") entry.completion.reject(new Error(entry.job.error));
      this.entries.set(keyOf(job), entry);
    }
  }

  /** Recovered work waits until the host's dependencies exist. */
  start() {
    this.started = true;
    this.schedule();
  }

  private persist() {
    return this.storage.save(
      [...this.entries.values()].flatMap(({ job }) => (job.status === "completed" ? [] : [job])),
    );
  }
  private schedule() {
    if (!this.started || this.scheduled || this.lifetime.signal.aborted) return;
    this.scheduled = true;
    queueMicrotask(() => this.pump());
  }
  private pump() {
    this.scheduled = false;
    if (this.lifetime.signal.aborted) return;
    const busy = new Set([...this.running].map((key) => this.entries.get(key)?.job.installName));
    for (const [key, entry] of this.entries) {
      if (this.running.size >= MAX_CONCURRENT_INSTALLATIONS) break;
      // Two projects selecting one catalog extension share its source; install it once at a time.
      if (entry.job.status !== "queued" || busy.has(entry.job.installName)) continue;
      busy.add(entry.job.installName);
      this.running.add(key);
      entry.job = { ...entry.job, status: "running", startedAt: new Date().toISOString() };
      const pending = this.execute(key, entry);
      this.active.add(pending);
      void pending.finally(() => this.active.delete(pending));
    }
  }
  private async execute(key: string, entry: InstallationEntry) {
    const { installName, projectId } = entry.job;
    try {
      await this.persist();
      await this.options.installCatalog(installName, this.lifetime.signal, projectId);
      await this.options.afterCatalogInstall?.(installName, projectId);
      entry.job = { ...entry.job, status: "completed", completedAt: new Date().toISOString() };
      entry.completion.resolve();
    } catch (error) {
      // Shutdown leaves the selection queued for the next runtime.
      const interrupted = this.lifetime.signal.aborted;
      entry.job = interrupted
        ? { ...entry.job, status: "queued", startedAt: undefined }
        : {
            ...entry.job,
            status: "failed",
            completedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          };
      entry.completion.reject(error);
    } finally {
      this.running.delete(key);
      // Storage failure must not replace the operation's result.
      await this.persist().catch(() => {});
      this.schedule();
    }
  }

  /** Accepts a selection without waiting for it. Pending work is shared; failed work is retried. */
  enqueue(identity: InstallationIdentity) {
    this.lifetime.signal.throwIfAborted();
    const key = keyOf(identity);
    const existing = this.entries.get(key);
    if (existing && (existing.job.status === "queued" || existing.job.status === "running")) return existing.job;
    const entry: InstallationEntry = {
      job: { id: crypto.randomUUID(), ...identity, status: "queued", queuedAt: new Date().toISOString() },
      completion: completion(),
    };
    this.entries.set(key, entry);
    void this.persist().catch(() => {});
    this.schedule();
    return entry.job;
  }
  wait(id: string) {
    const entry = [...this.entries.values()].find(({ job }) => job.id === id);
    if (!entry) throw new Error("Extension installation not found.");
    return entry.completion.promise;
  }
  list() {
    return [...this.entries.values()].map(({ job }) => job);
  }
  flush() {
    return this.storage.flush();
  }
  dispose() {
    if (this.closing) return this.closing;
    this.lifetime.abort(new Error("The runtime is shutting down."));
    for (const { job, completion } of this.entries.values()) {
      if (job.status === "queued") completion.reject(this.lifetime.signal.reason);
    }
    this.closing = Promise.allSettled([...this.active]).then(() => this.storage.flush());
    return this.closing;
  }
}

export const createExtensionInstallations = (options: InstallationOptions) => new ExtensionInstallationService(options);
export type ExtensionInstallations = ReturnType<typeof createExtensionInstallations>;
