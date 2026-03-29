import { expect, test } from "@playwright/test";

test("capture/mortgage loads without error", async ({ page }) => {
  await page.goto("/capture/mortgage");
  await expect(
    page.getByText("When does your mortgage come up for renewal?"),
  ).toBeVisible();
});

test("capture/mortgage completes first step via option click", async ({
  page,
}) => {
  await page.goto("/capture/mortgage");
  await page.getByText("Within 6 months").click();
  await expect(
    page.getByText("Got it. And what province are you in?").first(),
  ).toBeVisible();
});

test("capture/mortgage shows validation error on bad postal code", async ({
  page,
}) => {
  await page.goto("/capture/mortgage");
  await page.getByText("Within 6 months").click();
  await page.getByRole("button", { name: "MB" }).click();
  await page.getByPlaceholder("Your name").fill("Test User");
  await page.keyboard.press("Enter");
  await page.getByPlaceholder("Phone number").fill("2042231234");
  await page.keyboard.press("Enter");
  await page.getByPlaceholder("e.g. M5V 2T6").fill("BADPOSTAL");
  await page.keyboard.press("Enter");
  await expect(page.locator("p[role='alert']")).toContainText(/postal/i);
});

test("capture/unknown vertical returns 404", async ({ page }) => {
  const response = await page.goto("/capture/unknown");
  expect(response?.status()).toBe(404);
});
