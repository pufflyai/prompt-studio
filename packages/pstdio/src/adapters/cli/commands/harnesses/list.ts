import { listHarnessInfo } from "@/features/harnesses/api/list-harness-info";
import { listHarnesses } from "@/features/harnesses/api/list-harnesses";

export const command = "list";
export const describe = "List available harness providers";

export const handler = async () => {
  const [info, configured] = await Promise.all([listHarnessInfo(), listHarnesses()]);
  const configuredIds = new Set(configured.map((harness) => harness.harness_id));
  const defaultId = configured.find((harness) => harness.is_default)?.harness_id;

  const rows = info.map((harness) => ({
    Harness: harness.name,
    Id: harness.id,
    Configured: configuredIds.has(harness.id) ? "yes" : "no",
    Installed: harness.availability.type === "INSTALLED" ? "yes" : "no",
    Default: harness.id === defaultId ? "yes" : "",
  }));

  console.table(rows);
};
