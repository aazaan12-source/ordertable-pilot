"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReorderItem = {
  id: string;
  label: string;
  detail?: string;
};

export function ReorderBox({
  items,
  fieldName = "orderedIds",
  emptyText = "No items to arrange yet."
}: {
  items: ReorderItem[];
  fieldName?: string;
  emptyText?: string;
}) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [selectedId, setSelectedId] = useState(items[0]?.id || "");
  const selectedIndex = orderedItems.findIndex((item) => item.id === selectedId);
  const orderedIds = useMemo(() => orderedItems.map((item) => item.id).join(","), [orderedItems]);

  function moveSelected(direction: -1 | 1) {
    if (selectedIndex < 0) return;
    const nextIndex = selectedIndex + direction;
    if (nextIndex < 0 || nextIndex >= orderedItems.length) return;
    const nextItems = [...orderedItems];
    [nextItems[selectedIndex], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[selectedIndex]];
    setOrderedItems(nextItems);
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name={fieldName} value={orderedIds} />
      {orderedItems.length > 0 ? (
        <select
          className="min-h-[220px] w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          size={Math.min(10, Math.max(5, orderedItems.length))}
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {orderedItems.map((item, index) => (
            <option key={item.id} value={item.id}>
              {index + 1}. {item.label}{item.detail ? ` - ${item.detail}` : ""}
            </option>
          ))}
        </select>
      ) : (
        <div className="rounded-md border bg-muted/40 p-4 text-center text-sm text-muted-foreground">{emptyText}</div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={() => moveSelected(-1)} disabled={selectedIndex <= 0}>
          <ArrowUp className="h-4 w-4" /> Move Up
        </Button>
        <Button type="button" variant="outline" onClick={() => moveSelected(1)} disabled={selectedIndex < 0 || selectedIndex >= orderedItems.length - 1}>
          <ArrowDown className="h-4 w-4" /> Move Down
        </Button>
      </div>
    </div>
  );
}
