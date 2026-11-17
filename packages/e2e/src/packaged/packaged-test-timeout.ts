// Real host/tool preparation exceeded 30 s on Windows and Apple Silicon in release
// verification. PS-1232: the user authorized setup/test allowances on 2026-11-17.
// Intel retains its prior 60 s allowance; Linux retains 30 s.
const coldPreparation = process.platform === "win32" || (process.platform === "darwin" && process.arch === "arm64");
const priorAllowance = process.platform === "darwin" ? 60_000 : 30_000;
export const PACKAGED_TEST_TIMEOUT = coldPreparation ? 120_000 : priorAllowance;
