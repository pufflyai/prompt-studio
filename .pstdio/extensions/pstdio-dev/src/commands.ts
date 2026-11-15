import { benchmarkCommands } from "./benchmarks/commands";
import { diagnosticsCommands } from "./diagnostics/commands";
import { releaseCommands } from "./releases/commands";

export const devCommands = { ...benchmarkCommands, ...releaseCommands, ...diagnosticsCommands };
