"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_STORED_IMAGE_LENGTH, safeStoredImageUrl, suggestedMenuImageFor } from "@/lib/menu-images";

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
  const safeDefaultValue = safeStoredImageUrl(defaultValue);
  const [value, setValue] = useState(safeDefaultValue || suggested);
  const [status, setStatus] = useState(
    defaultValue && !safeDefaultValue
      ? "Saved image was too large, so the smart image is being used."
      : safeDefaultValue
        ? "Using saved image."
        : "Smart image selected from item/category name."
  );
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const isLocalUpload = value.startsWith("data:image/");

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

  async function readLocalFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setStatus("Please choose an image file.");
      return;
    }
    if (file.size > 8_000_000) {
      setStatus("This photo is too large. Please choose a smaller photo.");
      return;
    }

    try {
      const compressed = await compressImageFile(file);
      if (compressed.length > MAX_STORED_IMAGE_LENGTH) {
        setStatus("Photo is still too large after compression. Please choose a smaller photo or paste an image URL.");
        return;
      }
      setValue(compressed);
      setStatus("Local photo compressed and ready to save.");
    } catch (error) {
      console.error("[MenuImagePicker] image compression failed", error);
      setStatus("Could not prepare this photo. Please choose another image or paste an image URL.");
    }
  }

  return (
    <div className="rounded-md border bg-white p-3">
      <input ref={hiddenInputRef} type="hidden" name={name} value={value} />
      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <img
          src={value || suggested}
          alt="Menu item preview"
          className="h-28 w-full rounded-md object-cover sm:h-24"
          onError={() => {
            setValue(suggested);
            setStatus("Image could not load, so the smart image is being used.");
          }}
        />
        <div className="space-y-2">
          <Input
            value={isLocalUpload ? "" : value}
            onChange={(event) => {
              const nextValue = event.target.value.trim();
              if (nextValue.startsWith("data:image/") && nextValue.length > MAX_STORED_IMAGE_LENGTH) {
                setStatus("This image data is too large. Upload a smaller photo or paste a normal image URL.");
                return;
              }
              if (nextValue.length > 2_000 && !nextValue.startsWith("data:image/")) {
                setStatus("Image URL is too long. Please paste a shorter direct image link.");
                return;
              }
              setValue(nextValue);
              setStatus("Custom image URL entered.");
            }}
            placeholder={isLocalUpload ? "Local compressed photo selected" : "Paste image URL"}
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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function compressImageFile(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const maxSide = 720;
    const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.78, 0.68, 0.58, 0.48]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= MAX_STORED_IMAGE_LENGTH) return dataUrl;
    }

    return canvas.toDataURL("image/jpeg", 0.42);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
