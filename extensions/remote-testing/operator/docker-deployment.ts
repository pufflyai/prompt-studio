import type { DockerPolicy } from "./docker-admission";

type Config = DockerPolicy & { namespace: string; caBundle: string; image: string };
export function dockerDeployment(config: Config) {
  const name = "remote-test-docker";
  const metadata = { name, namespace: config.namespace };
  const labels = { "app.kubernetes.io/name": name };
  return {
    apiVersion: "v1",
    kind: "List",
    items: [
      {
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata,
        data: {
          "policy.json": JSON.stringify({
            images: config.images,
            daemonImage: config.daemonImage,
            nodeSelector: config.nodeSelector,
          }),
        },
      },
      {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata,
        spec: {
          replicas: 2,
          selector: { matchLabels: labels },
          template: {
            metadata: { labels },
            spec: {
              automountServiceAccountToken: false,
              nodeSelector: { "pocketcoder.dev/pool": "system" },
              securityContext: { runAsNonRoot: true, runAsUser: 10001, seccompProfile: { type: "RuntimeDefault" } },
              containers: [
                {
                  name,
                  image: config.image,
                  command: ["bun", "/code/docker-admission.js"],
                  ports: [{ containerPort: 8443 }],
                  resources: { requests: { cpu: "50m", memory: "64Mi" }, limits: { cpu: "300m", memory: "128Mi" } },
                  readinessProbe: { httpGet: { scheme: "HTTPS", path: "/healthz", port: 8443 } },
                  securityContext: {
                    allowPrivilegeEscalation: false,
                    readOnlyRootFilesystem: true,
                    capabilities: { drop: ["ALL"] },
                  },
                  volumeMounts: [
                    { name: "code", mountPath: "/code", readOnly: true },
                    { name: "tls", mountPath: "/tls", readOnly: true },
                    { name: "config", mountPath: "/config", readOnly: true },
                  ],
                },
              ],
              volumes: [
                { name: "code", configMap: { name: `${name}-code` } },
                { name: "tls", secret: { secretName: `${name}-tls` } },
                { name: "config", configMap: { name } },
              ],
            },
          },
        },
      },
      {
        apiVersion: "v1",
        kind: "Service",
        metadata,
        spec: { selector: labels, ports: [{ port: 443, targetPort: 8443 }] },
      },
      {
        apiVersion: "networking.k8s.io/v1",
        kind: "NetworkPolicy",
        metadata,
        spec: {
          podSelector: { matchLabels: labels },
          policyTypes: ["Ingress", "Egress"],
          ingress: [{ ports: [{ protocol: "TCP", port: 8443 }] }],
          egress: [],
        },
      },
      {
        apiVersion: "admissionregistration.k8s.io/v1",
        kind: "MutatingWebhookConfiguration",
        metadata: { name },
        webhooks: [
          {
            name: "docker.remote-tests.pocketcoder.dev",
            admissionReviewVersions: ["v1"],
            sideEffects: "None",
            failurePolicy: "Fail",
            timeoutSeconds: 10,
            namespaceSelector: { matchLabels: { "kubernetes.io/metadata.name": config.namespace } },
            matchConditions: [
              {
                name: "approved-test-image",
                expression:
                  "object.spec.containers.exists(c, c.name in ['workspace', 'probe'] && c.image in " +
                  JSON.stringify(config.images) +
                  ")",
              },
            ],
            clientConfig: {
              service: { name, namespace: config.namespace, path: "/mutate", port: 443 },
              caBundle: config.caBundle,
            },
            rules: [
              {
                operations: ["CREATE"],
                apiGroups: [""],
                apiVersions: ["v1"],
                resources: ["pods"],
                scope: "Namespaced",
              },
            ],
          },
        ],
      },
    ],
  };
}
if (import.meta.main) console.log(JSON.stringify(dockerDeployment(await Bun.file(Bun.argv[2]!).json())));
