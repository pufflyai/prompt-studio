import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { FilesystemRouteDeps } from "../deps";

const listDirectoryQuerySchema = z
  .object({
    path: z.string().optional(),
  })
  .strict();

const directoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDirectory: z.boolean(),
});

const listDirectoryResponseSchema = z.object({
  currentPath: z.string(),
  entries: z.array(directoryEntrySchema),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

const resolveDirectoryPath = (path?: string) => {
  const trimmedPath = path?.trim();

  if (!trimmedPath) {
    return homedir();
  }

  if (trimmedPath === "~") {
    return homedir();
  }

  if (trimmedPath.startsWith("~/")) {
    return join(homedir(), trimmedPath.slice(2));
  }

  return resolve(trimmedPath);
};

export const listDirectoryRoute = createRoute({
  method: "get",
  path: "/filesystem/list",
  description: "List files and folders for a directory path.",
  tags: ["Filesystem"],
  request: {
    query: listDirectoryQuerySchema,
  },
  responses: {
    200: {
      description: "Directory listing.",
      content: { "application/json": { schema: listDirectoryResponseSchema } },
    },
    400: {
      description: "Invalid directory path.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const listDirectoryHandler = (_deps: FilesystemRouteDeps): AppRouteHandler<typeof listDirectoryRoute> => {
  return async (c) => {
    const { path } = c.req.valid("query");
    let targetDirectory = resolveDirectoryPath(path);

    if (!existsSync(targetDirectory)) {
      return c.json({ error: `Directory not found: ${targetDirectory}` }, 400);
    }

    let directoryStats: ReturnType<typeof statSync>;

    try {
      targetDirectory = realpathSync(targetDirectory);
      directoryStats = statSync(targetDirectory);
    } catch {
      return c.json({ error: `Unable to load directory: ${targetDirectory}` }, 400);
    }

    if (!directoryStats.isDirectory()) {
      return c.json({ error: `Path is not a directory: ${targetDirectory}` }, 400);
    }

    try {
      const entries = readdirSync(targetDirectory, { withFileTypes: true }).map((entry) => {
        const entryPath = join(targetDirectory, entry.name);
        let isDirectory = entry.isDirectory();
        if (entry.isSymbolicLink()) {
          try {
            isDirectory = statSync(entryPath).isDirectory();
          } catch {}
        }

        return {
          name: entry.name,
          path: entryPath,
          isDirectory,
        };
      });

      return c.json(
        {
          currentPath: targetDirectory,
          entries,
        },
        200,
      );
    } catch {
      return c.json({ error: `Unable to load directory: ${targetDirectory}` }, 400);
    }
  };
};
