import { expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createExtensionInstallations } from "../../../services/extension-installations";
import type { AppBindings } from "../../../types";
import {
  installationJobsHandler,
  installationJobsRoute,
  retryInstallationJobHandler,
  retryInstallationJobRoute,
} from "./installation-jobs";

test("keeps progress and retry available when optional catalog metadata is unavailable", async () => {
  const previous = process.env.PSTDIO_EXTENSION_CATALOG;
  process.env.PSTDIO_EXTENSION_CATALOG = `/nonexistent/catalog-${crypto.randomUUID()}.json`;
  const jobs = createExtensionInstallations();
  let attempts = 0;
  const job = jobs.enqueue({ installName: "local-tool", displayName: "Local tool" }, async () => {
    if (++attempts === 1) throw new Error("Try again");
  });
  await jobs.wait(job.id).catch(() => {});
  const deps = {
    extensionInstallations: jobs,
  };
  const app = new OpenAPIHono<AppBindings>();
  app.openapi(installationJobsRoute, installationJobsHandler(deps));
  app.openapi(retryInstallationJobRoute, retryInstallationJobHandler(deps));
  try {
    const response = await app.request("/extension-installations");
    expect(response.status).toBe(200);
    expect(await response.json()).toContainEqual(expect.objectContaining({ id: job.id, status: "failed" }));
    expect((await app.request(`/extension-installations/${job.id}/retry`, { method: "POST" })).status).toBe(202);
    await jobs.wait(job.id);
    expect(jobs.list()[0]?.status).toBe("completed");
  } finally {
    if (previous === undefined) delete process.env.PSTDIO_EXTENSION_CATALOG;
    else process.env.PSTDIO_EXTENSION_CATALOG = previous;
    await jobs.dispose();
  }
});
