import { readFile } from "node:fs/promises";

export function googleClient() {
  let credentials: { access_token: string; expires_in: number } | undefined;
  let until = 0;
  return async (path: string, method = "GET", body?: unknown) => {
    if (!credentials || Date.now() >= until) {
      const response = await fetch(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
        {
          headers: { "Metadata-Flavor": "Google" },
          signal: AbortSignal.timeout(5000),
          redirect: "error",
        },
      );
      if (!response.ok) throw new Error("Workload Identity HTTP " + response.status);
      credentials = (await response.json()) as { access_token: string; expires_in: number };
      until = Date.now() + Math.max(0, credentials!.expires_in - 60) * 1000;
    }
    return fetch("https://certificatemanager.googleapis.com/v1/" + path, {
      method,
      headers: { Authorization: "Bearer " + credentials!.access_token, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  };
}

export function kubernetesClient() {
  const directory = "/var/run/secrets/kubernetes.io/serviceaccount/";
  return async (path: string, method = "GET", body?: unknown) => {
    const [token, ca] = await Promise.all([
      readFile(directory + "token", "utf8"),
      readFile(directory + "ca.crt", "utf8"),
    ]);
    return fetch("https://kubernetes.default.svc" + path, {
      method,
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      tls: { ca },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  };
}

export async function checked<T = unknown>(response: Response) {
  if (!response.ok) throw new Error("Preview infrastructure HTTP " + response.status);
  return response.json() as Promise<T>;
}
