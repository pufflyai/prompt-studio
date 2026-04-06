import packageData from "../../package.json";
import { resolveCliVersion } from "./resolve-cli-version";

const packageVersion = typeof packageData.version === "string" ? packageData.version : undefined;

export const CLI_VERSION = resolveCliVersion({ packageVersion });
