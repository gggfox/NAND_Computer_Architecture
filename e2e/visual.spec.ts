import { createProject, expect, output, pickTheme, setInputs, test, THEMES } from "./support";

const slug = (theme: string): string => theme.toLowerCase().replaceAll(" ", "-");

/*
 * Canvas baselines are Linux-only: generate them with `pnpm e2e:visual:docker --update-snapshots`
 * (or in CI). `pnpm e2e` excludes @visual, so a missing baseline never fails it.
 */
for (const theme of THEMES) {
  test(
    `demo canvas with A = 1 and B = 1 in the ${theme} theme`,
    { tag: "@visual" },
    async ({ page }) => {
      await createProject(page);
      await pickTheme(page, theme);
      await setInputs(page, true, true);
      await expect(output(page)).toHaveText("Output OUT: 0");
      // The main canvas; its screenshot includes the minimap drawn over its corner.
      await expect(page.locator("canvas").first()).toHaveScreenshot(`demo-${slug(theme)}.png`);
    },
  );
}
