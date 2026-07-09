export type ResourceType =
  | "table"
  | "connector"
  | "file"
  | "text"
  | "image"
  | "pdf"
  | "markdown"
  | "csv"
  | "json"
  | "code";

export interface Resource {
  resourceId: string;
  resourceType: ResourceType;
  name: string;
  description?: string;
  mediaType?: string;
}
