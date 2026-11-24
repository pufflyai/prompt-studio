import { createMemoryStorage } from "@pstdio/sdk/testing";
import { runRecoveryIndex } from "./run-recovery";

export const createRunStorage = () => createMemoryStorage({ indexes: [runRecoveryIndex] });
