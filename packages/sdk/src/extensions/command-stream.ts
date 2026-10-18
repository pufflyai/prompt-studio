import type { CommandOutcome } from "pstdio-api-contracts/extension-kernel";

export interface CommandStreamOptions {
  signal?: AbortSignal;
}

export interface CommandStream<TChunk, TResult = unknown> extends AsyncIterable<TChunk> {
  /** Every terminal path closes the chunks and resolves the complete outcome, including transport failures. */
  readonly outcome: Promise<CommandOutcome<TResult>>;
  /** @deprecated Read outcome, or use getCommandValue with its complete outcome. */
  readonly result: Promise<TResult>;
  cancel(): Promise<void>;
}
