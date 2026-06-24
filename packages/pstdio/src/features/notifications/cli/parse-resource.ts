interface ResourceRef {
  type: string;
  id: string;
}

const SEPARATOR = ":";

export const parseResourceRef = (value: string): ResourceRef => {
  const idx = value.indexOf(SEPARATOR);
  if (idx <= 0 || idx === value.length - 1) {
    throw new Error(`Invalid resource reference, expected "<type>:<id>", got "${value}"`);
  }
  const type = value.slice(0, idx);
  const id = value.slice(idx + 1);
  return { type, id };
};

export const parseRelatedRefs = (values: string | string[] | undefined): ResourceRef[] => {
  if (!values) return [];
  const list = Array.isArray(values) ? values : [values];
  return list.map(parseResourceRef);
};

const ACTION_RE = /^([^=]+)=([a-z-]+):([^:]+):(.+)$/;

export const parseAction = (value: string) => {
  const match = ACTION_RE.exec(value);
  if (!match) throw new Error(`Invalid action, expected "Label=<kind>:<type>:<id>", got "${value}"`);
  const [, label, kind, type, id] = match;
  if (kind !== "open-resource" && kind !== "open") {
    throw new Error(`Only open-resource actions are supported in --action CLI input; got kind=${kind}`);
  }
  return {
    id: label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-"),
    label: label.trim(),
    kind: "open-resource" as const,
    resource: { type, id } satisfies ResourceRef,
    primary: true,
  };
};

export const parseActions = (values: string | string[] | undefined) => {
  if (!values) return undefined;
  const list = Array.isArray(values) ? values : [values];
  return list.map(parseAction);
};
