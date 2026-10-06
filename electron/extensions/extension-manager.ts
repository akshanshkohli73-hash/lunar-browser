import { session, dialog } from 'electron';
import { ExtensionInfo } from '../types';
import fs from 'fs';
import path from 'path';

export class ExtensionManager {
  private extensions: Map<string, ExtensionInfo> = new Map();

  public async loadUnpackedExtension(): Promise<ExtensionInfo | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Unpacked Extension Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const extPath = result.filePaths[0];
    const manifestPath = path.join(extPath, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error('No manifest.json found in the selected folder');
    }

    try {
      const ext = await session.defaultSession.loadExtension(extPath, { allowFileAccess: true });
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      const info: ExtensionInfo = {
        id: ext.id,
        name: ext.name || manifest.name || 'Unpacked Extension',
        version: ext.version || manifest.version || '1.0.0',
        description: manifest.description || 'Custom unpacked Chrome WebExtension',
        enabled: true,
        permissions: manifest.permissions || [],
        compatibility: manifest.manifest_version === 3 ? 'FULL' : 'PARTIAL',
        path: extPath,
      };

      this.extensions.set(ext.id, info);
      return info;
    } catch (err: any) {
      console.error('Failed to load extension:', err);
      throw new Error(`Extension load failed: ${err.message}`);
    }
  }

  public getExtensions(): ExtensionInfo[] {
    return Array.from(this.extensions.values());
  }

  public toggleExtension(id: string, enabled: boolean): boolean {
    const ext = this.extensions.get(id);
    if (ext) {
      ext.enabled = enabled;
      return true;
    }
    return false;
  }

  public removeExtension(id: string): boolean {
    return this.extensions.delete(id);
  }
}
