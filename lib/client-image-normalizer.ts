"use client";

import { MAX_STORED_IMAGE_LENGTH, MENU_IMAGE_CANVAS_HEIGHT, MENU_IMAGE_CANVAS_WIDTH } from "@/lib/menu-images";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export async function normalizeMenuImageFile(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = MENU_IMAGE_CANVAS_WIDTH;
    canvas.height = MENU_IMAGE_CANVAS_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const ratio = Math.min(canvas.width / image.width, canvas.height / image.height);
    const drawWidth = Math.max(1, Math.round(image.width * ratio));
    const drawHeight = Math.max(1, Math.round(image.height * ratio));
    const drawX = Math.round((canvas.width - drawWidth) / 2);
    const drawY = Math.round((canvas.height - drawHeight) / 2);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5, 0.42]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= MAX_STORED_IMAGE_LENGTH) return dataUrl;
    }

    throw new Error("Normalized image is too large.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
