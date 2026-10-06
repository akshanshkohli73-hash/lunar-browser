import { session, DownloadItem, WebContents, shell } from 'electron';
import { DownloadItemInfo } from '../types';

export class DownloadManager {
  private downloads: Map<string, { item: DownloadItem; info: DownloadItemInfo }> = new Map();
  private onDownloadsUpdateCallback?: (downloads: DownloadItemInfo[]) => void;

  constructor(onDownloadsUpdate?: (downloads: DownloadItemInfo[]) => void) {
    this.onDownloadsUpdateCallback = onDownloadsUpdate;
    this.initDownloadListener();
  }

  private initDownloadListener() {
    session.defaultSession.on('will-download', (event, item, webContents) => {
      const id = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const fileName = item.getFilename();
      const totalBytes = item.getTotalBytes();
      const savePath = item.getSavePath();

      const info: DownloadItemInfo = {
        id,
        filename: fileName,
        url: item.getURL(),
        savePath,
        receivedBytes: 0,
        totalBytes,
        speed: 0,
        status: 'progressing',
        startTime: Date.now(),
      };

      this.downloads.set(id, { item, info });
      this.notifyUpdates();

      item.on('updated', (event, state) => {
        if (state === 'interrupted') {
          info.status = 'interrupted';
        } else if (state === 'progressing') {
          if (item.isPaused()) {
            info.status = 'paused';
          } else {
            info.status = 'progressing';
            info.receivedBytes = item.getReceivedBytes();
            const elapsedSeconds = (Date.now() - info.startTime) / 1000;
            info.speed = elapsedSeconds > 0 ? Math.round(info.receivedBytes / elapsedSeconds) : 0;
          }
        }
        this.notifyUpdates();
      });

      item.once('done', (event, state) => {
        if (state === 'completed') {
          info.status = 'completed';
          info.receivedBytes = info.totalBytes;
        } else if (state === 'cancelled') {
          info.status = 'cancelled';
        } else {
          info.status = 'interrupted';
        }
        this.notifyUpdates();
      });
    });
  }

  public getDownloads(): DownloadItemInfo[] {
    return Array.from(this.downloads.values()).map((d) => d.info);
  }

  public cancelDownload(id: string) {
    const entry = this.downloads.get(id);
    if (entry && entry.info.status === 'progressing') {
      entry.item.cancel();
      entry.info.status = 'cancelled';
      this.notifyUpdates();
    }
  }

  public pauseDownload(id: string) {
    const entry = this.downloads.get(id);
    if (entry && entry.info.status === 'progressing') {
      entry.item.pause();
      entry.info.status = 'paused';
      this.notifyUpdates();
    }
  }

  public resumeDownload(id: string) {
    const entry = this.downloads.get(id);
    if (entry && entry.info.status === 'paused') {
      if (entry.item.canResume()) {
        entry.item.resume();
        entry.info.status = 'progressing';
        this.notifyUpdates();
      }
    }
  }

  public revealDownload(id: string) {
    const entry = this.downloads.get(id);
    if (entry && entry.info.savePath) {
      shell.showItemInFolder(entry.info.savePath);
    }
  }

  private notifyUpdates() {
    if (this.onDownloadsUpdateCallback) {
      this.onDownloadsUpdateCallback(this.getDownloads());
    }
  }
}
