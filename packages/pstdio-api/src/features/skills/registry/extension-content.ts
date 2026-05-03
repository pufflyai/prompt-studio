import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { SkillFile } from "pstdio-api-contracts";
import { type PackageAssetKind, type ResolvedPackageAsset, resolvePackageAsset } from "pstdio-extensions";
import type { RuntimeSkillRecord } from "pstdio-extensions/types";
import type { RouteDeps } from "../../deps";

export type ResolvedExtensionSkill = {
  record: RuntimeSkillRecord;
  asset: ResolvedPackageAsset;
};

export const findExtensionSkill = async (
  deps: RouteDeps,
  extensionId: string,
  skillKey: string,
): Promise<{ ok: true; resolved: ResolvedExtensionSkill } | { ok: false; assetMissing: boolean }> => {
  const checkResult = await deps.extensionService.check();
  const record = checkResult.runtime.skills.find(
    (entry) => entry.extensionId === extensionId && entry.localId === skillKey,
  );
  if (!record) return { ok: false, assetMissing: false };

  try {
    const asset = resolvePackageAsset(record.contribution.source, {
      sourcePath: record.sourcePath,
      allowDirectory: true,
    });
    return { ok: true, resolved: { record, asset } };
  } catch {
    return { ok: false, assetMissing: true };
  }
};

export const detectSkillAssetKind = (record: RuntimeSkillRecord): PackageAssetKind => {
  try {
    const asset = resolvePackageAsset(record.contribution.source, {
      sourcePath: record.sourcePath,
      allowDirectory: true,
    });
    return asset.kind;
  } catch {
    return "missing";
  }
};

export const readExtensionSkillFiles = async (resolved: ResolvedExtensionSkill): Promise<SkillFile[]> => {
  const { asset } = resolved;
  if (asset.kind === "file") {
    return [
      {
        path: "SKILL.md",
        content: readFileSync(asset.path, "utf8"),
        encoding: "utf8" as const,
      },
    ];
  }

  const collected: SkillFile[] = [];
  const root = asset.path;
  const walk = (dir: string) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const rel = relative(root, full)
          .split(/[\\/]+/)
          .join("/");
        collected.push({
          path: rel,
          content: readFileSync(full, "utf8"),
          encoding: "utf8" as const,
        });
      }
    }
  };

  if (statSync(root).isDirectory()) walk(root);
  return collected;
};
