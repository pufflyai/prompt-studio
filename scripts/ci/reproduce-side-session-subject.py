from pathlib import Path
p = Path("packages/e2e/src/ui/session-chat-links.p2.spec.ts")
s = p.read_text()
before = """    await page.goto(`/projects/${project.id}`);
    await openSessionSidePanel(page, session.title);"""
after = """    // Establish the subject after the real provider catalog reaches an already-open generic Side shell.
    const catalog = Promise.withResolvers<void>();
    await page.route(`**/v1/projects/${project.id}/extensions/ui`, async (route) => {
      await catalog.promise;
      await route.continue();
    });
    await page.goto(`/projects/${project.id}`);
    await Promise.all([
      openSessionSidePanel(page, session.title),
      expect(page.getByTestId("workbench-side-panel-attached"))
        .toBeVisible()
        .finally(() => catalog.resolve()),
    ]);"""
assert s.count(before) == 1
p.write_text(s.replace(before,after))
