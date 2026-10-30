export interface SuiteContext {
  /** Every step runs against this checkout's own code. */
  root: string;
  /** Shared between samples of one commit, for expensive fixture preparation. */
  cacheDir: string;
  platform: string;
  sha: string;
}

export interface SuiteStep {
  command: string[];
  /** Relative to the checkout root. */
  cwd?: string;
  env?: Record<string, string>;
  platforms?: string[];
}

export interface BenchmarkSuite {
  id: string;
  label: string;
  /** Exact repository paths; also used to select the files executed by each sample. */
  files: string[];
  prepare?: (context: SuiteContext) => SuiteStep[];
  sample: (context: SuiteContext, files: string[]) => SuiteStep[];
  platforms?: string[];
}
