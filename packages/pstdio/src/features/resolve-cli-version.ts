const UNKNOWN_VERSION = "0.0.0-unknown";

type ResolveCliVersionInput = {
  envVersion: string | undefined;
  packageVersion: string | undefined;
};

export const resolveCliVersion = ({ envVersion, packageVersion }: ResolveCliVersionInput) => {
  if (typeof envVersion === "string" && envVersion.length > 0) return envVersion;
  if (typeof packageVersion === "string" && packageVersion.length > 0) return packageVersion;
  return UNKNOWN_VERSION;
};
