import { command, until } from "./process";
import type { Actor, Pair } from "./types";

export const kube = (pair: Pair, args: string[], input?: string | Uint8Array) =>
  command([pair.kubectl, "--namespace", pair.namespace, ...args], input);
export const exec = (pair: Pair, actor: Actor, args: string[], input?: string | Uint8Array) =>
  kube(pair, ["exec", "-i", actor.pod, "--", ...args], input);
export const request = async <T>(pair: Pair, actor: Actor, path: string, body?: unknown, method?: string) =>
  JSON.parse(
    await exec(
      pair,
      actor,
      ["bun", "/workspace/cloud-team/repo/scripts/dev/cloud-team/actor.ts"],
      JSON.stringify({ path, body, method: method ?? (body === undefined ? "GET" : "POST") }),
    ),
  ) as {
    status: number;
    body: T;
  };
export const api = async <T>(pair: Pair, actor: Actor, path: string, body?: unknown, method?: string) => {
  const result = await request<T>(pair, actor, path, body, method);
  if (result.status < 200 || result.status >= 300)
    throw new Error(`${path}: HTTP ${result.status} ${JSON.stringify(result.body)}`);
  return result.body;
};
export const control = async <T>(pair: Pair, path: string, body: unknown) =>
  JSON.parse(
    await exec(
      pair,
      pair.owner!,
      ["bun", "/workspace/cloud-team/repo/scripts/dev/cloud-team/actor.ts"],
      JSON.stringify({ control: true, path, body, method: "POST" }),
    ),
  ) as T;

export const provision = async (pair: Pair, secrets: { database: string; access: string; secret: string }) => {
  const labels = { "pstdio.cloud-team-run": pair.id };
  const metadata = (name: string) => ({ name, labels });
  const secretName = `${pair.name}-credentials`;
  const fromSecret = (name: string, key: string) => ({ name, valueFrom: { secretKeyRef: { name: secretName, key } } });
  const documents = [
    { apiVersion: "v1", kind: "Secret", metadata: metadata(secretName), stringData: secrets },
    {
      apiVersion: "v1",
      kind: "Service",
      metadata: metadata(pair.name),
      spec: {
        selector: labels,
        ports: [
          { name: "postgres", port: 5432 },
          { name: "objects", port: 9000 },
        ],
      },
    },
    {
      apiVersion: "networking.k8s.io/v1",
      kind: "NetworkPolicy",
      metadata: metadata(`${pair.name}-storage`),
      spec: {
        podSelector: { matchLabels: labels },
        policyTypes: ["Ingress"],
        ingress: [
          {
            from: [
              {
                podSelector: { matchLabels: { "pstdio.cloud-team-actor": pair.id, "pstdio.cloud-team-role": "owner" } },
              },
            ],
            ports: [5432, 9000].map((port) => ({ protocol: "TCP", port })),
          },
        ],
      },
    },
    {
      apiVersion: "batch/v1",
      kind: "Job",
      metadata: metadata(pair.name),
      spec: {
        activeDeadlineSeconds: Math.max(1, Math.floor((Date.parse(pair.deadline) - Date.now()) / 1000)),
        ttlSecondsAfterFinished: 300,
        backoffLimit: 0,
        template: {
          metadata: { labels },
          spec: {
            restartPolicy: "Never",
            automountServiceAccountToken: false,
            containers: [
              {
                name: "postgres",
                image: "postgres:16-alpine",
                env: [
                  { name: "POSTGRES_USER", value: "team_test" },
                  { name: "POSTGRES_DB", value: "team_test" },
                  fromSecret("POSTGRES_PASSWORD", "database"),
                ],
                resources: { requests: { cpu: "100m", memory: "128Mi" }, limits: { memory: "512Mi" } },
                readinessProbe: { exec: { command: ["pg_isready", "-U", "team_test"] }, periodSeconds: 2 },
              },
              {
                name: "objects",
                image: "rustfs/rustfs:1.0.1",
                args: ["/data"],
                env: [
                  fromSecret("RUSTFS_ACCESS_KEY", "access"),
                  fromSecret("RUSTFS_SECRET_KEY", "secret"),
                  { name: "RUSTFS_CONSOLE_ENABLE", value: "false" },
                  { name: "RUSTFS_OBS_LOG_DIRECTORY", value: "/logs" },
                ],
                resources: { requests: { cpu: "100m", memory: "256Mi" }, limits: { memory: "1Gi" } },
                readinessProbe: { httpGet: { path: "/health", port: 9000 }, periodSeconds: 2 },
              },
            ],
          },
        },
      },
    },
  ];
  await kube(pair, ["create", "-f", "-"], JSON.stringify({ apiVersion: "v1", kind: "List", items: documents }));
  await kube(pair, [
    "wait",
    "--for=condition=Ready",
    "pod",
    "-l",
    `pstdio.cloud-team-run=${pair.id}`,
    "--timeout=180s",
  ]);
};

export const findActor = async (pair: Pair, workspaceId: string, runId?: string) => {
  const pod = await until("Cloud workspace pod", async () => {
    const result = JSON.parse(
      await kube(pair, ["get", "pods", "-l", `pocketcoder.workspace=${workspaceId}`, "-o", "json"]),
    );
    return result.items.find((item: { status: { phase: string } }) => item.status.phase === "Running")?.metadata.name as
      | string
      | undefined;
  });
  return { workspaceId, runId, pod };
};

export const exposeServices = (pair: Pair) =>
  kube(
    pair,
    ["create", "-f", "-"],
    JSON.stringify({
      apiVersion: "v1",
      kind: "Service",
      metadata: { name: `${pair.name}-apps`, labels: { "pstdio.cloud-team-run": pair.id } },
      spec: {
        selector: { "pocketcoder.workspace": pair.owner!.workspaceId },
        ports: [
          { name: "manager", port: 8443 },
          { name: "relay", port: 8444 },
        ],
      },
    }),
  );

// GKE ipBlock egress rules do not admit Pod traffic. Allow only this run's explicit peers.
export const configureActorNetwork = async (pair: Pair, actor: Actor, role: "owner" | "member") => {
  await kube(pair, ["label", "pod", actor.pod, `pstdio.cloud-team-actor=${pair.id}`, `pstdio.cloud-team-role=${role}`]);
  const owner = { "pstdio.cloud-team-actor": pair.id, "pstdio.cloud-team-role": "owner" };
  const podPorts = [8443, 8444].map((port) => ({ protocol: "TCP", port }));
  await kube(
    pair,
    ["create", "-f", "-"],
    JSON.stringify({
      apiVersion: "networking.k8s.io/v1",
      kind: "NetworkPolicy",
      metadata: { name: `${pair.name}-${role}`, labels: { "pstdio.cloud-team-run": pair.id } },
      spec: {
        podSelector: { matchLabels: { "pocketcoder.workspace": actor.workspaceId } },
        policyTypes: ["Ingress", "Egress"],
        egress: [
          { to: [{ podSelector: { matchLabels: owner } }], ports: podPorts },
          ...(role === "owner"
            ? [
                {
                  to: [{ podSelector: { matchLabels: { "pstdio.cloud-team-run": pair.id } } }],
                  ports: [5432, 9000].map((port) => ({ protocol: "TCP", port })),
                },
              ]
            : []),
        ],
        ingress:
          role === "owner"
            ? [{ from: [{ podSelector: { matchLabels: { "pstdio.cloud-team-actor": pair.id } } }], ports: podPorts }]
            : [],
      },
    }),
  );
};

export const assertActorReservation = async (actor: Actor) => {
  const runs = JSON.parse(await command(["pst", "pocketcoder.remote-testing", "runs", "list"])) as Array<{
    environmentId: string;
    runId: string;
    status: string;
  }>;
  const environments = JSON.parse(
    await command(["pst", "pocketcoder.remote-testing", "environments", "list"]),
  ) as Array<{ id: string; busy: boolean }>;
  const environment = environments.find((item) => item.id === actor.workspaceId);
  const own = runs.find((run) => run.runId === actor.runId && run.environmentId === actor.workspaceId);
  const conflict = runs.some(
    (run) => run.environmentId === actor.workspaceId && run.status === "running" && run.runId !== actor.runId,
  );
  // The companion exposes only recent runs. Absence never proves that a busy workspace is free.
  if (conflict || (environment?.busy && own?.status !== "running"))
    throw new Error(`Cannot prove ownership of busy workspace ${actor.workspaceId}; leaving it untouched`);
  return { holding: Boolean(environment?.busy && own?.status === "running") };
};
export const assertPairReservations = async (pair: Pair) => {
  for (const actor of [pair.owner!, pair.member!])
    if (!(await assertActorReservation(actor)).holding)
      throw new Error(`Workspace ${actor.workspaceId} lost its provable companion reservation`);
};
