"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MenuImagePicker } from "@/components/ui/menu-image-picker";
import { MenuImage } from "@/components/ui/menu-image";
import { SortableGroupedReorderPanel, type SortableDisplayItem } from "@/components/ui/sortable-reorder-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type SortAction = (formData: FormData) => Promise<void>;

type CategoryOption = {
  id: string;
  name: string;
};

type MenuItemCard = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  price: string;
  imageUrl: string | null;
  displayImageUrl: string;
  isActive: boolean;
  isAvailable: boolean;
};

export function MenuItemsCategoryView({
  groups,
  items,
  categories,
  reorderAction,
  updateAction,
  deleteAction
}: {
  groups: { id: string; label: string; items: SortableDisplayItem[] }[];
  items: MenuItemCard[];
  categories: CategoryOption[];
  reorderAction: SortAction;
  updateAction: SortAction;
  deleteAction: SortAction;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(groups[0]?.id || "");

  useEffect(() => {
    if (!selectedCategoryId && groups[0]?.id) setSelectedCategoryId(groups[0].id);
    if (selectedCategoryId && !groups.some((group) => group.id === selectedCategoryId)) {
      setSelectedCategoryId(groups[0]?.id || "");
    }
  }, [groups, selectedCategoryId]);

  const selectedCategory = groups.find((group) => group.id === selectedCategoryId);
  const visibleItems = useMemo(
    () => items.filter((item) => item.categoryId === selectedCategoryId),
    [items, selectedCategoryId]
  );

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Arrange Menu Items</CardTitle>
        </CardHeader>
        <CardContent>
          <SortableGroupedReorderPanel
            groups={groups}
            action={reorderAction}
            selectedGroupId={selectedCategoryId}
            onSelectedGroupIdChange={setSelectedCategoryId}
          />
        </CardContent>
      </Card>

      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        Showing <strong className="text-foreground">{visibleItems.length}</strong> items
        {selectedCategory ? <> from <strong className="text-foreground">{selectedCategory.label}</strong></> : null}.
      </div>

      {visibleItems.map((item) => (
        <Card id={`item-${item.id}`} key={item.id} className={!item.isActive ? "opacity-60" : ""}>
          <CardContent className="grid gap-4 p-4 lg:grid-cols-[180px_1fr]">
            <MenuImage src={item.displayImageUrl} alt={item.name} className="lg:h-40" />
            <div>
              <form action={updateAction} className="space-y-3">
                <input type="hidden" name="id" value={item.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <Input name="name" defaultValue={item.name} placeholder="Item name" />
                  <select name="categoryId" className="h-10 rounded-md border bg-white px-3 text-sm" defaultValue={item.categoryId}>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <Input name="price" type="number" defaultValue={item.price} placeholder="Price" />
                </div>
                <MenuImagePicker
                  defaultValue={item.imageUrl}
                  defaultItemName={item.name}
                  defaultCategoryName={item.categoryName}
                  categories={categories}
                />
                <Textarea name="description" defaultValue={item.description} placeholder="Short customer-friendly description" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" name="isAvailable" defaultChecked={item.isAvailable} /> Available</label>
                    <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={item.isActive} /> Active</label>
                  </div>
                  <div className="flex gap-2">
                    <SubmitButton pendingText="Saving...">Save</SubmitButton>
                  </div>
                </div>
              </form>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground">
                <p>{item.categoryName} - {formatCurrency(item.price)}</p>
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <ConfirmSubmitButton message="Delete this menu item?" pendingText="Deleting...">Delete</ConfirmSubmitButton>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {selectedCategory && visibleItems.length === 0 ? (
        <p className="rounded-md border bg-white p-6 text-center text-sm text-muted-foreground">No menu items in {selectedCategory.label} yet.</p>
      ) : null}
    </div>
  );
}
