import { test, expect } from "@playwright/test";
import { expectNoCrash, gotoReady } from "../helpers/app";

test.describe("responsive chrome", () => {
	test("mobile menu opens and lists primary destinations", async ({ page }) => {
		await gotoReady(page, "/dashboard");
		const burger = page.locator("header button.cursor-pointer").filter({ has: page.locator("svg") });
		await burger.click({ force: true });
		const menu = page.locator("aside menu");
		await expect(menu.getByText("Dashboard")).toBeVisible();
		await expect(menu.getByText("Swap")).toBeVisible();
		await expect(menu.getByText("Lending")).toBeVisible();
		await expect(menu.getByText("Savings")).toBeVisible();
		await expect(menu.getByText("Equity")).toBeVisible();
		await menu.getByText("Swap").click();
		await expect(page).toHaveURL(/swap/);
		await expectNoCrash(page);
	});
});
