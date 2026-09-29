/**
 * EXTENSION_API_VERSION moves at most one step between two releases. The step is set by the
 * highest change level merged since the last release, not by the number of PRs.
 */

// On 0.x a breaking change moves the minor, and 1.0.0 is the release that declares the API settled.
const allowedVersions = (released: string) => {
  const [major = 0, minor = 0, patch = 0] = released.split(".").map(Number);
  const nextBreaking = major === 0 ? "1.0.0" : `${major + 1}.0.0`;
  return [released, `${major}.${minor}.${patch + 1}`, `${major}.${minor + 1}.0`, nextBreaking];
};

interface ReleaseStepInput {
  /** EXTENSION_API_VERSION at the last release tag. */
  released: string;
  current: string;
  /** Whether the API report differs from the report at the last release tag. */
  reportChanged: boolean;
}

export const checkExtensionApiReleaseStep = ({ released, current, reportChanged }: ReleaseStepInput) => {
  // The last alpha release has no semver version or report to step from.
  // Delete this branch once 0.1.0 is released.
  if (released.includes("-")) {
    return current === "0.1.0"
      ? []
      : [`EXTENSION_API_VERSION is ${current} but the first semver version must be 0.1.0.`];
  }

  const allowed = allowedVersions(released);
  if (!allowed.includes(current)) {
    return [
      `EXTENSION_API_VERSION is ${current} but the last release shipped ${released}. Until the next release it may only be one of: ${allowed.join(", ")}.`,
    ];
  }
  if (reportChanged && current === released) {
    return [
      `The public extension API changed since the ${released} release, but EXTENSION_API_VERSION is still ${released}. Move it one step using the change levels in the manifest reference.`,
    ];
  }
  return [];
};
