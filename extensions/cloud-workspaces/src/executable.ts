import { access, constants } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

const executable = async (path: string) =>
  access(path, constants.X_OK).then(
    () => true,
    () => false,
  );

export async function resolveExecutable(input: { binary?: string; projectRoot?: string; searchPath?: string }) {
  const requested = input.binary?.trim();
  const searchPath = input.searchPath ?? process.env.PATH;
  if (requested && requested !== "pocketcoder") {
    const candidate =
      isAbsolute(requested) || requested.includes("/")
        ? resolve(input.projectRoot ?? process.cwd(), requested)
        : Bun.which(requested, { PATH: searchPath });
    if (candidate && (await executable(candidate))) return candidate;
    throw new Error(
      `PocketCoder executable not found: ${requested}. Run bun run build:native or choose an executable path.`,
    );
  }
  if (input.projectRoot) {
    const local = join(input.projectRoot, "out/native/pocketcoder");
    if (await executable(local)) return local;
  }
  const installed = Bun.which("pocketcoder", { PATH: searchPath });
  if (installed) return installed;
  throw new Error(
    "PocketCoder executable not found. Run bun run build:native in this project or choose an executable path.",
  );
}
