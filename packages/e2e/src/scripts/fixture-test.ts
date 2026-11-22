import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hostFixtureSources as sources } from "../fixtures/host-fixtures";
import { type APIRequestContext, test as base, expect } from "./playwright-test";

const installed = new Map<
  string,
  {
    targetPath: string;
    metadata: { id: string; name: string; displayName: string; version: string };
    manifest: Record<string, unknown>;
    sourceHash: string;
  }
>();
const installing = new Map<string, Promise<NonNullable<ReturnType<typeof installed.get>>>>();
// Each import opts its scenarios into one small installable input. Other projects use production defaults only.
export const fixtureTest = (kind: keyof typeof sources, parent = base) =>
  parent.extend({
    request: async ({ request }, use) => {
      const install = async (projectId: string, origin: string) => {
        const source = sources[kind];
        const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
        const key = `${origin}:${kind}`;
        const pending = installing.get(key);
        const saved = installed.get(key);
        if (saved || pending) {
          const previous = saved ?? (await pending!);
          const response = await request.post(
            `${origin}/v1/projects/${projectId}/extensions/installed/${manifest.name}/enable`,
            {
              data: {
                extensionId: previous.metadata.id,
                name: previous.metadata.name,
                displayName: previous.metadata.displayName,
                version: previous.metadata.version,
                manifest: previous.manifest,
                sourceHash: previous.sourceHash,
                sourceKind: "local_path",
                sourcePath: previous.targetPath,
                sourceRef: null,
              },
            },
          );
          expect(response.ok(), await response.text()).toBe(true);
          return;
        }
        const form = new FormData();
        form.append("kind", "upload");
        form.append("folderName", manifest.name);
        form.append("installName", manifest.name);
        form.append("force", "true");
        const add = (directory: string, prefix = "") => {
          for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (["node_modules", "dist", "fixtures"].includes(entry.name)) continue;
            const path = join(directory, entry.name);
            const name = prefix + entry.name;
            if (entry.isDirectory()) add(path, `${name}/`);
            else form.append("files", new File([readFileSync(path)], name), name);
          }
        };
        add(source);
        const preparation = (async () => {
          const response = await request.post(`${origin}/v1/projects/${projectId}/extensions/install`, {
            multipart: form,
          });
          expect(response.ok(), await response.text()).toBe(true);
          const source = (await response.json()).source;
          installed.set(key, source);
          return source;
        })();
        installing.set(key, preparation);
        try {
          await preparation;
        } finally {
          installing.delete(key);
        }
      };
      const proxy = new Proxy(request, {
        get(target, key) {
          if (key === "post")
            return async (...args: Parameters<APIRequestContext["post"]>) => {
              const response = await target.post(...args);
              if (new URL(response.url()).pathname === "/v1/projects" && response.status() === 201)
                await install((await response.json()).id, new URL(response.url()).origin);
              return response;
            };
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      await use(proxy);
    },
  });
