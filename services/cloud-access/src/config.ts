import { z } from "zod";

export const serviceUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.pathname === "/" &&
    (url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))
  );
}, "Use an HTTPS origin (HTTP is allowed only on loopback).");

export const roles = ["dashboard", "runner", "publisher"] as const;
export type Role = (typeof roles)[number];
export const roleScopes: Record<Role, string[]> = {
  dashboard: [
    "templates:read",
    "workspaces:read",
    "workspaces:create",
    "workspaces:cancel",
    "conversations:read",
    "logs:read",
  ],
  runner: [
    "templates:read",
    "workspaces:create",
    "workspaces:read",
    "workspaces:cancel",
    "conversations:read",
    "logs:read",
    "services:relay",
  ],
  publisher: ["templates:write"],
};
export const bindings: Record<Role, { extensionId: string; connectionId: string }> = {
  dashboard: { extensionId: "pocketcoder.pocketcoder", connectionId: "deployed-controller" },
  runner: { extensionId: "pocketcoder.remote-testing", connectionId: "pocketcoder" },
  publisher: { extensionId: "pocketcoder.remote-testing", connectionId: "branch-template-publisher" },
};
export const storageBinding = { extensionId: "pocketcoder.remote-testing", connectionId: "cloud-storage" };
export const allBindings = [...Object.values(bindings), storageBinding];

const manifest = (name: string) =>
  z
    .object({
      metadata: z.object({ name: z.literal(name) }).passthrough(),
      spec: z.object({ version: z.string().min(1) }).passthrough(),
    })
    .passthrough();
export const setupSchema = z.object({
  settings: z.strictObject({
    templateName: z.literal("remote-tests"),
    templateVersion: z.string().min(1),
    testCommand: z.string().min(1),
    timeoutMinutes: z.number().positive().max(480),
    storageBucket: z.string().min(1),
    signerAccount: z.string().min(1),
  }),
  manifests: z.strictObject({ tests: manifest("remote-tests"), preview: manifest("prompt-studio-preview") }),
});
export const configSchema = setupSchema
  .extend({
    controllerUrl: serviceUrl,
    audience: serviceUrl,
    humanAudience: z.string().min(1),
    humans: z
      .array(
        z.strictObject({
          subject: z.string().min(1),
          principalId: z.uuid(),
          roles: z
            .array(z.enum(roles))
            .min(1)
            .default([...roles]),
        }),
      )
      .default([]),
    launchers: z.array(z.string().min(1)).default([]),
    templates: z.array(z.string().min(1).max(128)).min(1).max(100),
    workloadRoles: z.array(z.enum(roles)).min(1).default(["runner", "publisher"]),
    sessionSeconds: z.number().int().min(60).max(3600).default(900),
    maxRunSeconds: z.number().int().min(60).max(86400).default(28800),
    previewHelper: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((config, ctx) => {
    if (config.audience === config.humanAudience)
      ctx.addIssue({ code: "custom", message: "Human and workload audiences must differ." });
    if (
      new Set(config.humans.map((h) => h.subject)).size !== config.humans.length ||
      new Set(config.humans.map((h) => h.principalId)).size !== config.humans.length
    )
      ctx.addIssue({ code: "custom", message: "People need unique subjects and principals." });
    for (const list of [config.workloadRoles, ...config.humans.map((h) => h.roles)])
      if (new Set(list).size !== list.length) ctx.addIssue({ code: "custom", message: "Roles must be unique." });
  });
export type AccessConfig = z.infer<typeof configSchema>;
export const parseConfig = (value: unknown) => configSchema.parse(value);

export const instanceSchema = z.strictObject({
  project_id: z.string().min(1),
  project_number: z.union([z.number(), z.string()]).transform(String),
  zone: z.string().min(1),
  instance_id: z.string().min(1),
});
export const runInputSchema = z.strictObject({
  runId: z.uuid(),
  subject: z.string().min(1).max(256),
  deadline: z.iso.datetime(),
  instance: instanceSchema.optional(),
});
export type RunInput = z.infer<typeof runInputSchema>;

export const sessionSchema = setupSchema.extend({
  controllerUrl: serviceUrl,
  expiresAt: z.iso.datetime(),
  renewAt: z.iso.datetime(),
  preview: z.boolean(),
  credentials: z
    .array(
      z.strictObject({
        extensionId: z.string(),
        connectionId: z.string(),
        secret: z.string().min(1),
        baseUrl: serviceUrl.optional(),
      }),
    )
    .min(1)
    .max(4),
});
export type AccessSession = z.infer<typeof sessionSchema>;

export class AccessError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
