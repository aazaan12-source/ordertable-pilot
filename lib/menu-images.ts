const categoryImages: Record<string, string> = {
  burgers: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",
  bbq: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80",
  karahi: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80",
  drinks: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80",
  desserts: "https://upload.wikimedia.org/wikipedia/commons/5/56/Gulab_Jamun.jpg"
};

const itemImages: Record<string, string> = {
  "zinger burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  "beef burger": "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80",
  "chicken cheese burger": "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=900&q=80",
  "small chicken tikka pizza": "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=900&q=80",
  "medium fajita pizza": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",
  "large supreme pizza": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80",
  "chicken tikka": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=80",
  "malai boti": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80",
  "seekh kabab": "https://images.unsplash.com/photo-1628294895950-9805252327bc?auto=format&fit=crop&w=900&q=80",
  "half chicken karahi": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80",
  "full chicken karahi": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80",
  "mutton karahi": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=80",
  pepsi: "https://upload.wikimedia.org/wikipedia/commons/d/dd/Pepsi_Can.jpg",
  "pepsi can": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Pepsi_Can.jpg",
  coke: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80",
  "coca cola": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80",
  "mint margarita": "https://images.unsplash.com/photo-1502741224143-90386d7f8c82?auto=format&fit=crop&w=900&q=80",
  "fresh lime": "https://images.unsplash.com/photo-1523371054106-bbf80586c38c?auto=format&fit=crop&w=900&q=80",
  "gulab jamun": "https://upload.wikimedia.org/wikipedia/commons/5/56/Gulab_Jamun.jpg",
  "gulab jamun & rasgulla sweets": "https://upload.wikimedia.org/wikipedia/commons/5/56/Gulab_Jamun.jpg",
  kheer: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80",
  brownie: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80"
};

export const MAX_STORED_IMAGE_LENGTH = 350_000;

const keywordImages: { keywords: string[]; image: string }[] = [
  { keywords: ["burger", "zinger", "beef patty"], image: itemImages["zinger burger"] },
  { keywords: ["pizza", "fajita", "supreme"], image: categoryImages.pizza },
  { keywords: ["karahi", "kadai"], image: categoryImages.karahi },
  { keywords: ["mutton"], image: itemImages["mutton karahi"] },
  { keywords: ["tikka"], image: itemImages["chicken tikka"] },
  { keywords: ["malai", "boti"], image: itemImages["malai boti"] },
  { keywords: ["seekh", "kabab", "kebab"], image: itemImages["seekh kabab"] },
  { keywords: ["pepsi"], image: itemImages.pepsi },
  { keywords: ["sprite", "7up", "7 up"], image: "https://upload.wikimedia.org/wikipedia/commons/2/27/Sprite_2022.svg" },
  { keywords: ["coke", "coca cola", "coca-cola"], image: itemImages.coke },
  { keywords: ["margarita", "mint"], image: itemImages["mint margarita"] },
  { keywords: ["lime", "lemon"], image: itemImages["fresh lime"] },
  { keywords: ["gulab", "jamun", "rasgulla", "ras gula"], image: itemImages["gulab jamun"] },
  { keywords: ["kheer", "firni", "phirni"], image: itemImages.kheer },
  { keywords: ["brownie", "cake", "chocolate"], image: itemImages.brownie },
  { keywords: ["fries", "chips"], image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80" },
  { keywords: ["samosa"], image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80" },
  { keywords: ["biryani", "pulao", "rice"], image: "https://images.unsplash.com/photo-1563379091339-03246963d29a?auto=format&fit=crop&w=900&q=80" },
  { keywords: ["chai", "tea"], image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=80" },
  { keywords: ["coffee", "latte", "cappuccino"], image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80" },
  { keywords: ["water", "mineral"], image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=900&q=80" },
  { keywords: ["ice cream", "icecream"], image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80" }
];

function normalize(value?: string | null) {
  return (value || "").toLowerCase().replace(/[-_]/g, " ").trim();
}

export function safeStoredImageUrl(imageUrl?: string | null) {
  const value = (imageUrl || "").trim();
  if (!value) return null;
  if (value.startsWith("data:image/")) {
    return value.length <= MAX_STORED_IMAGE_LENGTH ? value : null;
  }
  if (value.length > 2_000) return null;
  return value;
}

export function cleanSubmittedMenuImage(value: FormDataEntryValue | null) {
  const imageUrl = String(value || "").trim();
  return safeStoredImageUrl(imageUrl);
}

export function suggestedMenuImageFor(itemName: string, categoryName?: string | null) {
  const itemKey = normalize(itemName);
  const exact = itemImages[itemKey];
  if (exact) return exact;

  const match = keywordImages.find((entry) => entry.keywords.some((keyword) => itemKey.includes(keyword)));
  if (match) return match.image;

  const categoryKey = normalize(categoryName);
  return categoryImages[categoryKey] || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80";
}

export function categoryImageFor(categoryName: string, imageUrl?: string | null) {
  const safeImageUrl = safeStoredImageUrl(imageUrl);
  if (safeImageUrl) return safeImageUrl;
  return suggestedMenuImageFor(categoryName, categoryName);
}

export function menuImageFor(itemName: string, categoryName?: string, imageUrl?: string | null) {
  const safeImageUrl = safeStoredImageUrl(imageUrl);
  if (safeImageUrl?.startsWith("data:image/")) return safeImageUrl;
  const exact = itemImages[normalize(itemName)];
  if (exact) return exact;
  if (safeImageUrl) return safeImageUrl;
  return suggestedMenuImageFor(itemName, categoryName);
}

export const seededMenuImages = itemImages;
