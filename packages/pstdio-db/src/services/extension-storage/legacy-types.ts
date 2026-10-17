export interface KvScope {
  extension_instance_id: string;
  scope_type: string;
  scope_id: string;
}

export type CollectionScope = KvScope & { collection: string };
export type SetKvInput = KvScope & { key: string; value_json: unknown; project_id?: string | null };
export type SetCollectionItemInput = CollectionScope & {
  item_id: string;
  value_json: unknown;
  sort_order?: number | null;
  project_id?: string | null;
};
