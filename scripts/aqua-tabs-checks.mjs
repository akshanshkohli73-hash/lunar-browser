// Exercises real BrowserTabs against the existing Electron TabManager/IPC.
// No mocked preload, browser engine, DOM measurements or native view.
import assert from "node:assert/strict";
import fs from "node:fs";
import { expect } from "@playwright/test";
export async function checkNativeAquaTabs(ui, api, evidence) {
  const initial = (await api("bootstrap")).tabs,
    created = [];
  const tab = (id) => ui.locator(`[role="tab"][data-tab-id="${id}"]`);
  const state = async () => (await api("bootstrap")).tabs;
  try {
    for (let i = 0; i < 8; i++) created.push(await api("createTab"));
    await expect(ui.getByRole("tab")).toHaveCount(initial.tabs.length + 8);
    const last = tab(created.at(-1).id);
    await expect(last).toHaveAttribute("aria-selected", "true");
    await last.focus();
    await last.press("Home");
    await expect(tab(initial.tabs[0].id)).toBeFocused();
    assert.equal(
      (await state()).activeTabId,
      created.at(-1).id,
      "Exploring a tab cannot activate a page or steal focus into its native view",
    );
    const right = ui.getByRole("button", {
      name: "Scroll tabs right",
      exact: true,
    });
    await expect(right).toBeEnabled();
    const list = ui.getByRole("tablist", { name: "Browser tabs", exact: true });
    const previousScroll = await list.evaluate((node) => node.scrollLeft);
    await right.click();
    await expect
      .poll(() => list.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(previousScroll);
    await tab(initial.tabs[0].id).focus();
    await tab(initial.tabs[0].id).press("ArrowRight");
    await expect(tab(created[0].id)).toBeFocused();
    await tab(created[0].id).press("Delete");
    await expect(tab(created[0].id)).toHaveCount(0);
    assert.equal((await state()).activeTabId, created.at(-1).id);
    await expect(tab(created[1].id)).toBeFocused();
    await tab(created[1].id).press("Home");
    await tab(initial.tabs[0].id).press("Enter");
    await expect(tab(initial.tabs[0].id)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await tab(initial.tabs[0].id).focus();
    await tab(initial.tabs[0].id).press("End");
    await expect(last).toBeFocused();
    await last.press(" ");
    await expect(last).toHaveAttribute("aria-selected", "true");
    await last.focus();
    await last.press("ArrowRight");
    await expect(tab(initial.tabs[0].id)).toBeFocused();
    // Test actual native HTML drag events, rather than invoking reorderTabs alone.
    const before = (await state()).tabs.map((item) => item.id),
      from = created[1].id,
      target = created[3].id;
    const reordered = before.filter((id) => id !== from);
    reordered.splice(reordered.indexOf(target), 0, from);
    await tab(from).locator("..").dragTo(tab(target).locator(".."));
    await expect
      .poll(async () => (await state()).tabs.map((item) => item.id))
      .toEqual(reordered);
    // Background reorder must not discard a draft or move native/browser bounds.
    await api("switchTab", initial.activeTabId);
    const address = ui.getByRole("textbox", {
      name: "Address and search",
      exact: true,
    });
    await address.fill("keep-aqua-address-draft");
    await api("reorderTabs", before);
    await expect(address).toHaveValue("keep-aqua-address-draft");
    await expect(address).toBeFocused();
    const activeBox = await tab(initial.activeTabId).boundingBox(),
      listBox = await list.boundingBox();
    assert.ok(
      activeBox &&
        listBox &&
        activeBox.x >= listBox.x - 1 &&
        activeBox.x + activeBox.width <= listBox.x + listBox.width + 1,
      "Active tab is revealed within the real scrolling strip",
    );
    await ui.screenshot({ path: `${evidence}-aqua-tabs.png` });
    fs.writeFileSync(
      `${evidence}-aqua-tabs.json`,
      JSON.stringify(
        {
          keyboardManualActivation: true,
          homeEndAndWrap: true,
          deleteAndFocusRecovery: true,
          actualHTMLDragOrder: reordered,
          overflowScroll: true,
          addressDraftRetained: true,
          activeRevealed: true,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await api("switchTab", initial.activeTabId);
    for (const item of created)
      if ((await state()).tabs.some((existing) => existing.id === item.id))
        await api("closeTab", item.id);
  }
  // Do not let a cleanup assertion mask an earlier keyboard/drag failure.
  await expect(ui.getByRole("tab")).toHaveCount(initial.tabs.length);
  await expect(
    ui.getByRole("button", { name: "Scroll tabs right", exact: true }),
  ).toHaveCount(0);
}
