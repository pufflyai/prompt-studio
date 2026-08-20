import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeExtensionWithDependency = (root: string) => {
  const extDir = join(root, "extensions", "dep-ext");
  const depDist = join(extDir, "node_modules", "test-dep", "dist");
  const sdkDir = join(extDir, "node_modules", "@pstdio", "sdk");
  const sourceDir = join(extDir, "src");
  mkdirSync(depDist, { recursive: true });
  mkdirSync(sdkDir, { recursive: true });
  mkdirSync(sourceDir, { recursive: true });

  // Match the shape that failed in compiled binaries: an extension importing a
  // bare dependency subpath resolved through package exports.
  writeFileSync(
    join(extDir, "node_modules", "test-dep", "package.json"),
    JSON.stringify({
      name: "test-dep",
      version: "1.0.0",
      type: "module",
      exports: { "./feature": "./dist/feature.js" },
    }),
  );
  writeFileSync(join(depDist, "feature.js"), 'export const marker = "loaded-via-exports-subpath";\n');

  writeFileSync(
    join(sdkDir, "package.json"),
    JSON.stringify({
      name: "@pstdio/sdk",
      version: "0.0.0-test",
      type: "module",
      exports: { "./extensions": "./extensions.js" },
    }),
  );
  writeFileSync(
    join(sdkDir, "extensions.js"),
    'export const packageAsset = (path, baseUrl) => ({ kind: "package-asset", path, baseUrl });\n',
  );
  writeFileSync(join(sourceDir, "template.md"), "# Packaged asset template\n");
  writeFileSync(
    join(sourceDir, "contribution.ts"),
    `
      import { packageAsset } from "@pstdio/sdk/extensions";

      export const templates = {
        packagedAsset: {
          title: "Packaged Asset",
          type: "ticket",
          source: packageAsset("./template.md", import.meta.url),
        },
      };
    `,
  );

  writeFileSync(
    join(extDir, "package.json"),
    JSON.stringify({
      name: "dep-ext",
      version: "1.0.0",
      publisher: "test",
      main: "./extension.ts",
      type: "module",
      engines: { pstdio: EXTENSION_API_VERSION },
      dependencies: { "@pstdio/sdk": "0.0.0-test", "test-dep": "1.0.0" },
    }),
  );
  writeFileSync(
    join(extDir, "extension.ts"),
    'import { marker } from "test-dep/feature";\nimport { templates } from "./src/contribution";\nif (typeof marker !== "string") throw new Error("dependency not loaded");\nexport default { templates };\n',
  );

  return extDir;
};

export const writeExtensionInstallEnvironmentProbe = (root: string) => {
  const extDir = join(root, "extension-sources", "install-env-probe");
  const recorderDir = join(extDir, "install-env-recorder");
  mkdirSync(extDir, { recursive: true });
  mkdirSync(recorderDir, { recursive: true });

  writeFileSync(
    join(extDir, "package.json"),
    JSON.stringify({
      name: "install-env-probe",
      version: "1.0.0",
      publisher: "test",
      main: "./extension.ts",
      type: "module",
      engines: { pstdio: EXTENSION_API_VERSION },
      dependencies: { "install-env-recorder": "file:./install-env-recorder" },
      trustedDependencies: ["install-env-recorder"],
    }),
  );
  writeFileSync(join(extDir, "extension.ts"), "export default {};\n");
  writeFileSync(
    join(recorderDir, "package.json"),
    JSON.stringify({
      name: "install-env-recorder",
      version: "1.0.0",
      scripts: { postinstall: "bun ./record-install-env.ts" },
    }),
  );
  writeFileSync(
    join(recorderDir, "record-install-env.ts"),
    `await Bun.write(
  String(process.env.HOME) + "/install-env.json",
  JSON.stringify({
    httpsProxy: process.env.HTTPS_PROXY ?? null,
    npmRegistry: process.env.NPM_CONFIG_REGISTRY ?? null,
    npmToken: process.env.NPM_TOKEN ?? null,
    sourceControlToken: process.env.GITHUB_TOKEN ?? null,
    providerKey: process.env.OPENAI_API_KEY ?? null,
  }),
);
`,
  );

  return extDir;
};
