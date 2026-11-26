export interface WorkspaceCount {
  time: number;
  count: number;
}

export interface WorkspaceActivity {
  running: number;
  peak: number;
  points: WorkspaceCount[];
  byTemplate?: { template: string; points: WorkspaceCount[] }[];
}
