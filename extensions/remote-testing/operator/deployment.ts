import type { PreviewIngress } from "./preview-resources";

type Deployment = PreviewIngress & {
  image: string;
  serviceAccount: string;
  controller: string;
  storageBucket: string;
  signerAccount: string;
  keySecret: string;
};

// Operator values are deliberately supplied outside the source tree.
export function deployment(config: Deployment) {
  const namespace = config.namespace;
  const metadata = (name: string) => ({ name, namespace });
  const app = { "app.kubernetes.io/name": "kito-workflow" };
  return {
    apiVersion: "v1",
    kind: "List",
    items: [
      {
        apiVersion: "v1",
        kind: "ServiceAccount",
        metadata: {
          ...metadata("kito-workflow"),
          annotations: { "iam.gke.io/gcp-service-account": config.serviceAccount },
        },
      },
      {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "Role",
        metadata: metadata("kito-workflow-preview-route"),
        rules: [
          { apiGroups: [""], resources: ["pods"], verbs: ["get", "list"] },
          { apiGroups: [""], resources: ["services"], verbs: ["create", "get", "delete"] },
          { apiGroups: ["networking.k8s.io"], resources: ["networkpolicies"], verbs: ["create", "get", "delete"] },
          {
            apiGroups: ["networking.gke.io"],
            resources: ["healthcheckpolicies", "gcpbackendpolicies"],
            verbs: ["create", "get", "delete"],
          },
          { apiGroups: ["gateway.networking.k8s.io"], resources: ["httproutes"], verbs: ["create", "get", "delete"] },
        ],
      },
      {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "RoleBinding",
        metadata: metadata("kito-workflow-preview-route"),
        subjects: [{ kind: "ServiceAccount", name: "kito-workflow", namespace }],
        roleRef: { apiGroup: "rbac.authorization.k8s.io", kind: "Role", name: "kito-workflow-preview-route" },
      },
      {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: metadata("kito-workflow"),
        spec: {
          replicas: 1,
          strategy: { type: "RollingUpdate", rollingUpdate: { maxUnavailable: 0, maxSurge: 1 } },
          selector: { matchLabels: app },
          template: {
            metadata: { labels: app },
            spec: {
              serviceAccountName: "kito-workflow",
              nodeSelector: { "pocketcoder.dev/pool": "system" },
              securityContext: { runAsNonRoot: true, runAsUser: 10001, seccompProfile: { type: "RuntimeDefault" } },
              containers: [
                {
                  name: "workflow",
                  image: config.image,
                  command: ["/usr/local/bin/bun", "/workflow/server.js"],
                  ports: [{ name: "http", containerPort: 8080 }],
                  env: [
                    ...Object.entries({
                      CONTROLLER_ORIGIN: config.controller,
                      STORAGE_BUCKET: config.storageBucket,
                      SIGNER_ACCOUNT: config.signerAccount,
                      GOOGLE_CLOUD_PROJECT: config.project,
                      KUBERNETES_NAMESPACE: namespace,
                      PREVIEW_DOMAIN: config.domain,
                      CERTIFICATE_MAP: config.certificateMap,
                      PREVIEW_GATEWAY: config.gateway,
                      PREVIEW_SECURITY_POLICY: config.securityPolicy,
                    }).map(([name, value]) => ({ name, value })),
                    { name: "WORKFLOW_KEY_HASH", valueFrom: { secretKeyRef: { name: config.keySecret, key: "hash" } } },
                  ],
                  resources: { requests: { cpu: "50m", memory: "64Mi" }, limits: { cpu: "300m", memory: "128Mi" } },
                  readinessProbe: { httpGet: { path: "/healthz", port: "http" } },
                  securityContext: {
                    allowPrivilegeEscalation: false,
                    readOnlyRootFilesystem: true,
                    capabilities: { drop: ["ALL"] },
                  },
                  volumeMounts: [{ name: "code", mountPath: "/workflow", readOnly: true }],
                },
              ],
              volumes: [{ name: "code", configMap: { name: "kito-workflow-code" } }],
            },
          },
        },
      },
      {
        apiVersion: "networking.k8s.io/v1",
        kind: "NetworkPolicy",
        metadata: metadata("kito-workflow-isolated-egress"),
        spec: {
          podSelector: { matchLabels: app },
          policyTypes: ["Egress"],
          egress: [
            {
              to: [
                {
                  ipBlock: {
                    cidr: "0.0.0.0/0",
                    except: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16"],
                  },
                },
              ],
              ports: [{ protocol: "TCP", port: 443 }],
            },
            {
              to: [{ namespaceSelector: { matchLabels: { "kubernetes.io/metadata.name": "kube-system" } } }],
              ports: [
                { protocol: "UDP", port: 53 },
                { protocol: "TCP", port: 53 },
              ],
            },
          ],
        },
      },
    ],
  };
}
if (import.meta.main) console.log(JSON.stringify(deployment(await Bun.file(Bun.argv[2]).json())));
