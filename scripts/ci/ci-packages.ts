interface CiPackage {
  name: string;
  dir: string;
  dependencies: string[];
}

export const affectedPackages = (packages: CiPackage[], files: string[]) => {
  const affected = new Set(
    packages.filter((pkg) => files.some((file) => file.startsWith(`${pkg.dir}/`))).map((pkg) => pkg.name),
  );
  let previous = -1;
  while (previous !== affected.size) {
    previous = affected.size;
    for (const pkg of packages) {
      if (pkg.dependencies.some((dependency) => affected.has(dependency))) affected.add(pkg.name);
    }
  }
  return [...affected].sort();
};
