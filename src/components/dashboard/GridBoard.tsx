import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, GripVertical, X } from "lucide-react";

export interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const COLS = 12;
const ROW_H = 96;
const GAP = 12;

interface Props {
  items: GridItem[];
  editing: boolean;
  onChange: (items: GridItem[]) => void;
  onRemove: (id: string) => void;
  onDuplicate?: (id: string) => void;
  renderItem: (item: GridItem) => React.ReactNode;
  titleFor: (item: GridItem) => string;
}

type Drag =
  | { mode: "move" | "resize"; id: string; startX: number; startY: number; item: GridItem }
  | null;

export function GridBoard({ items, editing, onChange, onRemove, onDuplicate, renderItem, titleFor }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [drag, setDrag] = useState<Drag>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const colW = (width - GAP * (COLS - 1)) / COLS;

  const onPointerDown = useCallback(
    (e: React.PointerEvent, item: GridItem, mode: "move" | "resize") => {
      if (!editing) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      setDrag({ mode, id: item.i, startX: e.clientX, startY: e.clientY, item });
    },
    [editing],
  );

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const dCol = Math.round(dx / (colW + GAP));
      const dRow = Math.round(dy / (ROW_H + GAP));
      const base = drag.item;
      let next: GridItem;
      if (drag.mode === "move") {
        next = {
          ...base,
          x: Math.min(Math.max(0, base.x + dCol), COLS - base.w),
          y: Math.max(0, base.y + dRow),
        };
      } else {
        next = {
          ...base,
          w: Math.min(Math.max(2, base.w + dCol), COLS - base.x),
          h: Math.max(2, base.h + dRow),
        };
      }
      onChange(items.map((it) => (it.i === drag.id ? next : it)));
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, colW, items, onChange]);

  const maxY = items.reduce((m, it) => Math.max(m, it.y + it.h), 4);

  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ height: maxY * (ROW_H + GAP) }}
    >
      {editing && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, hsl(var(--border)) 0 1px, transparent 1px " +
              (colW + GAP) +
              "px)",
          }}
        />
      )}
      {items.map((item) => (
        <div
          key={item.i}
          className={`absolute rounded-xl border bg-card overflow-hidden flex flex-col ${
            editing ? "border-primary/40 shadow-lg" : "border-border"
          } ${drag?.id === item.i ? "opacity-80 ring-2 ring-primary" : ""}`}
          style={{
            left: item.x * (colW + GAP),
            top: item.y * (ROW_H + GAP),
            width: item.w * colW + (item.w - 1) * GAP,
            height: item.h * ROW_H + (item.h - 1) * GAP,
            transition: drag ? "none" : "left .15s, top .15s, width .15s, height .15s",
          }}
        >
          {editing && (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-secondary/60 border-b border-border">
              <button
                onPointerDown={(e) => onPointerDown(e, item, "move")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-grab active:cursor-grabbing min-w-0"
              >
                <GripVertical className="size-3.5 shrink-0" />
                <span className="truncate">{titleFor(item)}</span>
              </button>
              {onDuplicate && (
                <button
                  onClick={() => onDuplicate(item.i)}
                  className="text-muted-foreground hover:text-primary p-1 rounded"
                  title="Duplicar widget"
                >
                  <Copy className="size-3.5" />
                </button>
              )}
              <button
                onClick={() => onRemove(item.i)}
                className="text-muted-foreground hover:text-destructive p-1 rounded"
                title="Remover widget"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden">{renderItem(item)}</div>
          {editing && (
            <div
              onPointerDown={(e) => onPointerDown(e, item, "resize")}
              className="absolute bottom-0 right-0 size-5 cursor-nwse-resize bg-primary/70 rounded-tl-md"
              title="Redimensionar"
            />
          )}
        </div>
      ))}
    </div>
  );
}
