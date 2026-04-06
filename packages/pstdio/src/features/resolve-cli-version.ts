const UNKNOWN_VERSION = "0.0.0-unknown";

type ResolveCliVersionInput = {
  packageVersion: string | undefined;
};

export const resolveCliVersion = ({ packageVersion }: ResolveCliVersionInput) => {
  if (typeof packageVersion === "string" && packageVersion.length > 0) return packageVersion;
  return UNKNOWN_VERSION;
};
