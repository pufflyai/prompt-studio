import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, join } from "node:path";

type PackageManifest = {
  files?: string[];
  name: string;
  version: string;
  [key: string]: unknown;
};

type PackedWorkspacePackage = {
  manifest: PackageManifest;
  tarball: Buffer;
  tarballName: string;
};

const safePackageName = (name: string) => name.replaceAll("@", "").replaceAll("/", "-");

const packWorkspacePackage = (packagePath: string, outputRoot: string): PackedWorkspacePackage => {
  const manifest = JSON.parse(readFileSync(join(packagePath, "package.json"), "utf8")) as PackageManifest;
  const packageRoot = join(outputRoot, safePackageName(manifest.name), "package");
  mkdirSync(packageRoot, { recursive: true });
  cpSync(join(packagePath, "package.json"), join(packageRoot, "package.json"));

  for (const file of manifest.files ?? []) {
    cpSync(join(packagePath, file), join(packageRoot, file), { recursive: true });
  }

  const tarballName = `${safePackageName(manifest.name)}-${manifest.version}.tgz`;
  const tarballPath = join(outputRoot, tarballName);
  const packed = spawnSync("tar", ["-czf", tarballPath, "-C", dirname(packageRoot), basename(packageRoot)], {
    encoding: "utf8",
  });
  if (packed.status !== 0) {
    throw new Error(`Failed to pack ${manifest.name}: ${packed.stderr.trim() || packed.stdout.trim()}`);
  }

  return { manifest, tarball: readFileSync(tarballPath), tarballName };
};

export const packWorkspacePackageTarball = (packagePath: string, outputRoot: string) => {
  mkdirSync(outputRoot, { recursive: true });
  const pkg = packWorkspacePackage(packagePath, outputRoot);
  return join(outputRoot, pkg.tarballName);
};

const packageMetadata = (pkg: PackedWorkspacePackage, origin: string) => {
  const integrity = createHash("sha512").update(pkg.tarball).digest("base64");
  const shasum = createHash("sha1").update(pkg.tarball).digest("hex");
  const version = {
    ...pkg.manifest,
    dist: {
      integrity: `sha512-${integrity}`,
      shasum,
      tarball: `${origin}/${pkg.manifest.name}/-/${pkg.tarballName}`,
    },
  };

  return {
    name: pkg.manifest.name,
    "dist-tags": { latest: pkg.manifest.version },
    versions: { [pkg.manifest.version]: version },
  };
};

export const startLocalWorkspaceRegistry = async (input: {
  configPath: string;
  outputRoot: string;
  packagePaths: string[];
}) => {
  const registryRoot = join(input.outputRoot, "workspace-registry");
  mkdirSync(registryRoot, { recursive: true });
  const packages = input.packagePaths.map((packagePath) => packWorkspacePackage(packagePath, registryRoot));
  const packagesByName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));
  const tarballsByPath = new Map(packages.map((pkg) => [`${pkg.manifest.name}/-/${pkg.tarballName}`, pkg.tarball]));

  let origin = "";
  const server = createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url ?? "/", origin).pathname).replace(/^\/+/, "");
    const pkg = packagesByName.get(requestPath);
    if (pkg) {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(packageMetadata(pkg, origin)));
      return;
    }

    const tarball = tarballsByPath.get(requestPath);
    if (tarball) {
      response.setHeader("content-type", "application/octet-stream");
      response.end(tarball);
      return;
    }

    response.statusCode = 404;
    response.end("Not found");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Local workspace registry did not start");
  origin = `http://127.0.0.1:${address.port}`;
  writeFileSync(input.configPath, `@pstdio:registry=${origin}/\n`);

  return {
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      rmSync(registryRoot, { recursive: true, force: true });
    },
  };
};
