import type { FormField, FormValue } from "@opencode/client";
import type { HarnessAuthenticationChannel } from "@pstdio/sdk/extensions";

type InputField = Exclude<FormField, { type: "external" }>;
const isVisible = (field: FormField, answer: Record<string, FormValue>) =>
  !(
    "when" in field &&
    field.when?.some((condition) => {
      const value = answer[condition.key];
      const equal = Array.isArray(value) ? value.includes(String(condition.value)) : value === condition.value;
      return value === undefined || (condition.op === "eq") !== equal;
    })
  );

const parseAnswer = (field: InputField, value: string) => {
  if (field.type === "integer" || field.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number) || (field.type === "integer" && !Number.isInteger(number)))
      throw new Error("Enter a valid number.");
    return number;
  }
  if (field.type === "boolean") {
    if (!["true", "false"].includes(value)) throw new Error("Enter true or false.");
    return value === "true";
  }
  if (field.type === "multiselect")
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  return value;
};

const readField = async (field: InputField, channel: HarnessAuthenticationChannel) => {
  const options = "options" in field ? field.options : undefined;
  const value = await channel.request(
    options?.length && field.type === "string" && !field.custom
      ? {
          type: "select",
          title: field.title ?? field.key,
          options: options.map((option) => ({
            id: option.value,
            label: option.label,
            description: option.description,
          })),
        }
      : {
          type: "input",
          title: field.title ?? field.key,
          secret: true,
          placeholder: "placeholder" in field ? field.placeholder : field.description,
        },
  );
  return parseAnswer(field, value);
};

export const collectFormAnswers = async (fields: FormField[], channel: HarnessAuthenticationChannel) => {
  const answer: Record<string, FormValue> = {};
  for (const field of fields) {
    if (!isVisible(field, answer)) continue;
    if ("hidden" in field && field.hidden) {
      if ("default" in field && field.default !== undefined) answer[field.key] = field.default;
      continue;
    }
    if (field.type === "external") {
      await channel.emit({ type: "browser", url: field.url, message: field.description ?? field.title });
      continue;
    }
    answer[field.key] = await readField(field, channel);
  }
  return answer;
};
