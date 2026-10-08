type RuntimeCredential = {
  origin: string;
  token: string;
};

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

// The desktop signs its workbench in like `pst` does: it loads a single-use login link, and the
// dashboard redeems it for a browser session secret in its own per-origin storage (ADR 0057).
export const createRuntimeLoginUrl = async (fetchFn: Fetch, runtime: RuntimeCredential) => {
  const response = await fetchFn(`${runtime.origin}/runtime/browser-login`, {
    method: "POST",
    headers: { authorization: `Bearer ${runtime.token}` },
  });
  if (!response.ok) throw new Error(`Runtime browser login failed with status ${response.status}`);
  const { url } = (await response.json()) as { url: string };
  return url;
};
