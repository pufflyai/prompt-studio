import { describe, expect, test } from "bun:test";
import { createExtensionSettingsService } from "./extension-settings-service";

const definitions = [
  {
    extensionId: "pstdio.extension-lab",
    key: "counter.step",
    scope: "project" as const,
    type: "number" as const,
    default: 1,
  },
  {
    extensionId: "pstdio.extension-lab",
    key: "counter.enabled",
    scope: "project" as const,
    type: "boolean" as const,
    default: true,
  },
  {
    extensionId: "pstdio.extension-lab",
    key: "greeting.tone",
    scope: "global" as const,
    type: "string" as const,
    enum: ["friendly", "formal"],
    default: "friendly",
  },
];

type StoredSettingKey = {
  owner_type: "installed_extension" | "extension_instance";
  owner_id: string;
  extension_id: string;
  key: string;
};

type StoredSettingOwner = Omit<StoredSettingKey, "key">;
type SetStoredSettingInput = StoredSettingKey & { value_json: unknown };

const createService = () => {
  const values = new Map<string, unknown>();
  const keyOf = (input: StoredSettingKey) =>
    [input.owner_type, input.owner_id, input.extension_id, input.key].join("\0");

  return createExtensionSettingsService({
    extensionSettingsDBService: {
      getValue: async (input: StoredSettingKey) => {
        const key = keyOf(input);
        if (!values.has(key)) return null;
        return { ...input, value_json: values.get(key) };
      },
      listValues: async (owner: StoredSettingOwner) =>
        Array.from(values.entries()).flatMap(([key, value]) => {
          const [ownerType, ownerId, extensionId, settingKey] = key.split("\0");
          return ownerType === owner.owner_type && ownerId === owner.owner_id && extensionId === owner.extension_id
            ? [
                {
                  owner_type: ownerType,
                  owner_id: ownerId,
                  extension_id: extensionId,
                  key: settingKey,
                  value_json: value,
                },
              ]
            : [];
        }),
      setValue: async (input: SetStoredSettingInput) => {
        values.set(keyOf(input), input.value_json);
        return input;
      },
      deleteValue: async (input: StoredSettingKey) => values.delete(keyOf(input)),
    },
  } as never);
};

const context = {
  extensionId: "pstdio.extension-lab",
  extensionInstanceId: "instance-1",
  installedExtensionId: "installed-1",
  definitions,
};

describe("extension settings service", () => {
  test("returns defaults and persists values to the declared owner", async () => {
    const service = createService();

    await expect(service.get(context, "counter.step")).resolves.toMatchObject({
      key: "counter.step",
      value: 1,
      source: "default",
    });

    await service.set(context, "counter.step", 3);
    await expect(service.get(context, "counter.step")).resolves.toMatchObject({
      key: "counter.step",
      value: 3,
      source: "stored",
    });
  });

  test("rejects unknown keys and invalid values", async () => {
    const service = createService();

    await expect(service.get(context, "not.declared")).rejects.toMatchObject({
      code: "extension_setting_unknown_key",
    });
    await expect(service.set(context, "counter.enabled", "yes")).rejects.toMatchObject({
      code: "extension_setting_invalid",
    });
    await expect(service.set(context, "greeting.tone", "sarcastic")).rejects.toMatchObject({
      code: "extension_setting_invalid",
    });
  });
});
