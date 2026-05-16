"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { suggestedMenuImageFor } from "@/lib/menu-images";

type CategoryOption = {
  id: string;
  name: string;
};

export function MenuImagePicker({
  defaultValue,
  defaultItemName = "",
  defaultCategoryName = "",
  categories = [],
  name = "imageUrl",
  itemNameField = "name",
  categoryField = "categoryId"
}: {
  defaultValue?: string | null;
  defaultItemName?: string;
  defaultCategoryName?: string;
  categories?: CategoryOption[];
  name?: string;
  itemNameField?: string;
  categoryField?: string;
}) {
  const [itemName, setItemName] = useState(defaultItemName);
  const [categoryName, setCategoryName] = useState(defaultCategoryName);
  const suggested = useMemo(() => suggestedMenuImageFor(itemName, categoryName), [itemName, categoryName]);
  const [value, setValue] = useState(defaultValue || suggested);
  const [status, setStatus] = useState(defaultValue ? "Using saved image." : "Smart image selected from item/category name.");
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = hiddenInputRef.current?.closest("form");
    if (!form) return;

    const updateFromForm = () => {
      const nameInput = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${itemNameField}"]`);
      const categoryInput = form.querySelector<HTMLSelectElement>(`select[name="${categoryField}"]`);
      const nextItemName = nameInput?.value || "";
      const nextCategoryName = categoryInput
        ? categories.find((category) => category.id === categoryInput.value)?.name || ""
        : defaultCategoryName;

      setItemName(nextItemName);
      setCategoryName(nextCategoryName);
    };

    updateFromForm();
    form.addEventListener("input", updateFromForm);
    form.addEventListener("change", updateFromForm);
    return () => {
      form.removeEventListener("input", updateFromForm);
      form.removeEventListener("change", updateFromForm);
    };
  }, [categories, categoryField, defaultCategoryName, itemNameField, name]);

  function useSuggestion() {
    setValue(suggested);
    setStatus("Smart image applied from item/category name.");
  }

  function readLocalFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setStatus("Please choose an image file.");
      return;
    }
    if (file.size > 1_800_000) {
      setStatus("Image is large. Use a smaller/compressed photo for faster loading.");
    }
    const reader = new FileReader();
    reader.onload = () => {
      setValue(String(reader.result || ""));
      setStatus("Local image selected. It will be saved with this menu item.");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-md border bg-white p-3">
      <input ref={hiddenInputRef} type="hidden" name={name} value={value} />
      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <img src={value || suggested} alt="Menu item preview" className="h-28 w-full rounded-md object-cover sm:h-24" />
        <div className="space-y-2">
          <Input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setStatus("Custom image URL entered.");
            }}
            placeholder="Image URL or uploaded image data"
          />
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted">
              <ImagePlus className="h-4 w-4" />
              Upload photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) readLocalFile(file);
                }}
              />
            </label>
            <Button type="button" variant="outline" size="sm" onClick={useSuggestion}>
              <RotateCcw className="h-4 w-4" />
              Use smart image
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
      </div>
    </div>
  );
}
