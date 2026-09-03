import { expect, test } from "@playwright/test";

test("blokuje automatyczne tłumaczenie i zachowuje działający formularz", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("game-viewport")).toBeVisible();

  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.locator("html")).toHaveAttribute("translate", "no");
  await expect(page.locator("html")).toHaveClass(/notranslate/);
  await expect(page.locator('meta[name="google"]')).toHaveAttribute("content", "notranslate");

  await expect(page.getByRole("button", { name: "Logowanie" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rejestracja" })).toBeVisible();
  await expect(page.getByText("Testy", { exact: true })).toBeVisible();

  const guardResult = await page.evaluate(() => {
    const expectedParent = document.createElement("div");
    const translatedWrapper = document.createElement("font");
    const movedChild = document.createTextNode("Testy");
    expectedParent.appendChild(movedChild);
    translatedWrapper.appendChild(movedChild);

    let removeChildThrew = false;
    try {
      expectedParent.removeChild(movedChild);
    } catch {
      removeChildThrew = true;
    }

    const staleReference = document.createTextNode("stary tekst");
    translatedWrapper.appendChild(staleReference);
    const insertedNode = document.createTextNode("nowy tekst");

    let insertBeforeThrew = false;
    try {
      expectedParent.insertBefore(insertedNode, staleReference);
    } catch {
      insertBeforeThrew = true;
    }

    return {
      removeChildThrew,
      insertBeforeThrew,
      insertedNodeWasAppended: insertedNode.parentNode === expectedParent,
    };
  });

  expect(guardResult).toEqual({
    removeChildThrew: false,
    insertBeforeThrew: false,
    insertedNodeWasAppended: true,
  });

  await page.getByRole("button", { name: "Rejestracja" }).click();
  await expect(page.getByRole("button", { name: "Utwórz gospodarstwo" })).toBeVisible();
  await page.getByRole("button", { name: "Logowanie" }).click();
  await expect(page.getByRole("button", { name: "Zaloguj i wczytaj sesję" })).toBeVisible();
});