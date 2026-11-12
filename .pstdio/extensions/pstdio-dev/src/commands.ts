import { benchmarkCommands } from "./benchmarks/commands";
import { releaseCommands } from "./releases/commands";

export const devCommands = { ...benchmarkCommands, ...releaseCommands };
