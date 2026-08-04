export const AUTOMATION_ENABLED_KEY = "automation.enabled";

interface LoadAutomationEnabledInput {
  load: () => Promise<Record<string, unknown>>;
  setEnabled: (enabled: boolean) => void;
  setLoading: (loading: boolean) => void;
}

interface SaveAutomationEnabledInput {
  checked: boolean;
  current: boolean;
  save: (checked: boolean) => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setSaving: (saving: boolean) => void;
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const loadAutomationEnabled = async (input: LoadAutomationEnabledInput) => {
  const { load, setEnabled, setLoading } = input;

  try {
    const values = await load();
    setEnabled(values[AUTOMATION_ENABLED_KEY] === true);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: errorMessage(error, "Failed to load planner automation setting."),
    };
  } finally {
    setLoading(false);
  }
};

export const saveAutomationEnabled = async (input: SaveAutomationEnabledInput) => {
  const { checked, current, save, setEnabled, setSaving } = input;

  setEnabled(checked);
  setSaving(true);

  try {
    await save(checked);
    return { ok: true as const };
  } catch (error) {
    setEnabled(current);
    return {
      ok: false as const,
      message: errorMessage(error, "Failed to save planner automation setting."),
    };
  } finally {
    setSaving(false);
  }
};
