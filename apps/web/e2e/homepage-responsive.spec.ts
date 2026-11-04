import { expect, test } from "@playwright/test";

const AUDIT_WIDTHS = [320, 375, 390, 430, 768, 820, 1024, 1280];

test("homepage has no horizontal overflow at audited viewport widths", async ({ page }) => {
  await page.setViewportSize({ width: AUDIT_WIDTHS[0], height: 900 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  const overflows = [];

  for (const width of AUDIT_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });

    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const overflowingElements = Array.from(document.querySelectorAll("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            text: element.textContent?.trim().slice(0, 80),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
          };
        })
        .filter((element) => element.right > root.clientWidth);

      return {
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        overflowingElements,
      };
    });

    if (layout.scrollWidth > layout.clientWidth) {
      overflows.push({ width, ...layout });
    }
  }

  expect(overflows, `horizontal overflow by viewport width: ${JSON.stringify(overflows)}`).toEqual([]);
});
