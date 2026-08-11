type RuntimeSession = {
  clearStorageData: (options: { storages: Array<"cookies"> }) => Promise<unknown>;
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  cookies: {
    get: (filter: {
      name: string;
      url: string;
    }) => Promise<Array<{ httpOnly?: boolean; sameSite?: string; secure?: boolean; value: string }>>;
  };
};

type RuntimeCredential = {
  origin: string;
  token: string;
};

const COOKIE_NAME = "pstdio_runtime_session";

export const provisionRuntimeSession = async (session: RuntimeSession, runtime: RuntimeCredential) => {
  await session.clearStorageData({ storages: ["cookies"] });
  const response = await session.fetch(`${runtime.origin}/runtime/browser-session`, {
    method: "POST",
    headers: { authorization: `Bearer ${runtime.token}` },
  });
  if (!response.ok) throw new Error(`Runtime browser session provisioning failed with status ${response.status}`);

  const cookies = await session.cookies.get({ name: COOKIE_NAME, url: runtime.origin });
  const cookie = cookies.find((candidate) => candidate.value === runtime.token);
  if (!cookie?.httpOnly || cookie.sameSite?.toLowerCase() !== "strict") {
    throw new Error("Runtime did not provision the expected protected runtime session cookie");
  }
};
