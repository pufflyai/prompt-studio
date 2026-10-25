export const packagedBuildCommand = (prebuilt: boolean) =>
  prebuilt ? null : ["bun", "run", "--cwd", "scripts", "build:all"];

export const packagedVerificationProfile = (profile: string, platform: NodeJS.Platform) => {
  if (profile === "full")
    return {
      runtime: true,
      publicContracts: true,
      publicContractsReason: "full production verifies the public consumer family on every native host",
    };
  if (profile === "integrity")
    return {
      runtime: false,
      publicContracts: platform === "linux",
      publicContractsReason:
        "queue integrity assigns portable declarations and public consumers once to Linux; native binary checks remain on every host",
    };
  throw new Error(`Unknown packaged verification profile: ${profile}`);
};
