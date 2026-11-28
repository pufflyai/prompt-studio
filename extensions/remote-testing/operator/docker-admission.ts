// Operator-only admission: an exact image allowlist equips trusted test Jobs.
// General workspace templates cannot opt themselves into privileged Docker.
type Container = {
  name: string;
  image: string;
  volumeMounts?: { name: string; mountPath: string; readOnly?: boolean; subPath?: string }[];
};
export type TestPod = {
  metadata?: { labels?: Record<string, string>; ownerReferences?: { kind: string; controller?: boolean }[] };
  spec: {
    runtimeClassName?: string;
    nodeSelector?: Record<string, string>;
    tolerations?: unknown[];
    containers: Container[];
    initContainers?: unknown[];
    volumes?: unknown[];
  };
};
export type DockerPolicy = { images: string[]; daemonImage: string; nodeSelector: Record<string, string> };
export function dockerPatch(pod: TestPod, policy: DockerPolicy) {
  const scheduling = [
    { op: "add", path: "/spec/nodeSelector", value: { ...pod.spec.nodeSelector, ...policy.nodeSelector } },
    {
      op: "add",
      path: "/spec/tolerations",
      value: [
        ...(pod.spec.tolerations ?? []),
        { key: "pocketcoder.dev/trusted-tests", operator: "Equal", value: "true", effect: "NoSchedule" },
      ],
    },
  ];
  // Image evidence is read on the admitted workspace's node. The provider still
  // sends its default pool selector, so align probes without giving them Docker.
  if (
    pod.metadata?.labels?.["pocketcoder.dev/workload-probe"] === "true" &&
    pod.spec.containers.some((container) => container.name === "probe" && policy.images.includes(container.image))
  )
    return scheduling;
  const workspace = pod.spec.containers.find((container) => container.name === "workspace");
  if (!workspace || !policy.images.includes(workspace.image)) return [];
  if (
    !pod.metadata?.labels?.["pocketcoder.workspace"] ||
    !pod.metadata.ownerReferences?.some((owner) => owner.kind === "Job" && owner.controller)
  ) {
    throw new Error("Docker test runtime requires a controller-owned workspace Job.");
  }
  if (pod.spec.runtimeClassName) throw new Error("Docker test runtime requires native Linux nodes.");
  const mount = workspace.volumeMounts?.find((volume) => volume.mountPath === "/workspace");
  if (!mount || mount.readOnly || mount.subPath)
    throw new Error("Docker requires the complete writable workspace volume.");
  const socket = "unix:///workspace/.docker/run/docker.sock";
  return [
    ...scheduling,
    {
      op: "add",
      path: "/spec/volumes",
      value: [...(pod.spec.volumes ?? []), { name: "test-docker-data", emptyDir: { sizeLimit: "30Gi" } }],
    },
    {
      op: "add",
      path: "/spec/initContainers",
      value: [
        ...(pod.spec.initContainers ?? []),
        {
          name: "test-docker",
          image: policy.daemonImage,
          restartPolicy: "Always",
          command: [
            "sh",
            "-ec",
            "addgroup -g 10001 workspace; mkdir -p /workspace/.docker/run; chown 10001:10001 /workspace/.docker /workspace/.docker/run; exec dockerd --host=" +
              socket +
              " --group=workspace --data-root=/docker-data --storage-driver=overlay2 --mtu=1400",
          ],
          env: [{ name: "DOCKER_TLS_CERTDIR", value: "" }],
          securityContext: {
            privileged: true,
            runAsUser: 0,
            runAsGroup: 0,
            runAsNonRoot: false,
            readOnlyRootFilesystem: false,
            allowPrivilegeEscalation: true,
            seccompProfile: { type: "Unconfined" },
          },
          resources: {
            requests: { cpu: "500m", memory: "512Mi", "ephemeral-storage": "32Gi" },
            limits: { cpu: "4", memory: "4Gi", "ephemeral-storage": "32Gi" },
          },
          startupProbe: {
            exec: { command: ["docker", `--host=${socket}`, "info"] },
            periodSeconds: 2,
            failureThreshold: 60,
          },
          volumeMounts: [mount, { name: "test-docker-data", mountPath: "/docker-data" }],
        },
      ],
    },
  ];
}

if (import.meta.main) {
  const policy = (await Bun.file("/config/policy.json").json()) as DockerPolicy;
  if (
    !policy.images.length ||
    [...policy.images, policy.daemonImage].some((image) => !/@sha256:[a-f0-9]{64}$/.test(image)) ||
    !Object.keys(policy.nodeSelector).length
  )
    throw new Error("Docker policy requires digest-pinned images and a trusted node pool.");
  Bun.serve({
    port: 8443,
    tls: { cert: Bun.file("/tls/tls.crt"), key: Bun.file("/tls/tls.key") },
    async fetch(request) {
      if (new URL(request.url).pathname === "/healthz") return new Response("ok");
      const review = (await request.json()) as { request: { uid: string; object: TestPod } };
      const response: Record<string, unknown> = { uid: review.request.uid, allowed: true };
      try {
        const patch = dockerPatch(review.request.object, policy);
        if (patch.length)
          Object.assign(response, {
            patchType: "JSONPatch",
            patch: Buffer.from(JSON.stringify(patch)).toString("base64"),
          });
      } catch (error) {
        Object.assign(response, {
          allowed: false,
          status: { message: error instanceof Error ? error.message : String(error) },
        });
      }
      return Response.json({ apiVersion: "admission.k8s.io/v1", kind: "AdmissionReview", response });
    },
  });
}
