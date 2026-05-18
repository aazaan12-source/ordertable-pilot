"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, X } from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { MenuImage } from "@/components/ui/menu-image";
import { cn } from "@/lib/utils";

export type SortableDisplayItem = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  badges?: string[];
  actions?: { label: string; href: string }[];
  muted?: boolean;
};

type SortAction = (formData: FormData) => Promise<void>;

export function SortableReorderPanel({
  items,
  action,
  hiddenFields = {},
  reorderLabel,
  reorderButtonLabel = "Reorder",
  saveLabel = "Save Order",
  emptyText = "No items to arrange yet.",
  helperText = "Drag items to change their display order, then click Save Order."
}: {
  items: SortableDisplayItem[];
  action: SortAction;
  hiddenFields?: Record<string, string>;
  reorderLabel: string;
  reorderButtonLabel?: string;
  saveLabel?: string;
  emptyText?: string;
  helperText?: string;
}) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [originalItems, setOriginalItems] = useState(items);
  const [reordering, setReordering] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setOrderedItems(items);
    setOriginalItems(items);
    setReordering(false);
  }, [items]);

  const orderedIds = useMemo(() => orderedItems.map((item) => item.id), [orderedItems]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);
      return oldIndex >= 0 && newIndex >= 0 ? arrayMove(current, oldIndex, newIndex) : current;
    });
  }

  function startReorder() {
    setOriginalItems(orderedItems);
    setMessage("");
    setReordering(true);
  }

  function cancelReorder() {
    setOrderedItems(originalItems);
    setMessage("");
    setReordering(false);
  }

  function saveOrder() {
    const formData = new FormData();
    formData.set("orderedIds", orderedIds.join(","));
    for (const [key, value] of Object.entries(hiddenFields)) formData.set(key, value);
    startTransition(async () => {
      try {
        await action(formData);
        setOriginalItems(orderedItems);
        setReordering(false);
        setMessage("Order saved successfully.");
      } catch {
        setOrderedItems(originalItems);
        setMessage("Failed to save order. Please try again.");
      }
    });
  }

  return (
    <div className="rounded-md border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <div>
          <p className="text-sm font-semibold">{reorderLabel}</p>
          {reordering ? <p className="mt-1 text-xs text-muted-foreground">{helperText}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {reordering ? (
            <>
              <Button type="button" size="sm" onClick={saveOrder} disabled={isPending || orderedItems.length === 0}>
                <Check className="h-4 w-4" /> {isPending ? "Saving..." : saveLabel}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={cancelReorder} disabled={isPending}>
                <X className="h-4 w-4" /> Cancel
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={startReorder} disabled={orderedItems.length === 0}>
              {reorderButtonLabel}
            </Button>
          )}
        </div>
      </div>
      {message ? (
        <p className={cn("border-b px-3 py-2 text-sm font-medium", message.startsWith("Failed") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800")}>
          {message}
        </p>
      ) : null}
      {orderedItems.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reordering ? onDragEnd : undefined}>
          <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
            <div className="divide-y">
              {orderedItems.map((item) => (
                <SortableRow key={item.id} item={item} reordering={reordering} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableRow({ item, reordering }: { item: SortableDisplayItem; reordering: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !reordering });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[32px_1fr_auto] items-center gap-3 bg-white px-3 py-2 text-sm transition hover:bg-muted/40",
        isDragging && "relative z-10 rounded-md shadow-lg",
        item.muted && "opacity-60"
      )}
    >
      <button
        type="button"
        className={cn("flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground", reordering ? "cursor-grab bg-white hover:text-foreground active:cursor-grabbing" : "cursor-default opacity-40")}
        aria-label={`Drag ${item.title}`}
        {...(reordering ? attributes : {})}
        {...(reordering ? listeners : {})}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 items-center gap-3">
        {item.imageUrl ? <MenuImage src={item.imageUrl} variant="thumbnail" /> : null}
        <div className="min-w-0">
          <p className="truncate font-semibold">{item.title}</p>
          {item.subtitle ? <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden flex-wrap justify-end gap-1 sm:flex">
          {item.badges?.map((badge) => (
            <span key={badge} className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {badge}
            </span>
          ))}
        </div>
        {item.actions?.length ? (
          <ActionMenu label={`Actions for ${item.title}`} className="h-8 w-8 border-0" menuClassName="w-44 p-1">
            {item.actions.map((action) => (
              <a key={`${item.id}-${action.label}`} href={action.href} className="block rounded px-3 py-2 text-foreground hover:bg-muted">
                {action.label}
              </a>
            ))}
          </ActionMenu>
        ) : null}
      </div>
    </div>
  );
}

export function SortableGroupedReorderPanel({
  groups,
  action,
  hiddenFields = {},
  groupFieldName = "categoryId",
  title = "Arrange Menu Items"
}: {
  groups: { id: string; label: string; items: SortableDisplayItem[] }[];
  action: SortAction;
  hiddenFields?: Record<string, string>;
  groupFieldName?: string;
  title?: string;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id || "");
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);

  useEffect(() => {
    if (!selectedGroupId && groups[0]?.id) setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  return (
    <div className="rounded-md border bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">Select a category to reorder items within that category.</p>
        </div>
        <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm">
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </select>
      </div>
      {selectedGroup ? (
        <SortableReorderPanel
          key={selectedGroup.id}
          items={selectedGroup.items}
          action={action}
          hiddenFields={{ ...hiddenFields, [groupFieldName]: selectedGroup.id }}
          reorderLabel={selectedGroup.label}
          reorderButtonLabel="Reorder Items"
          saveLabel="Save Item Order"
          emptyText="No menu items in this category yet."
        />
      ) : (
        <p className="rounded-md border bg-muted/40 p-4 text-center text-sm text-muted-foreground">Select a category to reorder items within that category.</p>
      )}
    </div>
  );
}
