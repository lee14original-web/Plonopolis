import { expect, test, type Page } from "@playwright/test";

async function openGame(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
  await expect(page.getByTestId("game-viewport")).toBeVisible();
  await expect(page.getByTestId("game-canvas")).toBeVisible();
}

async function readLayout(page: Page) {
  return page.getByTestId("game-viewport").evaluate((viewport) => {
    const canvas = viewport.querySelector<HTMLElement>('[data-testid="game-canvas"]');
    if (!canvas) throw new Error("Game canvas is missing");
    const viewportRect = viewport.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      viewportClientWidth: viewport.clientWidth,
      viewportClientHeight: viewport.clientHeight,
      viewportScrollWidth: viewport.scrollWidth,
      viewportScrollHeight: viewport.scrollHeight,
      viewportRect: { left: viewportRect.left, top: viewportRect.top },
      canvasRect: {
        left: canvasRect.left,
        top: canvasRect.top,
        right: canvasRect.right,
        bottom: canvasRect.bottom,
        width: canvasRect.width,
        height: canvasRect.height,
      },
    };
  });
}

test.describe("mobilny układ gry", () => {
  test("pionowy telefon mieści planszę w obszarze i pozwala przewijać pionowo", async ({ page }) => {
    await openGame(page, 390, 844);
    const layout = await readLayout(page);

    expect(layout.viewportClientWidth).toBe(390);
    expect(layout.viewportClientHeight).toBe(844);
    expect(layout.canvasRect.left).toBeGreaterThanOrEqual(-1);
    expect(layout.canvasRect.top).toBeGreaterThanOrEqual(-1);
    expect(layout.canvasRect.right).toBeLessThanOrEqual(layout.viewportScrollWidth + 1);
    expect(layout.canvasRect.bottom).toBeLessThanOrEqual(layout.viewportScrollHeight + 1);
    expect(layout.viewportScrollHeight).toBeGreaterThan(layout.viewportClientHeight);

    const beforeScrollTop = await page.getByTestId("game-viewport").evaluate((viewport) => {
      viewport.scrollTo(0, viewport.scrollHeight);
      return viewport.scrollTop;
    });
    expect(beforeScrollTop).toBeGreaterThan(0);

    await expect(page.getByText("Tylko komputer", { exact: false })).toHaveCount(0);
  });

  test("poziomy telefon zachowuje dopasowanie planszy do viewportu", async ({ page }) => {
    await openGame(page, 844, 390);
    const layout = await readLayout(page);

    expect(layout.viewportClientWidth).toBe(844);
    expect(layout.viewportClientHeight).toBe(390);
    expect(layout.canvasRect.left).toBeGreaterThanOrEqual(-1);
    expect(layout.canvasRect.top).toBeGreaterThanOrEqual(-1);
    expect(layout.canvasRect.right).toBeLessThanOrEqual(layout.viewportClientWidth + 1);
    expect(layout.canvasRect.bottom).toBeLessThanOrEqual(layout.viewportClientHeight + 1);

    await expect(page.getByText("Tylko komputer", { exact: false })).toHaveCount(0);
  });
});