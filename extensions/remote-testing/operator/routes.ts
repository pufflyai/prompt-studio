import { createHash, timingSafeEqual } from "node:crypto";
import { KITO_LOG_UPLOAD_MAX_SECONDS } from "../src/kito-workflow-limits";

export const basePath = "/v1/kito-workflow";
export const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
export class WorkflowError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Dependencies = {
  keyHash: string;
  verifyKey: (key: string) => Promise<boolean>;
  sign: (method: "GET" | "PUT", object: string, seconds: number) => Promise<string>;
  openPreview: (id: string, key: string) => Promise<{ url: string; expiresAt: string }>;
};
const actions = {
  "upload-source": { method: "PUT", prefix: "sources", suffix: ".tar.gz", max: 300 },
  "read-source": { method: "GET", prefix: "sources", suffix: ".tar.gz", max: 1800 },
  "upload-log": { method: "PUT", prefix: "logs", suffix: ".log", max: KITO_LOG_UPLOAD_MAX_SECONDS },
  "read-log": { method: "GET", prefix: "logs", suffix: ".log", max: 300 },
} as const;

function send(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function storageUrl(request: Request, sign: Dependencies["sign"]) {
  const input = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = input?.action;
  const runId = input?.runId;
  const seconds = input?.seconds;
  if (
    typeof action !== "string" ||
    !Object.hasOwn(actions, action) ||
    typeof runId !== "string" ||
    !uuid.test(runId) ||
    typeof seconds !== "number" ||
    !Number.isInteger(seconds) ||
    seconds < 1
  ) {
    throw new WorkflowError(400, "Expected a supported run object operation.");
  }
  const { method, prefix, suffix, max } = actions[action as keyof typeof actions];
  if (seconds > max) throw new WorkflowError(400, "Requested URL lifetime is too long.");
  return send({ url: await sign(method, prefix + "/" + runId + suffix, seconds) });
}

async function authorized(key: string | undefined, hash: Buffer, verify: Dependencies["verifyKey"]) {
  if (!key || !timingSafeEqual(hash, createHash("sha256").update(key).digest()) || !(await verify(key)))
    throw new WorkflowError(401, "A valid Kito workflow key is required.");
  return key;
}

export function createWorkflowHandler(deps: Dependencies) {
  if (!/^[a-f0-9]{64}$/.test(deps.keyHash)) throw new Error("Expected a workflow key digest.");
  const keyHash = Buffer.from(deps.keyHash, "hex");
  return async (request: Request) => {
    const { pathname } = new URL(request.url);
    if (pathname === "/healthz" && request.method === "GET") return new Response("ok");
    try {
      const key = await authorized(
        request.headers.get("Authorization")?.match(/^Bearer ([^\s]{1,256})$/)?.[1],
        keyHash,
        deps.verifyKey,
      );
      if (pathname === basePath + "/status" && request.method === "GET") return send({ available: true });
      if (pathname === basePath + "/storage/urls" && request.method === "POST") {
        return await storageUrl(request, deps.sign);
      }
      const previewId = pathname.slice((basePath + "/previews/").length);
      if (request.method === "POST" && pathname.startsWith(basePath + "/previews/") && uuid.test(previewId))
        return send(await deps.openPreview(previewId, key));
      throw new WorkflowError(404, "Unknown Kito workflow route.");
    } catch (error) {
      if (error instanceof WorkflowError) return send({ error: { message: error.message } }, error.status);
      console.error("Kito workflow request failed:", error instanceof Error ? error.message : "Unknown error");
      return send({ error: { message: "Kito workflow is temporarily unavailable." } }, 503);
    }
  };
}
