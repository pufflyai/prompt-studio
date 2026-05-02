import { apiClient } from "@/features/api-client";
import { formatExtensionsCheckReport } from "./format-report";

export const command = "check";
export const describe = "Check installed extensions and print diagnostics";

type Deps = {
  checkExtensions: () => ReturnType<ReturnType<typeof apiClient>["extensions"]["check"]>;
  log: (msg: string) => void;
  exit: (code: number) => void;
};

const defaultDeps: Deps = {
  checkExtensions: () => apiClient().extensions.check(),
  log: (msg) => process.stdout.write(msg),
  exit: (code) => process.exit(code),
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async () => {
    const response = await deps.checkExtensions();
    deps.log(formatExtensionsCheckReport(response));
    if (response.errorCount > 0) deps.exit(1);
  };

export const handler = createHandler();
