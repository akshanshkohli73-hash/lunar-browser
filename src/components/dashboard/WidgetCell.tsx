import { memo, useRef, useState, type CSSProperties } from "react";
import { lunarSpring } from "../../../shared/motion";
import { motion, useIsPresent } from "framer-motion";
import {
  WIDGET_DEFINITIONS,
  type DashboardWidget,
} from "../../../shared/dashboard";
import type { GlassSettings, GlassTone } from "../../../shared/glass";
import { GlassSurface } from "../ui/GlassSurface";
import { Icon } from "../ui/Icon";
import { WIDGET_COMPONENTS } from "./Widgets";

type Props = {
  widget: DashboardWidget;
  material: GlassSettings;
  tone: GlassTone;
  active: boolean;
  reduced: boolean;
  editing: boolean;
  occluded: boolean;
  selected: boolean;
  dragging: boolean;
  target: boolean;
  onChange: (widget: DashboardWidget) => void;
  onSelect: (id: string) => void;
  onDrag: (id: string | null) => void;
  navigate: (url: string) => void;
};
export const WidgetCell = memo(function WidgetCell({
  widget,
  material,
  tone,
  active,
  reduced,
  editing,
  occluded,
  selected,
  dragging,
  target,
  onChange,
  onSelect,
  onDrag,
  navigate,
}: Props) {
  const present = useIsPresent();
  const definition = WIDGET_DEFINITIONS[widget.kind],
    Component = WIDGET_COMPONENTS[widget.kind];
  const [resizing, setResizing] = useState(false);
  const gesture = useRef<{
      x: number;
      y: number;
      width: number;
      start: DashboardWidget;
      last: string;
    } | null>(null),
    suppressClick = useRef(false);
  const resize = () => {
    const index = definition.sizes.findIndex(
        ([w, h]) => w === widget.w && h === widget.h,
      ),
      [w, h] = definition.sizes[(index + 1) % definition.sizes.length];
    onSelect(widget.id);
    onChange({ ...widget, w, h });
  };
  return (
    <motion.article
      data-widget-id={widget.id}
      layout={active && !reduced && !editing}
      initial={reduced ? false : { y: 5 }}
      animate={{ opacity: dragging ? 0.62 : 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.98 }}
      transition={lunarSpring(material.animationSpeed, reduced)}
      className={`dashboard-widget widget-${widget.kind}${selected ? " is-selected" : ""}${dragging ? " is-dragging" : ""}${target ? " is-drop-target" : ""}${resizing ? " is-resizing" : ""}`}
      aria-label={`${definition.title} widget`}
      aria-hidden={!present}
      style={
        {
          "--cell-x": widget.x + 1,
          "--cell-y": widget.y + 1,
          "--cell-w": widget.w,
          "--cell-h": widget.h,
        } as CSSProperties
      }
    >
      <GlassSurface
        material={material}
        override={widget.glass}
        tone={tone}
        active={active && present && !dragging && !resizing}
        level={definition.material}
        variant={
          (["clock", "search", "notes", "calendar", "weather"] as const).find(
            (kind) => kind === widget.kind,
          ) ?? "pane"
        }
      >
        {editing && (
          <div
            className="widget-arrange-handle"
            draggable
            onClick={() => onSelect(widget.id)}
            onDragStart={(event) => {
              event.dataTransfer.setData(
                "application/x-lunar-widget",
                widget.id,
              );
              event.dataTransfer.effectAllowed = "move";
              onSelect(widget.id);
              onDrag(widget.id);
            }}
            onDragEnd={() => onDrag(null)}
          >
            <span>
              <Icon name="move" size={14} />
              {definition.title}
            </span>
            <div>
              {(
                [
                  ["left", -1, 0, "back"],
                  ["right", 1, 0, "forward"],
                  ["up", 0, -1, "up"],
                  ["down", 0, 1, "down"],
                ] as const
              ).map(([direction, dx, dy, icon]) => (
                <button
                  key={direction}
                  aria-label={`Move ${definition.title} ${direction}`}
                  disabled={
                    dx < 0
                      ? widget.x === 0
                      : dx > 0
                        ? widget.x + widget.w === 12
                        : dy < 0
                          ? widget.y === 0
                          : widget.y + widget.h === 200
                  }
                  onClick={() => {
                    onSelect(widget.id);
                    onChange({ ...widget, x: widget.x + dx, y: widget.y + dy });
                  }}
                >
                  <Icon name={icon} size={12} />
                </button>
              ))}
            </div>
          </div>
        )}
        <div
          className="widget-content"
          ref={(node) => {
            if (node) node.inert = editing || occluded || !present;
          }}
        >
          <Component
            widget={widget}
            active={active && !occluded && !editing}
            navigate={navigate}
          />
        </div>
        {editing && definition.sizes.length > 1 && (
          <button
            className="widget-resize-handle"
            aria-label={`Resize ${definition.title} widget`}
            title="Drag to a supported size, or click / press Enter to cycle sizes"
            draggable={false}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              onSelect(widget.id);
              suppressClick.current = false;
              const grid = event.currentTarget.closest(".dashboard-grid");
              if (!grid) return;
              gesture.current = {
                x: event.clientX,
                y: event.clientY,
                width: grid.getBoundingClientRect().width,
                start: widget,
                last: `${widget.w}:${widget.h}`,
              };
              setResizing(true);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const start = gesture.current;
              if (!start) return;
              const w =
                  start.start.w +
                  (event.clientX - start.x) / (start.width / 12),
                h = start.start.h + (event.clientY - start.y) / 66;
              const [nextW, nextH] = [...definition.sizes].sort(
                (a, b) =>
                  (a[0] - w) ** 2 +
                  (a[1] - h) ** 2 -
                  ((b[0] - w) ** 2 + (b[1] - h) ** 2),
              )[0];
              const key = `${nextW}:${nextH}`;
              if (key === start.last) return;
              start.last = key;
              suppressClick.current = true;
              onChange({ ...start.start, w: nextW, h: nextH });
            }}
            onPointerUp={(event) => {
              if (!gesture.current) return;
              gesture.current = null;
              setResizing(false);
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              const start = gesture.current;
              if (start) onChange(start.start);
              gesture.current = null;
              setResizing(false);
              suppressClick.current = true;
            }}
            onLostPointerCapture={() => {
              gesture.current = null;
              setResizing(false);
            }}
            onClick={(event) => {
              if (suppressClick.current && event.detail !== 0) {
                suppressClick.current = false;
                return;
              }
              // Keyboard activation must still work after a cancelled pointer gesture.
              suppressClick.current = false;
              resize();
            }}
          >
            <Icon name="resize" size={15} />
          </button>
        )}
      </GlassSurface>
    </motion.article>
  );
});
