import { createHash } from "node:crypto";
import { checked, googleClient, kubernetesClient } from "./cloud";
import { uuid, WorkflowError } from "./routes";

export type PreviewIngress = {
  project: string;
  namespace: string;
  domain: string;
  certificateMap: string;
  gateway: string;
  securityPolicy: string;
};
type Pod = { metadata: { name: string; uid: string; deletionTimestamp?: string }; status: { phase: string } };
type Pods = { items: Pod[] };
type Operation = { name?: string; done?: boolean; error?: { code: number } };
type Certificates = { certificates?: { name: string; labels: Record<string, string> }[]; nextPageToken?: string };
const manager = "pstdio-isolated-preview";
const labels = { "app.kubernetes.io/managed-by": manager };
const certificateName = (id: string) => "pstdio-preview-" + id;
const expiryLabel = "preview-expires";

export function createPreviewRoutes(config: PreviewIngress, kube = kubernetesClient(), google = googleClient()) {
  const scope = createHash("sha256")
    .update(JSON.stringify([config.namespace, config.certificateMap, config.gateway]))
    .digest("hex")
    .slice(0, 24);
  const ns = "/namespaces/" + config.namespace;
  const parent = `projects/${config.project}/locations/global`;
  const map = `${parent}/certificateMaps/${config.certificateMap}`;
  const origin = (id: string) => `https://${id}.${config.domain}`;

  async function create(path: string, body: { metadata: { name: string }; [key: string]: unknown }) {
    const response = await kube(path, "POST", body);
    if (response.status === 409) return;
    await checked(response);
  }

  async function operation(response: Response) {
    if (response.status === 409 || response.status === 404) return;
    let job = await checked<Operation>(response);
    const deadline = Date.now() + 10_000;
    while (job.name && !job.done) {
      if (Date.now() >= deadline) throw new WorkflowError(425, "Preview certificate configuration is pending.");
      await Bun.sleep(500);
      job = await checked<Operation>(await google(job.name));
    }
    if (job.error) throw new Error("Preview certificate operation failed: " + job.error.code);
  }

  async function ensure(id: string, expiresAt: number) {
    if (!uuid.test(id) || expiresAt <= Date.now()) throw new WorkflowError(410, "The preview expired.");
    const selector = { "pocketcoder.workspace": id };
    const pods = await checked<Pods>(
      await kube("/api/v1" + ns + "/pods?labelSelector=" + encodeURIComponent("pocketcoder.workspace=" + id)),
    );
    const pod = pods.items.find((p) => !p.metadata.deletionTimestamp && p.status.phase === "Running");
    if (!pod) throw new WorkflowError(425, "The preview Pod is starting.");
    const name = certificateName(id);
    const metadata = {
      name,
      namespace: config.namespace,
      labels: { ...labels, "pocketcoder.workspace": id },
      ownerReferences: [{ apiVersion: "v1", kind: "Pod", name: pod.metadata.name, uid: pod.metadata.uid }],
    };
    await create("/api/v1" + ns + "/services", {
      apiVersion: "v1",
      kind: "Service",
      metadata,
      spec: {
        selector,
        ports: [
          { name: "dashboard", port: 8080, targetPort: 8080 },
          { name: "webviews", port: 8081, targetPort: 8081 },
        ],
      },
    });
    await create("/apis/networking.k8s.io/v1" + ns + "/networkpolicies", {
      apiVersion: "networking.k8s.io/v1",
      kind: "NetworkPolicy",
      metadata,
      spec: {
        podSelector: { matchLabels: selector },
        policyTypes: ["Ingress"],
        ingress: [
          {
            from: [{ ipBlock: { cidr: "35.191.0.0/16" } }, { ipBlock: { cidr: "130.211.0.0/22" } }],
            ports: [
              { protocol: "TCP", port: 8080 },
              { protocol: "TCP", port: 8081 },
            ],
          },
        ],
      },
    });
    await create("/apis/networking.gke.io/v1" + ns + "/healthcheckpolicies", {
      apiVersion: "networking.gke.io/v1",
      kind: "HealthCheckPolicy",
      metadata,
      spec: {
        default: { config: { type: "HTTP", httpHealthCheck: { port: 8080, requestPath: "/__preview/health" } } },
        targetRef: { group: "", kind: "Service", name },
      },
    });
    await create("/apis/networking.gke.io/v1" + ns + "/gcpbackendpolicies", {
      apiVersion: "networking.gke.io/v1",
      kind: "GCPBackendPolicy",
      metadata,
      spec: {
        default: { securityPolicy: config.securityPolicy, timeoutSec: 3600 },
        targetRef: { group: "", kind: "Service", name },
      },
    });
    await create("/apis/gateway.networking.k8s.io/v1" + ns + "/httproutes", {
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "HTTPRoute",
      metadata,
      spec: {
        parentRefs: [{ name: config.gateway, sectionName: "https" }],
        hostnames: [new URL(origin(id)).hostname],
        rules: [
          {
            matches: [{ path: { type: "PathPrefix", value: "/v1/extensions/webviews" } }],
            backendRefs: [{ name, port: 8081 }],
          },
          { matches: [{ path: { type: "PathPrefix", value: "/" } }], backendRefs: [{ name, port: 8080 }] },
        ],
      },
    });
    const certificate = await google(`${parent}/certificates?certificateId=${name}`, "POST", {
      labels: {
        "managed-by": manager,
        "preview-deployment": scope,
        [expiryLabel]: String(Math.floor(expiresAt / 1000)),
      },
      managed: { domains: [new URL(origin(id)).hostname] },
    });
    await operation(certificate);
    const entry = await google(`${map}/certificateMapEntries?certificateMapEntryId=${name}`, "POST", {
      hostname: new URL(origin(id)).hostname,
      certificates: [`${parent}/certificates/${name}`],
      labels: { "managed-by": manager, "preview-deployment": scope },
    });
    await operation(entry);
  }

  async function cleanupCertificate(cert: NonNullable<Certificates["certificates"]>[number]) {
    const name = cert.name.split("/").at(-1) as string;
    const id = name.slice("pstdio-preview-".length);
    if (!uuid.test(id) || cert.labels?.["managed-by"] !== manager || cert.labels["preview-deployment"] !== scope)
      return;
    const pod = await checked<Pods>(
      await kube("/api/v1" + ns + "/pods?labelSelector=" + encodeURIComponent("pocketcoder.workspace=" + id)),
    );
    if (
      Number(cert.labels[expiryLabel]) * 1000 > Date.now() &&
      pod.items.some((p) => !p.metadata.deletionTimestamp && p.status.phase === "Running")
    )
      return;
    for (const path of [
      "/apis/gateway.networking.k8s.io/v1" + ns + "/httproutes/",
      "/apis/networking.gke.io/v1" + ns + "/healthcheckpolicies/",
      "/apis/networking.gke.io/v1" + ns + "/gcpbackendpolicies/",
      "/apis/networking.k8s.io/v1" + ns + "/networkpolicies/",
      "/api/v1" + ns + "/services/",
    ]) {
      const result = await kube(path + name, "DELETE");
      if (result.status !== 404) await checked(result);
    }
    const entry = await google(`${map}/certificateMapEntries/${name}`, "DELETE");
    await operation(entry);
    const removed = await google(`${parent}/certificates/${name}`, "DELETE");
    await operation(removed);
  }

  // Kubernetes owner references remove routes/policies/services with the Pod. Certificate Manager
  // has no Kubernetes owner support, so reconcile its durable labels even after a process restart.
  async function cleanup() {
    const errors: unknown[] = [];
    let pageToken = "";
    do {
      const query = new URLSearchParams({ pageSize: "100", pageToken });
      const page = await checked<Certificates>(await google(`${parent}/certificates?${query}`));
      for (const cert of page.certificates ?? []) {
        try {
          await cleanupCertificate(cert);
        } catch (error) {
          errors.push(error);
        }
      }
      pageToken = page.nextPageToken ?? "";
    } while (pageToken);
    if (errors.length) throw new AggregateError(errors, `${errors.length} preview cleanup operations failed.`);
  }

  async function healthy(url: string, id: string) {
    const response = await fetch(url + "/__preview/health", {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    return response?.ok === true && response.headers.get("X-PocketCoder-Workspace") === id;
  }
  return { origin, ensure, healthy, cleanup };
}
