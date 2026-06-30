import { createCommand } from "lexical";
import { INSERT_BLOCK, INSERT_REFERENCE } from "./events";

export const INSERT_REFERENCE_COMMAND = createCommand(INSERT_REFERENCE);

export const INSERT_BLOCK_COMMAND = createCommand(INSERT_BLOCK);
