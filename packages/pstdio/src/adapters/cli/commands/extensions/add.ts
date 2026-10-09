import { PstdioApiError } from "@pstdio/sdk/client";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { findProjectRoot, readConfig } from "@/features/config/config";
import { ensureApi } from "@/features/ensure-api";
import { localExtensionSourceRequest } from "@/features/extensions/local-source-request";
import { isLocalExtensionSource, type uploadExtensionSource } from "@/features/extensions/upload-source";
import { type ExtensionsAddArgs, formatInstallOutput } from "./shared";

export const command = "add <source>";
export const describe = "Install editable extension source";

export const builder = (yargs: Argv) =>
  yargs
    .positional("source", {
      type: "string",
      demandOption: true,
      describe: "Extension name or local folder path",
    })
    .option("name", {
      type: "string",
      describe: "Install folder name",
    })
    .option("force", {
      type: "boolean",
      default: false,
      describe: "Replace an existing install",
    })
    .option("skip-install", {
      type: "boolean",
      default: false,
      describe: "Skip dependency installation",
    })
    .option("branch", {
      type: "string",
      describe: "Install from a branch instead of this release (for extension development)",
    });

type Deps = {
  cwd: () => string;
  ensureApi: typeof ensureApi;
  findProjectRoot: typeof findProjectRoot;
  readConfig: typeof readConfig;
  install: ReturnType<typeof apiClient>["extensions"]["install"];
  upload: (
    source: string,
    options: Parameters<typeof uploadExtensionSource>[1],
    projectId: string,
  ) => Promise<Awaited<ReturnType<typeof localExtensionSourceRequest>>>;
  log: (message: string) => void;
};
const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  ensureApi,
  findProjectRoot,
  readConfig,
  install: (...args) => apiClient().extensions.install(...args),
  upload: (source, options, projectId) => localExtensionSourceRequest(projectId, source, options ?? {}),
  log: console.log,
};

const resolveLinkedProject = (deps: Pick<Deps, "cwd" | "findProjectRoot" | "readConfig">) => {
  const root = deps.findProjectRoot(deps.cwd());
  if (!root) return null;
  const projectId = deps.readConfig(root)?.project_id;
  return projectId ? { projectId, root } : null;
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsAddArgs>) => {
    const project = resolveLinkedProject(deps);
    if (!project)
      throw new Error("Run `pst extensions add` inside a linked project. Create or link the project first.");
    await deps.ensureApi(process.env.PSTDIO_API_URL);
    const options = { installName: argv.name, force: argv.force, skipInstall: argv["skip-install"] };
    try {
      const result = await deps.install(
        project.projectId,
        isLocalExtensionSource(argv.source)
          ? await deps.upload(argv.source, options, project.projectId)
          : { ...options, source: { kind: "catalog", name: argv.source, ref: argv.branch } },
      );
      deps.log(formatInstallOutput(result.source, project.projectId));
    } catch (error) {
      if (error instanceof PstdioApiError && error.status === 409) {
        deps.log(error.message);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  };
export const handler = createHandler();
