import fs from "node:fs";
import type { Protocol } from "electron";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { mediaIdSchema } from "../../shared/dashboard";
export interface WallpaperAsset {
  id: string;
  kind: "image" | "video";
}
const types: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};
export function detectMedia(bytes: Buffer): string | null {
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  if (
    bytes.toString("ascii", 4, 8) === "ftyp" &&
    /^(?:isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV)$/u.test(
      bytes.toString("ascii", 8, 12),
    )
  )
    return "mp4";
  if (
    bytes.subarray(0, 4).toString("hex") === "1a45dfa3" &&
    bytes.subarray(0, 4096).includes(Buffer.from("webm"))
  )
    return "webm";
  return null;
}
export function byteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!header) return { start: 0, end: size - 1 };
  const parts = /^bytes=(\d*)-(\d*)$/u.exec(header);
  if (!parts || (!parts[1] && !parts[2])) return null;
  let start = Number(parts[1]),
    end = parts[2] ? Number(parts[2]) : size - 1;
  if (!parts[1]) {
    const suffix = Number(parts[2]);
    if (suffix < 1) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    return null;
  return { start, end: Math.min(end, size - 1) };
}
export class WallpaperStore {
  private readonly root: string;
  private importing: Promise<void> = Promise.resolve();
  private activeCopies = new Set<string>();
  constructor(profile: string) {
    this.root = path.join(profile, "wallpapers");
  }
  private assertRoot() {
    const stat = fs.lstatSync(this.root);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("Wallpaper storage is not a regular profile directory.");
  }
  private file(id: string) {
    this.assertRoot();
    const safe = mediaIdSchema.parse(id);
    const file = path.join(this.root, safe),
      stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("Wallpaper is not a regular local file.");
    return { file, stat };
  }
  public assertAsset(id: string, kind: "image" | "video") {
    const { file } = this.file(id);
    const mime = types[path.extname(file).slice(1)];
    if (!mime?.startsWith(kind + "/"))
      throw new Error("Wallpaper format does not match its media type.");
  }
  /** Called only with a path returned by the native file chooser, never a renderer path. */
  public importSelectedFile(selected: string): Promise<WallpaperAsset> {
    // Serialize quota checks/copies; large local media never blocks the Electron UI thread.
    const result = this.importing.then(() => this.copySelectedFile(selected));
    this.importing = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  private async copySelectedFile(selected: string): Promise<WallpaperAsset> {
    const input = await fs.promises.open(selected, "r");
    try {
      const stat = await input.stat();
      if (!stat.isFile() || stat.size < 12 || stat.size > 150 * 1024 * 1024)
        throw new Error("Choose a regular image/video file under 150 MB.");
      const bytes = Buffer.alloc(Math.min(stat.size, 4096));
      await input.read(bytes, 0, bytes.length, 0);
      const extension = detectMedia(bytes);
      if (!extension)
        throw new Error(
          "Supported wallpapers: PNG, JPEG, WebP, MP4 and WebM. SVG, executables and unknown file contents are refused.",
        );
      const kind =
        extension === "mp4" || extension === "webm" ? "video" : "image";
      if (kind === "image" && stat.size > 20 * 1024 * 1024)
        throw new Error("Image wallpapers must be under 20 MB.");
      fs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
      this.assertRoot();
      const names = fs.readdirSync(this.root);
      const existing = names.filter(
        (name) => mediaIdSchema.safeParse(name).success,
      );
      // Interrupted .tmp copies still occupy disk and count toward the byte quota.
      const used = names
        .filter(
          (name) =>
            mediaIdSchema.safeParse(name).success ||
            (name.endsWith(".tmp") &&
              mediaIdSchema.safeParse(name.slice(0, -4)).success),
        )
        .reduce((total, name) => {
          const stat = fs.lstatSync(path.join(this.root, name));
          if (!stat.isFile() || stat.isSymbolicLink())
            throw new Error("Wallpaper is not a regular profile file.");
          return total + stat.size;
        }, 0);
      if (existing.length >= 20 || used + stat.size > 300 * 1024 * 1024)
        throw new Error(
          "Wallpaper storage is full (20 files / 300 MB). Remove unused wallpapers before importing more.",
        );
      const id = `${randomUUID()}.${extension}`,
        temporary = path.join(this.root, `${id}.tmp`),
        destination = path.join(this.root, id);
      const output = await fs.promises.open(temporary, "wx", 0o600);
      this.activeCopies.add(`${id}.tmp`);
      try {
        try {
          const chunk = Buffer.alloc(1024 * 1024);
          let offset = 0;
          while (offset < stat.size) {
            const { bytesRead: count } = await input.read(
              chunk,
              0,
              Math.min(chunk.length, stat.size - offset),
              offset,
            );
            if (!count)
              throw new Error(
                "The selected file changed while being imported.",
              );
            let written = 0;
            while (written < count) {
              const { bytesWritten } = await output.write(
                chunk,
                written,
                count - written,
              );
              if (!bytesWritten)
                throw new Error("The wallpaper copy could not be completed.");
              written += bytesWritten;
            }
            offset += count;
          }
          const final = await input.stat();
          if (final.size !== stat.size || final.mtimeMs !== stat.mtimeMs)
            throw new Error("The selected file changed while being imported.");
          await output.sync();
        } finally {
          await output.close();
        }
        await fs.promises.rename(temporary, destination);
        return { id, kind };
      } catch (error) {
        await fs.promises.rm(temporary, { force: true });
        throw error;
      } finally {
        this.activeCopies.delete(`${id}.tmp`);
      }
    } finally {
      await input.close();
    }
  }
  public prune(keep: string | null): number {
    if (!fs.existsSync(this.root)) return 0;
    this.assertRoot();
    let removed = 0;
    for (const name of fs.readdirSync(this.root)) {
      const orphan =
        name.endsWith(".tmp") &&
        mediaIdSchema.safeParse(name.slice(0, -4)).success &&
        !this.activeCopies.has(name);
      if (name !== keep && (mediaIdSchema.safeParse(name).success || orphan)) {
        const stat = fs.lstatSync(path.join(this.root, name));
        if (!stat.isFile() || stat.isSymbolicLink())
          throw new Error("Wallpaper is not a regular profile file.");
        fs.unlinkSync(path.join(this.root, name));
        removed++;
      }
    }
    return removed;
  }
  public response(request: Request): Response {
    try {
      const url = new URL(request.url);
      if (
        url.protocol !== "lunar-media:" ||
        url.hostname !== "wallpaper" ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash ||
        !["GET", "HEAD"].includes(request.method)
      )
        return new Response(null, { status: 403 });
      const id = url.pathname.slice(1),
        { file, stat } = this.file(id);
      const range = byteRange(request.headers.get("range"), stat.size);
      if (!range)
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${stat.size}` },
        });
      const partial = request.headers.has("range"),
        headers: Record<string, string> = {
          "Content-Type": types[path.extname(id).slice(1)],
          "Content-Length": String(range.end - range.start + 1),
          "Accept-Ranges": "bytes",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
          "Content-Security-Policy": "default-src 'none'",
        };
      if (partial)
        headers["Content-Range"] =
          `bytes ${range.start}-${range.end}/${stat.size}`;
      const body =
        request.method === "HEAD"
          ? null
          : (Readable.toWeb(
              fs.createReadStream(file, range),
            ) as ReadableStream<Uint8Array>);
      return new Response(body, { status: partial ? 206 : 200, headers });
    } catch {
      return new Response(null, { status: 404 });
    }
  }
}

/** Electron throws when unhandle is called for a scheme with no handler yet. */
export async function registerWallpaperProtocol(
  protocol: Pick<Protocol, "handle" | "unhandle" | "isProtocolHandled">,
  store: Pick<WallpaperStore, "response">,
): Promise<void> {
  if (await protocol.isProtocolHandled("lunar-media"))
    protocol.unhandle("lunar-media");
  protocol.handle("lunar-media", (request) => store.response(request));
}
