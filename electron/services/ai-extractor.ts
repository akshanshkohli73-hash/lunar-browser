import { BrowserWindow, desktopCapturer } from 'electron';
import { TabManager } from '../browser/tab-manager';

export async function getPageText(tabManager: TabManager, tabId?: string): Promise<string> {
  const tab = tabId ? tabManager.getTab(tabId) : tabManager.getActiveTab();
  if (!tab || tab.info.url.startsWith('lunar://')) {
    return 'Lunar Internal Page Context';
  }

  try {
    const text = await tab.view.webContents.executeJavaScript(`
      document.body ? document.body.innerText : ''
    `);
    return text || '';
  } catch (err) {
    console.error('Failed to extract page text:', err);
    return '';
  }
}

export async function captureTabScreenshot(tabManager: TabManager, tabId?: string): Promise<string> {
  const tab = tabId ? tabManager.getTab(tabId) : tabManager.getActiveTab();
  if (!tab) return '';

  try {
    const nativeImage = await tab.view.webContents.capturePage();
    return nativeImage.toDataURL();
  } catch (err) {
    console.error('Failed to capture screenshot:', err);
    return '';
  }
}
