type ResolveCliSessionIdInput = {
  explicitSessionId?: string;
  env?: NodeJS.ProcessEnv;
};

const asNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed;
};

export const resolveCliSessionId = (input: ResolveCliSessionIdInput) => {
  return asNonEmptyString(input.explicitSessionId) ?? asNonEmptyString(input.env?.PSTDIO_SESSION_ID);
};
