import { mkdir, realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";

const errorSchema = z.object({ error: z.string() });

export const createDirectoryRoute = createRoute({
  method: "post",
  path: "/filesystem/directories",
  tags: ["Filesystem"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z
            .object({
              parent_path: z.string().min(1),
              name: z
                .string()
                .trim()
                .min(1)
                .refine(
                  (name) =>
                    name !== "." && name !== ".." && !/[\\/]/.test(name) && !name.includes(String.fromCharCode(0)),
                  "Enter one folder name.",
                ),
            })
            .strict(),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Directory created.",
      content: { "application/json": { schema: z.object({ path: z.string() }) } },
    },
    400: { description: "Invalid folder or parent.", content: { "application/json": { schema: errorSchema } } },
    409: { description: "The name already exists.", content: { "application/json": { schema: errorSchema } } },
  },
});

export const createDirectoryHandler: AppRouteHandler<typeof createDirectoryRoute> = async (c) => {
  const { parent_path, name } = c.req.valid("json");
  try {
    const parent = await realpath(parent_path);
    if (!(await stat(parent)).isDirectory()) return c.json({ error: "The parent must be an existing directory." }, 400);
    const path = join(parent, name);
    await mkdir(path);
    return c.json({ path }, 201);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") return c.json({ error: "A file or folder with that name already exists." }, 409);
    return c.json({ error: "Unable to create the folder. Check the parent path and write permission." }, 400);
  }
};
