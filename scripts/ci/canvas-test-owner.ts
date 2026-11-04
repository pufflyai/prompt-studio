export const canvasTestOwner = <T extends { dir: string }>(packages: T[], owner: string) =>
  packages.find((pkg) => pkg.dir === `packages/${owner}`) ?? packages.find((pkg) => pkg.dir === `extensions/${owner}`);
