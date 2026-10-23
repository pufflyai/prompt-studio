import { relative } from "node:path";

interface QuarantinedTest {
  runner: string;
  file: string;
  name: string;
  platforms: string[];
}

const escapeRegex = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const quarantinePattern = (cases: QuarantinedTest[], runner: string, platform: string) => {
  const names = cases.filter((entry) => entry.runner === runner && entry.platforms.includes(platform));
  return names.length ? `(?:${names.map((entry) => escapeRegex(entry.name)).join("|")})$` : undefined;
};

export const bunTestSelection = (
  cases: QuarantinedTest[],
  packageDir: string,
  platform: string,
  quarantine: boolean,
) => {
  const selected = cases.filter((entry) => entry.runner === "bun" && entry.file.startsWith(`${packageDir}/`));
  const pattern = quarantinePattern(selected, "bun", platform);
  return {
    pattern: quarantine ? pattern : pattern && `^(?!.*${pattern}).*$`,
    files: [
      ...new Set(
        selected.filter((entry) => entry.platforms.includes(platform)).map((entry) => relative(packageDir, entry.file)),
      ),
    ],
  };
};
