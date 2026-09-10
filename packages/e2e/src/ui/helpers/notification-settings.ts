import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ notificationsEnabled: boolean }>({
  notificationsEnabled: [false, { option: true }],
  page: async ({ page, request, notificationsEnabled }, use) => {
    // Preferences belong to the runtime and survive project cleanup.
    const response = await request.get("/v1/settings");
    expect(response.ok()).toBe(true);
    const previous = (await response.json()) as { notifications_enabled: boolean };
    try {
      const updated = await request.patch("/v1/settings", {
        data: { notifications_enabled: notificationsEnabled },
      });
      expect(updated.ok()).toBe(true);
      await use(page);
    } finally {
      const restored = await request.patch("/v1/settings", {
        data: { notifications_enabled: previous.notifications_enabled },
      });
      expect(restored.ok()).toBe(true);
    }
  },
});
