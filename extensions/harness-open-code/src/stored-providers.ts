import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

/** Read ownership only. Native endpoints own all writes (ADR 0110). */
export const readStoredOpencodeProviders = async () => {
  if (process.env.OPENCODE_AUTH_CONTENT) return [];
  const configured = process.env.XDG_DATA_HOME;
  const directory = configured && isAbsolute(configured) ? configured : join(homedir(), ".local", "share");
  try {
    return Object.keys(await Bun.file(join(directory, "opencode", "auth.json")).json());
  } catch {
    return [];
  }
};
