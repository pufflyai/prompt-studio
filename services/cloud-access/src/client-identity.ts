import { serviceUrl } from "./config";
import { microsoftIdentity } from "./microsoft-client";

export type IdentityMode = "gcloud" | "metadata" | "microsoft";
export async function googleIdentity(mode: Exclude<IdentityMode, "microsoft">, audience: string) {
  if (mode === "metadata") {
    const url = new URL(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity",
    );
    url.searchParams.set("audience", audience);
    url.searchParams.set("format", "full");
    const result = await fetch(url, {
      headers: { "Metadata-Flavor": "Google" },
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!result.ok || result.headers.get("metadata-flavor") !== "Google")
      throw new Error("VM workload identity is unavailable.");
    return result.text();
  }
  const child = Bun.spawn(["gcloud", "auth", "print-identity-token"], {
    stdout: "pipe",
    stderr: "ignore",
    stdin: "ignore",
  });
  const timeout = setTimeout(() => child.kill(), 30_000);
  try {
    const token = (await new Response(child.stdout).text()).trim();
    if ((await child.exited) || !token) throw new Error("Sign in first with gcloud auth login.");
    return token;
  } finally {
    clearTimeout(timeout);
  }
}

export async function accessRequest(input: {
  broker: string;
  audience: string;
  mode: IdentityMode;
  path: string;
  body?: unknown;
  method?: string;
}) {
  const broker = serviceUrl.parse(input.broker);
  const response = await fetch(new URL(input.path, broker), {
    method: input.method ?? "POST",
    headers: {
      Authorization: `Bearer ${await (input.mode === "microsoft" ? microsoftIdentity({ broker }) : googleIdentity(input.mode, input.audience))}`,
      "Content-Type": "application/json",
    },
    ...(input.body !== undefined && { body: JSON.stringify(input.body) }),
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new Error(`Cloud access request failed (HTTP ${response.status}). Check identity and authorization.`);
  return response.json();
}
