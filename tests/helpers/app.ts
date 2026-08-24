import { expect, Page, Locator } from "@playwright/test";
import { ROUTES } from "./constants";

export async function waitForApp(page: Page, timeout = 90_000): Promise<void> {
	const loading = page.getByText("dEURO is loading...");
	const appeared = await loading.isVisible({ timeout: 5_000 }).catch(() => false);
	if (appeared) {
		await expect(loading).toHaveCount(0, { timeout });
	}
	await expect(page.locator("header")).toBeVisible({ timeout: 20_000 });
}

export async function gotoReady(page: Page, path: string): Promise<void> {
	const response = await page.goto(path, { waitUntil: "domcontentloaded" });
	expect(response, `GET ${path} should respond`).not.toBeNull();
	expect(response!.status(), `GET ${path} status`).toBeLessThan(500);
	await waitForApp(page);
}

export async function expectNoCrash(page: Page): Promise<void> {
	await expect(page.locator("body")).toBeVisible();
	await expect(page.getByText("Application error: a client-side exception has occurred")).toHaveCount(0);
	await expect(page.getByText("You seem to be in the wrong place")).toHaveCount(0);
}

export async function openExpertMode(page: Page): Promise<void> {
	const label = page.locator("label").filter({ hasText: "Expert Mode" }).first();
	await expect(label).toBeVisible();
	const checkbox = label.locator('input[type="checkbox"]');
	if (await checkbox.count()) {
		if (!(await checkbox.isChecked())) await label.click();
	} else {
		await label.click();
	}
}

export async function fillVisibleInput(page: Page, value: string): Promise<boolean> {
	const input = page.locator('input:visible:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])').first();
	if (!(await input.count())) return false;
	if (!(await input.isVisible().catch(() => false))) return false;
	await input.fill(value);
	return true;
}

export async function openLanguageMenu(page: Page): Promise<Locator> {
	const globe = page.locator("header button").filter({ has: page.locator("svg") }).last();
	await globe.click();
	return page.getByText("Language", { exact: false }).first();
}

export async function clickNav(page: Page, name: string): Promise<void> {
	const link = page.locator("header").getByRole("link", { name }).or(page.locator("header").getByText(name, { exact: true })).first();
	await link.click();
	await waitForApp(page);
}

export { ROUTES };
