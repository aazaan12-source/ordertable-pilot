import { seededMenuImages } from "./menu-images";

export const sampleCategoryNames = ["Burgers", "Pizza", "BBQ", "Karahi", "Drinks", "Desserts"];

export const sampleMenuItems: Record<string, { name: string; price: number; description: string; imageUrl?: string | null }[]> = {
  Burgers: [
    { name: "Zinger Burger", price: 650, description: "Crispy chicken fillet with house sauce." },
    { name: "Beef Burger", price: 750, description: "Grilled beef patty, cheddar, lettuce and onions." },
    { name: "Chicken Cheese Burger", price: 700, description: "Juicy chicken patty with melted cheese." }
  ],
  Pizza: [
    { name: "Small Chicken Tikka Pizza", price: 900, description: "Spicy tikka topping on a small crust." },
    { name: "Medium Fajita Pizza", price: 1500, description: "Fajita chicken, peppers and mozzarella." },
    { name: "Large Supreme Pizza", price: 2200, description: "Loaded family pizza with chicken and vegetables." }
  ],
  BBQ: [
    { name: "Chicken Tikka", price: 550, description: "Charcoal grilled chicken tikka piece." },
    { name: "Malai Boti", price: 850, description: "Creamy boneless BBQ boti." },
    { name: "Seekh Kabab", price: 700, description: "Four spiced seekh kababs with chutney." }
  ],
  Karahi: [
    { name: "Half Chicken Karahi", price: 1500, description: "Half chicken karahi with fresh ginger." },
    { name: "Full Chicken Karahi", price: 2800, description: "Full chicken karahi for sharing." },
    { name: "Mutton Karahi", price: 3800, description: "Traditional mutton karahi cooked to order." }
  ],
  Drinks: [
    { name: "Pepsi", price: 150, description: "Chilled soft drink." },
    { name: "Mint Margarita", price: 350, description: "Fresh mint and lemon cooler." },
    { name: "Fresh Lime", price: 300, description: "Classic fresh lime soda." }
  ],
  Desserts: [
    { name: "Gulab Jamun", price: 250, description: "Warm gulab jamun serving." },
    { name: "Kheer", price: 300, description: "Creamy rice pudding." },
    { name: "Brownie", price: 450, description: "Chocolate brownie with fudge sauce." }
  ]
};

export function imageForSeededItem(itemName: string) {
  return seededMenuImages[itemName.toLowerCase()] || null;
}
