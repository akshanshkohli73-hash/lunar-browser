import { z } from "zod";
import { isInternalUrl, isWebUrl } from "./navigation";

export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/u);
export const destinationSchema = z
  .string()
  .max(8192)
  .refine(
    (value) => isWebUrl(value) || isInternalUrl(value),
    "Use a supported HTTP, HTTPS or Lunar destination.",
  );
const hostname = z
  .string()
  .max(253)
  .regex(/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)*[a-z\d](?:[a-z\d-]*[a-z\d])?$/u);
export const shieldSettingsSchema = z
  .object({
    enabled: z.boolean(),
    ads: z.boolean(),
    trackers: z.boolean(),
    telemetry: z.boolean(),
    social: z.boolean(),
    cryptomining: z.boolean(),
    popups: z.boolean(),
    allowlist: z.array(hostname).max(500),
    filterLists: z
      .array(z.enum(["lunar-core", "stevenblack"]))
      .min(1)
      .max(2),
  })
  .strict();
const color = z
  .string()
  .max(64)
  .refine((value) => {
    if (/^#[a-f\d]{6}$/iu.test(value)) return true;
    const parts =
      /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/iu.exec(
        value,
      );
    return !!parts && parts.slice(1, 4).every((part) => Number(part) <= 255);
  }, "Use a six-digit hex or RGB(A) color.");
export const themeSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(40),
    description: z.string().max(200),
    category: z.enum(["dark", "light", "pastel", "cyber"]),
    colors: z
      .object({
        bg: color,
        bgSecondary: color,
        surface: color,
        surfaceHover: color,
        border: color,
        text: color,
        textMuted: color,
        primary: color,
        secondary: color,
        accent: color,
        glow: color,
      })
      .strict(),
    appearance: z
      .object({
        glassIntensity: z.number().min(0).max(1),
        blur: z.number().min(0).max(32),
        glowIntensity: z.number().min(0).max(1),
        shadowStrength: z.number().min(0).max(1),
        borderBrightness: z.number().min(0).max(1),
        cornerRadius: z.number().min(0).max(24),
      })
      .strict(),
    typography: z
      .object({
        fontFamily: z
          .string()
          .min(1)
          .max(160)
          .regex(/^[\w\s"',-]+$/u),
        fontSize: z.enum(["compact", "comfortable", "spacious"]),
        uiScale: z.number().min(0.8).max(1.2),
      })
      .strict(),
    layout: z
      .object({
        density: z.enum(["compact", "comfortable", "spacious"]),
        tabStyle: z.enum(["minimal", "rounded", "pill"]),
      })
      .strict(),
  })
  .strict();
export const settingsSchema = z
  .object({
    searchEngine: z.enum(["google", "bing", "duckduckgo"]),
    themeId: idSchema,
    customTheme: themeSchema.optional(),
    reducedMotion: z.boolean(),
    showBookmarksBar: z.boolean(),
    recordHistory: z.boolean(),
    restoreSession: z.boolean(),
    isFirstRun: z.boolean(),
    shield: shieldSettingsSchema,
    aiEnabled: z.boolean(),
    aiProvider: z.enum(["openrouter", "gemini"]),
    aiModel: z
      .string()
      .max(100)
      .regex(/^[a-zA-Z\d._:/-]*$/u),
  })
  .strict();
export const bookmarkInputSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    url: destinationSchema,
    folder: z.string().trim().max(60).default(""),
  })
  .strict();
export const bookmarkSchema = bookmarkInputSchema
  .extend({ id: idSchema, createdAt: z.number().finite().nonnegative() })
  .strict();
export const historySchema = z
  .object({
    id: idSchema,
    url: z.string().max(8192).refine(isWebUrl),
    title: z.string().max(500),
    visitTime: z.number().finite().nonnegative(),
  })
  .strict();
export const sessionSchema = z
  .object({
    tabs: z
      .array(
        z.object({ url: destinationSchema, isPinned: z.boolean() }).strict(),
      )
      .max(100),
    activeIndex: z.number().int().min(0).max(99),
  })
  .strict();
export const boundsSchema = z
  .object({
    x: z.number().finite().min(-16384).max(16384),
    y: z.number().finite().min(-16384).max(16384),
    width: z.number().finite().min(0).max(16384),
    height: z.number().finite().min(0).max(16384),
  })
  .strict();
export const layoutSchema = z
  .object({ tabId: idSchema, bounds: boundsSchema, visible: z.boolean() })
  .strict();
export const aiRequestSchema = z
  .object({
    prompt: z.string().trim().min(1).max(8000),
    tabId: idSchema.optional(),
    sharePageContext: z.boolean(),
  })
  .strict();
export const extensionRecordSchema = z
  .object({
    id: idSchema,
    path: z.string().min(1).max(4096),
    enabled: z.boolean(),
    approvedHash: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();
export const downloadSchema = z
  .object({
    id: idSchema,
    filename: z.string().max(255),
    url: z.string().max(8192),
    savePath: z.string().max(4096),
    receivedBytes: z.number().nonnegative(),
    totalBytes: z.number().nonnegative(),
    speed: z.number().nonnegative(),
    canResume: z.boolean().default(false),
    canCancel: z.boolean().default(false),
    status: z.enum([
      "progressing",
      "completed",
      "cancelled",
      "interrupted",
      "paused",
    ]),
    startTime: z.number().nonnegative(),
    error: z.string().max(500).optional(),
  })
  .strict();
export type BrowserSettings = z.infer<typeof settingsSchema>;
export type ShieldSettings = z.infer<typeof shieldSettingsSchema>;
export type Bookmark = z.infer<typeof bookmarkSchema>;
export type BookmarkInput = z.input<typeof bookmarkInputSchema>;
export type HistoryItem = z.infer<typeof historySchema>;
export type SessionState = z.infer<typeof sessionSchema>;
export type WorkspaceLayout = z.infer<typeof layoutSchema>;
export type ThemeTokens = z.infer<typeof themeSchema>;
export type AIRequest = z.infer<typeof aiRequestSchema>;
export type ExtensionRecord = z.infer<typeof extensionRecordSchema>;
export type DownloadItemInfo = z.infer<typeof downloadSchema>;
