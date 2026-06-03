export const readBoolean = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

export const readNumber = (value: unknown, fallback: number) => (typeof value === "number" ? value : fallback);

export const readString = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);
