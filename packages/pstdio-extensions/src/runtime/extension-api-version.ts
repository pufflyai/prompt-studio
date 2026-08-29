import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

// An extension declares the exact API version it was built against. Ranges are refused:
// `^1.0.0-alpha.1` also matches `1.0.0-alpha.3` under semver, so a range would wave through
// every alpha bump while looking like a gate.
const isVersionRange = (declared: string) => /^[\^~><=*]/.test(declared);

const versionPattern = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/;

const comparePrereleaseSegment = (left: string, right: string) => {
  const leftNumber = Number.parseInt(left, 10);
  const rightNumber = Number.parseInt(right, 10);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return left.localeCompare(right);
};

// Returns a negative number when `declared` is older than the host version. An unparseable
// declared version counts as older: the fix is on the extension side either way.
const compareToHostVersion = (declared: string, host: string) => {
  const declaredMatch = versionPattern.exec(declared);
  const hostMatch = versionPattern.exec(host);
  if (!declaredMatch || !hostMatch) return -1;

  for (const index of [1, 2, 3]) {
    const difference = Number(declaredMatch[index]) - Number(hostMatch[index]);
    if (difference !== 0) return difference;
  }

  const declaredPrerelease = declaredMatch[4]?.split(".") ?? [];
  const hostPrerelease = hostMatch[4]?.split(".") ?? [];
  if (declaredPrerelease.length === 0) return hostPrerelease.length === 0 ? 0 : 1;
  if (hostPrerelease.length === 0) return -1;

  for (let index = 0; index < Math.max(declaredPrerelease.length, hostPrerelease.length); index += 1) {
    const left = declaredPrerelease[index];
    const right = hostPrerelease[index];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    const difference = comparePrereleaseSegment(left, right);
    if (difference !== 0) return difference;
  }
  return 0;
};

export const getExtensionApiVersionError = (name: string, declared: string) => {
  if (declared === EXTENSION_API_VERSION) return null;

  if (isVersionRange(declared)) {
    return `Extension "${name}" declares engines.pstdio "${declared}". While the extension API is in alpha it must be the exact version "${EXTENSION_API_VERSION}", not a range.`;
  }

  if (compareToHostVersion(declared, EXTENSION_API_VERSION) < 0) {
    return `Extension "${name}" was built for extension API ${declared}, but this host provides ${EXTENSION_API_VERSION}. Update the extension with \`pst extensions update ${name}\`, or reinstall it with \`pst extensions add\`.`;
  }

  return `Extension "${name}" targets extension API ${declared} but this host provides ${EXTENSION_API_VERSION}. Update Prompt Studio.`;
};
