// PowerShell startup must not compete with PGlite cold starts. The standalone shim check
// also runs this file; keep isolation here so every API suite caller follows the same rule.
const isolatedFiles = new Set(["src/features/extensions/process-discovery.test.ts"]);

export const runApiTestFiles = async (files: string[], runFile: (file: string) => Promise<void>) => {
  const shared = files.filter((file) => !isolatedFiles.has(file));
  let nextFile = 0;
  const runWorker = async () => {
    while (nextFile < shared.length) {
      const file = shared[nextFile++];
      await runFile(file);
    }
  };
  await Promise.all([runWorker(), runWorker()]);
  for (const file of files.filter((file) => isolatedFiles.has(file))) {
    console.log(`API test file (running alone): ${file}`);
    await runFile(file);
  }
};
