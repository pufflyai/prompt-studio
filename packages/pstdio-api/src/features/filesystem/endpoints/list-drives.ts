import { stat } from "node:fs/promises";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";

export const listDrivesRoute = createRoute({
  method: "get",
  path: "/filesystem/drives",
  description: "List drive-letter roots on the runtime host. Other platforms return an empty list.",
  tags: ["Filesystem"],
  responses: {
    200: {
      description: "Host drive roots.",
      content: {
        "application/json": {
          schema: z.object({ drives: z.array(z.object({ name: z.string(), path: z.string() })) }),
        },
      },
    },
  },
});

export const listDrivesHandler: AppRouteHandler<typeof listDrivesRoute> = async (c) => {
  if (process.platform !== "win32") return c.json({ drives: [] }, 200);
  const roots = Array.from({ length: 26 }, (_, index) => `${String.fromCharCode(65 + index)}:\\`);
  const drives = await Promise.all(
    roots.map(async (path) => {
      try {
        if ((await stat(path)).isDirectory()) return { name: path.slice(0, 2), path };
      } catch {
        // Unassigned letters and disconnected drives have no readable root.
      }
      return undefined;
    }),
  );
  return c.json({ drives: drives.filter((drive) => drive !== undefined) }, 200);
};
