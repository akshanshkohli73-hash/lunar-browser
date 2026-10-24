import { z } from "zod";
import { destinationSchema, idSchema } from "./schemas";

export const mediaIdSchema = z
  .string()
  .regex(
    /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\.(?:png|jpg|webp|mp4|webm)$/u,
  );
export const wallpaperSchema = z
  .object({
    kind: z.enum(["builtin", "image", "video"]),
    builtin: z.enum(["meadow", "rose", "midnight"]),
    mediaId: mediaIdSchema.nullable(),
    fit: z.enum(["cover", "contain"]),
    position: z.enum(["center", "top", "bottom"]),
    overlay: z.number().min(0).max(0.85),
    blur: z.number().min(0).max(20),
    loop: z.boolean(),
    audioControls: z.boolean(),
    effects: z.boolean(),
  })
  .strict()
  .refine(
    (value) =>
      value.kind === "builtin"
        ? value.mediaId === null
        : value.mediaId !== null,
    "Choose a valid local wallpaper.",
  );
const base = z.object({
  id: idSchema,
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(199),
  w: z.number().int().min(3).max(12),
  h: z.number().int().min(2).max(8),
  visible: z.boolean(),
});
const link = z
  .object({ title: z.string().trim().min(1).max(60), url: destinationSchema })
  .strict();
export const widgetSchema = z.discriminatedUnion("kind", [
  base
    .extend({
      kind: z.literal("clock"),
      config: z.object({ hour24: z.boolean(), showDate: z.boolean() }).strict(),
    })
    .strict(),
  base
    .extend({
      kind: z.literal("search"),
      config: z.object({ placeholder: z.string().max(80) }).strict(),
    })
    .strict(),
  base
    .extend({
      kind: z.literal("bookmarks"),
      config: z
        .object({
          folder: z.string().max(60),
          limit: z.number().int().min(1).max(12),
        })
        .strict(),
    })
    .strict(),
  base
    .extend({
      kind: z.literal("weather"),
      config: z
        .object({
          location: z.string().max(60),
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          units: z.enum(["celsius", "fahrenheit"]),
          consent: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  base
    .extend({
      kind: z.literal("calendar"),
      config: z.object({ mondayFirst: z.boolean() }).strict(),
    })
    .strict(),
  base
    .extend({
      kind: z.literal("notes"),
      config: z.object({ title: z.string().min(1).max(60) }).strict(),
    })
    .strict(),
  base
    .extend({
      kind: z.literal("recent"),
      config: z
        .object({
          enabled: z.boolean(),
          limit: z.number().int().min(1).max(12),
        })
        .strict(),
    })
    .strict(),
  base
    .extend({
      kind: z.literal("shortcuts"),
      config: z.object({ links: z.array(link).max(12) }).strict(),
    })
    .strict(),
  base
    .extend({
      kind: z.literal("focus"),
      config: z.object({ minutes: z.number().int().min(1).max(120) }).strict(),
    })
    .strict(),
]);
export type DashboardWidget = z.infer<typeof widgetSchema>;
export type WidgetKind = DashboardWidget["kind"];
export type Wallpaper = z.infer<typeof wallpaperSchema>;
export const eventSchema = z
  .object({
    id: idSchema,
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .refine((value) => {
        const d = new Date(value + "T12:00:00Z");
        return (
          Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
        );
      }),
    title: z.string().trim().min(1).max(120),
  })
  .strict();
export function overlaps(
  a: Pick<DashboardWidget, "x" | "y" | "w" | "h">,
  b: Pick<DashboardWidget, "x" | "y" | "w" | "h">,
) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
export const dashboardSchema = z
  .object({
    version: z.literal(1),
    wallpaper: wallpaperSchema,
    widgets: z.array(widgetSchema).max(20),
    alignment: z.enum(["center", "wide"]),
    widgetOpacity: z.number().min(0.6).max(1),
    text: z.enum(["theme", "light", "dark"]),
    dock: z
      .object({
        size: z.enum(["compact", "comfortable"]),
        opacity: z.number().min(0.5).max(1),
        magnify: z.boolean(),
      })
      .strict(),
    note: z.string().max(20000),
    events: z.array(eventSchema).max(200),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      new Set(data.events.map((event) => event.id)).size !== data.events.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["events"],
        message: "Event IDs must be unique.",
      });
    const ids = new Set<string>();
    data.widgets.forEach((widget, i) => {
      if (
        ids.has(widget.id) ||
        widget.x + widget.w > 12 ||
        widget.y + widget.h > 200
      )
        ctx.addIssue({
          code: "custom",
          path: ["widgets", i],
          message: "Widget IDs and grid bounds must be valid.",
        });
      ids.add(widget.id);
      if (
        widget.visible &&
        data.widgets
          .slice(0, i)
          .some((other) => other.visible && overlaps(widget, other))
      )
        ctx.addIssue({
          code: "custom",
          path: ["widgets", i],
          message: "Widgets must not overlap.",
        });
    });
  });
export type DashboardSettings = z.infer<typeof dashboardSchema>;
// Patches are structural; StorageService validates the merged document including grid invariants.
export const dashboardPatchSchema = z
  .object(dashboardSchema.shape)
  .partial()
  .strict();
export type DashboardPatch = z.infer<typeof dashboardPatchSchema>;
export const weatherRequestSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    units: z.enum(["celsius", "fahrenheit"]),
    consent: z.literal(true),
  })
  .strict();
export type WeatherRequest = z.infer<typeof weatherRequestSchema>;
export interface WeatherReading {
  temperature: number;
  code: number;
  observedAt: string;
  units: "celsius" | "fahrenheit";
}

export const WIDGET_DEFINITIONS: Record<
  WidgetKind,
  {
    title: string;
    description: string;
    sizes: ReadonlyArray<readonly [number, number]>;
  }
> = {
  clock: {
    title: "Clock & date",
    description: "A quiet moment, in your local time.",
    sizes: [
      [4, 3],
      [6, 3],
    ],
  },
  search: {
    title: "Search",
    description: "Search or open a web address.",
    sizes: [
      [8, 3],
      [12, 3],
    ],
  },
  bookmarks: {
    title: "Bookmarks",
    description: "Your saved pages, optionally by folder.",
    sizes: [
      [4, 4],
      [6, 4],
    ],
  },
  weather: {
    title: "Weather",
    description: "Open-Meteo, only when you explicitly request it.",
    sizes: [[4, 4]],
  },
  calendar: {
    title: "Calendar",
    description: "A local calendar and your own events.",
    sizes: [
      [4, 5],
      [6, 5],
    ],
  },
  notes: {
    title: "Notes",
    description: "A shared dashboard notepad saved only in this profile.",
    sizes: [
      [4, 4],
      [6, 5],
    ],
  },
  recent: {
    title: "Recently visited",
    description: "Optional history display; off until you allow it.",
    sizes: [
      [6, 4],
      [4, 4],
    ],
  },
  shortcuts: {
    title: "Shortcut tiles",
    description: "Your own named destinations.",
    sizes: [
      [4, 4],
      [8, 4],
    ],
  },
  focus: {
    title: "Focus timer",
    description: "A local countdown; no account or background audio.",
    sizes: [[4, 3]],
  },
};
export function createWidget(kind: WidgetKind, id: string): DashboardWidget {
  const size = WIDGET_DEFINITIONS[kind].sizes[0];
  const cell = { id, x: 0, y: 0, w: size[0], h: size[1], visible: true };
  switch (kind) {
    case "clock":
      return { ...cell, kind, config: { hour24: false, showDate: true } };
    case "search":
      return {
        ...cell,
        kind,
        config: { placeholder: "Where would you like to go?" },
      };
    case "bookmarks":
      return { ...cell, kind, config: { folder: "", limit: 6 } };
    case "weather":
      return {
        ...cell,
        kind,
        config: {
          location: "Your location",
          latitude: 0,
          longitude: 0,
          units: "celsius",
          consent: false,
        },
      };
    case "calendar":
      return { ...cell, kind, config: { mondayFirst: true } };
    case "notes":
      return { ...cell, kind, config: { title: "A little note" } };
    case "recent":
      return { ...cell, kind, config: { enabled: false, limit: 6 } };
    case "shortcuts":
      return {
        ...cell,
        kind,
        config: {
          links: [
            { title: "Wikipedia", url: "https://wikipedia.org" },
            { title: "Bookmarks", url: "lunar://bookmarks" },
          ],
        },
      };
    case "focus":
      return { ...cell, kind, config: { minutes: 25 } };
  }
}
/** Deterministic bounded packing. The moved cell wins; colliding cells find a free position. */
export function arrangeWidgets(
  widgets: DashboardWidget[],
  preferred?: DashboardWidget,
): DashboardWidget[] {
  const ordered = preferred
    ? [preferred, ...widgets.filter((w) => w.id !== preferred.id)]
    : widgets;
  const placed: DashboardWidget[] = [];
  for (const widget of ordered) {
    const next = structuredClone(widget);
    next.x = Math.max(0, Math.min(12 - next.w, next.x));
    next.y = Math.max(0, Math.min(200 - next.h, next.y));
    if (
      next.visible &&
      placed.some((other) => other.visible && overlaps(other, next))
    ) {
      let found = false;
      for (let y = 0; y <= 200 - next.h && !found; y++) {
        for (let x = 0; x <= 12 - next.w; x++) {
          const candidate = { ...next, x, y };
          if (
            !placed.some((other) => other.visible && overlaps(other, candidate))
          ) {
            next.x = x;
            next.y = y;
            found = true;
            break;
          }
        }
      }
      if (!found)
        throw new Error("There is no space left in this dashboard layout.");
    }
    placed.push(next);
  }
  return widgets.map((w) => placed.find((p) => p.id === w.id) ?? w);
}
const initial = [
  createWidget("clock", "clock"),
  { ...createWidget("search", "search"), x: 4 },
  { ...createWidget("bookmarks", "bookmarks"), y: 3 },
  { ...createWidget("notes", "notes"), x: 4, y: 3 },
  { ...createWidget("calendar", "calendar"), x: 8, y: 3 },
];
export const DEFAULT_DASHBOARD: DashboardSettings = dashboardSchema.parse({
  version: 1,
  wallpaper: {
    kind: "builtin",
    builtin: "meadow",
    mediaId: null,
    fit: "cover",
    position: "center",
    overlay: 0.12,
    blur: 0,
    loop: true,
    audioControls: false,
    effects: false,
  },
  widgets: initial,
  alignment: "center",
  widgetOpacity: 0.88,
  text: "theme",
  dock: { size: "comfortable", opacity: 0.82, magnify: true },
  note: "",
  events: [],
});
