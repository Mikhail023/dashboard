import {
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
function MeasuredRow({
  id,
  top,
  onMeasure,
  children,
}: {
  id: string;
  top: number;
  onMeasure: (id: string, height: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    const observer = new ResizeObserver(() =>
      onMeasure(id, node.getBoundingClientRect().height),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, onMeasure]);
  return (
    <div ref={ref} style={{ position: "absolute", top, left: 0, right: 0 }}>
      {children}
    </div>
  );
}
/** Windowed rendering with measured row heights; short lists keep their normal layout. */
export default function VirtualList<
  T extends { id: string; occurrence_date?: string },
>({
  items,
  render,
  estimate = 74,
  height = 560,
}: {
  items: T[];
  render: (item: T) => ReactNode;
  estimate?: number;
  height?: number;
}) {
  const [scroll, setScroll] = useState(0),
    [sizes, setSizes] = useState<Record<string, number>>({});
  const measure = useCallback(
    (id: string, h: number) =>
      setSizes((previous) =>
        previous[id] === h ? previous : { ...previous, [id]: h },
      ),
    [],
  );
  if (items.length < 80) return <>{items.map(render)}</>;
  let total = 0;
  const layout = items.map((item) => {
    const key = item.id + (item.occurrence_date ?? "");
    const top = total;
    total += sizes[key] ?? estimate;
    return { item, key, top, height: sizes[key] ?? estimate };
  });
  return (
    <div
      className="virtual-list"
      style={{ height, overflow: "auto" }}
      onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
    >
      <div style={{ height: total, position: "relative" }}>
        {layout
          .filter(
            (row) =>
              row.top + row.height > scroll - 250 &&
              row.top < scroll + height + 250,
          )
          .map((row) => (
            <MeasuredRow
              key={row.key}
              id={row.key}
              top={row.top}
              onMeasure={measure}
            >
              {render(row.item)}
            </MeasuredRow>
          ))}
      </div>
    </div>
  );
}
