import type { AccountLogin, AccountSignInProvider } from "pstdio-api-contracts";

const providerOf = (url: string) => {
  try {
    return new URL(url).searchParams.get("provider");
  } catch {
    return null;
  }
};

export const verifyAccountLogin = async (
  attempt: AccountLogin,
  provider: AccountSignInProvider | undefined,
  cancel: (id: string) => Promise<unknown>,
) => {
  // Old hosts omit the provider and use Google.
  if (provider === "microsoft" && providerOf(attempt.url) !== provider) {
    await cancel(attempt.id).catch(() => {});
    throw new Error("Update Prompt Studio to sign in with Microsoft.");
  }
  return attempt;
};
