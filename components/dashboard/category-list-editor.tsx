"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui/confirm-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MenuImagePicker } from "@/components/ui/menu-image-picker";
import { SortableReorderPanel, type SortableDisplayItem } from "@/components/ui/sortable-reorder-panel";
import { cn } from "@/lib/utils";

type FormAction = (formData: FormData) => Promise<void>;

type CategoryCard = {
  id: string;
  name: string;
  imageUrl: string | null;
  isActive: boolean;
  itemCount: number;
};

export function CategoryListEditor({
  title = "Arrange Category Order",
  description = "Click a category row to edit it. Click Reorder Categories, drag by the handle, then save.",
  items,
  categories,
  reorderAction,
  updateAction,
  deleteAction,
  hiddenFields = {}
}: {
  title?: string;
  description?: string;
  items: SortableDisplayItem[];
  categories: CategoryCard[];
  reorderAction: FormAction;
  updateAction: FormAction;
  deleteAction: FormAction;
  hiddenFields?: Record<string, string>;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const editCardRef = useRef<HTMLDivElement | null>(null);
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  useEffect(() => {
    if (selectedCategoryId && !categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId("");
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!selectedCategoryId) return;
      const target = event.target;
      if (target instanceof Node && editCardRef.current?.contains(target)) return;
      setSelectedCategoryId("");
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [selectedCategoryId]);

  return (
    <div className="grid gap-3">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent>
          <SortableReorderPanel
            items={items}
            action={reorderAction}
            hiddenFields={hiddenFields}
            reorderLabel="Categories"
            reorderButtonLabel="Reorder Categories"
            saveLabel="Save Category Order"
            emptyText="No categories to arrange yet."
            selectedItemId={selectedCategoryId}
            onItemSelect={setSelectedCategoryId}
          />
        </CardContent>
      </Card>

      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        {selectedCategory ? (
          <>
            Editing <strong className="text-foreground">{selectedCategory.name}</strong>. Click outside this edit card to close it.
          </>
        ) : (
          "Select a category row above to open its edit card."
        )}
      </div>

      {selectedCategory ? (
        <div ref={editCardRef}>
          <Card id={`category-${selectedCategory.id}`} className={cn(!selectedCategory.isActive && "opacity-60")}>
            <CardContent className="p-4">
              <form action={updateAction} className="grid gap-3 md:grid-cols-[1fr_120px_100px]">
                {Object.entries(hiddenFields).map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
                <input type="hidden" name="id" value={selectedCategory.id} />
                <Input name="name" defaultValue={selectedCategory.name} placeholder="Category name" required />
                <div className="md:col-span-3">
                  <MenuImagePicker
                    defaultValue={selectedCategory.imageUrl}
                    defaultItemName={selectedCategory.name}
                    defaultCategoryName={selectedCategory.name}
                    itemNameField="name"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={selectedCategory.isActive} /> Active</label>
                <SubmitButton pendingText="Saving...">Save</SubmitButton>
              </form>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground">
                <span>{selectedCategory.itemCount} menu item{selectedCategory.itemCount === 1 ? "" : "s"}</span>
                <form action={deleteAction}>
                  {Object.entries(hiddenFields).map(([key, value]) => (
                    <input key={key} type="hidden" name={key} value={value} />
                  ))}
                  <input type="hidden" name="id" value={selectedCategory.id} />
                  <ConfirmSubmitButton message="Delete this category and all its menu items?" pendingText="Deleting...">Delete</ConfirmSubmitButton>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
