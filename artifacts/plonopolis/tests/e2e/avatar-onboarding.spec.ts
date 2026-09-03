import { expect, test } from "@playwright/test";

test("pierwszy wybór avatara blokuje grę i wyjaśnia zakres danych", async ({ page }) => {
  await page.goto("/?preview-avatar-onboarding=1");

  const onboarding = page.getByRole("dialog", { name: /Twój reprezentant/i });
  await expect(onboarding).toBeVisible();
  await expect(onboarding).toHaveAttribute("aria-modal", "true");
  await expect(onboarding.getByText("Twój reprezentant")).toBeVisible();
  await expect(onboarding.getByText(/awatar oraz przyszła waluta premium/i)).toBeVisible();
  await expect(onboarding.getByText(/poziom, zarobki, plony i ekwipunek pozostają oddzielne/i)).toBeVisible();

  await onboarding.getByRole("button", { name: /Mlody farmer/i }).click();
  await expect(onboarding.getByRole("button", { name: /Graj jako Mlody/i })).toBeEnabled();
  await expect(onboarding.getByRole("button", { name: /zamknij|anuluj/i })).toHaveCount(0);
});