export interface StudyMetadata {
  title: string;
  description: string;
  duration: number;
  canvas: "pane" | "workbench" | { width: number; height: number };
  markers?: { at: number; label: string }[];
  params: {
    id: string;
    name: string;
    description?: string;
    options: { id: string; name: string }[];
    default: { left: string; right: string };
  }[];
}
