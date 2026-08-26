import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const createTestExtensionSource = (fields: {
  displayName: string;
  installName: string;
  name: string;
  root: string;
  version?: string | null;
}) => {
  const sourcePath = join(fields.root, "extensions", fields.installName);
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify(
      {
        name: fields.name,
        version: fields.version ?? "0.0.0",
        displayName: fields.displayName,
        publisher: "test",
        main: "./extension.ts",
        engines: { pstdio: EXTENSION_API_VERSION },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(sourcePath, "extension.ts"), "export default {};\n");
  return sourcePath;
};

export const createTestScheduledExtensionSource = (fields: {
  displayName: string;
  installName: string;
  name: string;
  root: string;
  scheduleDisabled?: boolean;
  version?: string | null;
}) => {
  const sourcePath = createTestExtensionSource(fields);
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `export default {
  commands: [
    {
      id: "heartbeat",
      ref: { kind: "command", id: "heartbeat" },
      title: "Heartbeat",
      async run(_ctx, _params) {},
    },
  ],
  schedules: [
    {
      id: "heartbeat",
      ref: { kind: "schedule", id: "heartbeat" },
      title: "Heartbeat",
      schedule: "0 3 * * *",
      command: { kind: "command", id: "heartbeat" },${fields.scheduleDisabled ? "\n      disabled: true," : ""}
    },
  ],
};
`,
    "utf8",
  );
  return sourcePath;
};

export const createTestSkillExtensionSource = (fields: {
  displayName: string;
  installName: string;
  name: string;
  root: string;
  skillContent?: string;
  skillDir?: string;
  skillKey?: string;
  version?: string | null;
}) => {
  const sourcePath = createTestExtensionSource(fields);
  const skillDir = fields.skillDir ?? "lab-skill";
  const skillKey = fields.skillKey ?? "lab";
  const skillRoot = join(sourcePath, "skills", skillDir);
  mkdirSync(skillRoot, { recursive: true });
  writeFileSync(join(skillRoot, "SKILL.md"), fields.skillContent ?? "# Lab Skill\n", "utf8");
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `const asset = (path: string) => ({ kind: "package-asset" as const, path, baseUrl: import.meta.url });

export default {
  skills: [
    {
      id: ${JSON.stringify(skillKey)},
      ref: { kind: "skill", id: ${JSON.stringify(skillKey)} },
      title: "Lab Skill",
      source: asset(${JSON.stringify(`./skills/${skillDir}`)}),
    },
  ],
};
`,
    "utf8",
  );
  return sourcePath;
};
