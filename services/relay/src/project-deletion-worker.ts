import {
  type ProjectDeletionAcknowledgement,
  type ProjectDeletionJob,
  projectDeletionJobsSchema,
  projectDeletionServicePath,
} from "pstdio-sync-contracts";

interface WorkerConfig {
  managerUrl: string;
  token: string;
  deleteProject: (job: ProjectDeletionJob, signal: AbortSignal) => Promise<void>;
  request?: (request: Request) => Promise<Response>;
}

export const createProjectDeletionWorker = ({ managerUrl, token, deleteProject, request = fetch }: WorkerConfig) => {
  const url = new URL(managerUrl);
  url.pathname = url.pathname.replace(/\/+$/, "") + projectDeletionServicePath;
  const send = (init: RequestInit) =>
    request(
      new Request(url.href, {
        ...init,
        redirect: "error",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      }),
    );
  const requireSuccess = async (response: Response) => {
    if (response.ok) return response;
    await response.body?.cancel();
    throw new Error("Project deletion handoff unavailable");
  };
  return async (signal: AbortSignal) => {
    const jobs = projectDeletionJobsSchema.parse(await (await requireSuccess(await send({ signal }))).json());
    for (const job of jobs) {
      const { delivery, ...scope } = job;
      let acknowledgement: ProjectDeletionAcknowledgement;
      try {
        await deleteProject(job, signal);
        acknowledgement = { ...scope, result: "purged", writeBarrier: true };
      } catch {
        signal.throwIfAborted();
        acknowledgement = { ...scope, delivery, result: "needs-attention" };
      }
      // A lost response must not be interpreted as a failed purge.
      await (
        await requireSuccess(await send({ method: "POST", body: JSON.stringify(acknowledgement), signal }))
      ).body?.cancel();
    }
  };
};
