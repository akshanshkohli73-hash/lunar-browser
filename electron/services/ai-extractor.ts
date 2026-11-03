import type { TabManager } from "../browser/tab-manager";
import { isWebUrl } from "../../shared/navigation";
export async function getPageText(
  tabManager: TabManager,
  tabId: string,
): Promise<string> {
  const tab = tabManager.getTab(tabId);
  if (!tab || !isWebUrl(tab.info.url) || tab.view.webContents.isDestroyed())
    throw new Error("Open a webpage before using this feature.");
  const before = tab.info.url;
  const text: unknown = await tab.view.webContents.executeJavaScript(
    "document.body ? document.body.innerText.slice(0, 60000) : ''",
  );
  if (tab.view.webContents.isDestroyed() || tab.info.url !== before)
    throw new Error("The page changed. Try again on the current page.");
  if (typeof text !== "string")
    throw new Error("Could not read this page as text.");
  return text.slice(0, 60000);
}
