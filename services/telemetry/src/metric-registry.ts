const escaped = (value: string) => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");

/** A bounded process-local registry. Callers supply fixed metric names and bounded labels only. */
export const createMetricRegistry = (prefix: string, common: Record<string, string> = {}) => {
  const values = new Map<string, { name: string; labels: Record<string, string>; value: number }>();
  const types = new Map<string, string>();
  let dropped = 0;
  const key = (name: string, labels: Record<string, string>) => {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error("Invalid metric name");
    const fields = Object.entries({ ...common, ...labels }).sort(([a], [b]) => a.localeCompare(b));
    if (fields.some(([key, value]) => !/^[a-z_][a-z0-9_]*$/.test(key) || value.length > 128))
      throw new Error("Invalid metric label");
    return `${prefix}_${name}${fields.length ? `{${fields.map(([key, value]) => `${key}="${escaped(value)}"`).join(",")}}` : ""}`;
  };
  const write = (name: string, value: number, labels: Record<string, string>, add: boolean) => {
    if (!Number.isFinite(value)) return;
    const id = key(name, labels);
    if (!values.has(id) && values.size >= 2000) {
      dropped++;
      return;
    }
    values.set(id, {
      name: `${prefix}_${name}`,
      labels: { ...common, ...labels },
      value: (add ? (values.get(id)?.value ?? 0) : 0) + value,
    });
  };
  return {
    declare(name: string, type: "counter" | "gauge" | "histogram") {
      types.set(`${prefix}_${name}`, type);
    },
    add(name: string, value = 1, labels: Record<string, string> = {}) {
      write(name, value, labels, true);
    },
    set(name: string, value: number, labels: Record<string, string> = {}) {
      write(name, value, labels, false);
    },
    clear() {
      values.clear();
    },
    snapshot() {
      return [...values.values()].map((sample) => ({ ...sample, labels: { ...sample.labels } }));
    },
    render() {
      return `${[...types].map(([name, type]) => `# TYPE ${name} ${type}`).join("\n")}\n${[...values].map(([name, sample]) => `${name} ${sample.value}`).join("\n")}\n${prefix}_metric_series_dropped_total ${dropped}\n`;
    },
  };
};
