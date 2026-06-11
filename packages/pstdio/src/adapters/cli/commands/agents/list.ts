import { apiClient } from "@/features/api-client";

export const command = "list";
export const describe = "List available coding harnesses";

export const handler = async () => {
  const harnesses = await apiClient().agents.info();

  const rows = harnesses.map((harness) => ({
    Harness: harness.name,
    Id: harness.id,
    Installed: harness.availability.type === "INSTALLED" ? "yes" : "no",
  }));

  console.table(rows);
};
