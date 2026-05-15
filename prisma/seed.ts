import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, RestaurantStatus, SubscriptionStatus } from "@prisma/client";
import { seededMenuImages } from "../lib/menu-images";

const prisma = new PrismaClient();

const categories = ["Burgers", "Pizza", "BBQ", "Karahi", "Drinks", "Desserts"];

const menuItems: Record<string, { name: string; price: number; description: string }[]> = {
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

async function main() {
  const adminHash = await bcrypt.hash("Admin12345", 12);
  const managerHash = await bcrypt.hash("Manager12345", 12);

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "demo-restaurant-islamabad" },
    update: {
      name: "Demo Restaurant Islamabad",
      branchName: "F-7 Islamabad",
      city: "Islamabad",
      address: "F-7, Islamabad, Pakistan",
      phone: "03000000000",
      status: RestaurantStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.PILOT,
      orderingEnabled: true,
      customerCancelWindowMinutes: 3,
      serviceChargePercent: 0,
      taxPercent: 0
    },
    create: {
      name: "Demo Restaurant Islamabad",
      slug: "demo-restaurant-islamabad",
      branchName: "F-7 Islamabad",
      city: "Islamabad",
      address: "F-7, Islamabad, Pakistan",
      phone: "03000000000",
      status: RestaurantStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.PILOT,
      orderingEnabled: true,
      pilotStartDate: new Date(),
      serviceChargePercent: 0,
      taxPercent: 0,
      customerCancelWindowMinutes: 3
    }
  });

  await prisma.user.upsert({
    where: { email: "admin@ordertable.pk" },
    update: { passwordHash: adminHash, role: UserRole.PLATFORM_ADMIN, isActive: true },
    create: {
      name: "Platform Admin",
      email: "admin@ordertable.pk",
      passwordHash: adminHash,
      role: UserRole.PLATFORM_ADMIN
    }
  });

  await prisma.user.upsert({
    where: { email: "manager@demo.com" },
    update: { passwordHash: managerHash, restaurantId: restaurant.id, role: UserRole.RESTAURANT_MANAGER, isActive: true },
    create: {
      name: "Demo Manager",
      email: "manager@demo.com",
      passwordHash: managerHash,
      role: UserRole.RESTAURANT_MANAGER,
      restaurantId: restaurant.id
    }
  });

  for (let tableNumber = 1; tableNumber <= 20; tableNumber++) {
    await prisma.restaurantTable.upsert({
      where: { restaurantId_tableNumber: { restaurantId: restaurant.id, tableNumber } },
      update: { qrUrl: `/r/${restaurant.slug}/t/${tableNumber}` },
      create: {
        restaurantId: restaurant.id,
        tableNumber,
        qrUrl: `/r/${restaurant.slug}/t/${tableNumber}`
      }
    });
  }

  for (const [index, categoryName] of categories.entries()) {
    const category = await prisma.category.upsert({
      where: { id: `${restaurant.slug}-${categoryName.toLowerCase()}` },
      update: {},
      create: {
        id: `${restaurant.slug}-${categoryName.toLowerCase()}`,
        restaurantId: restaurant.id,
        name: categoryName,
        sortOrder: index + 1
      }
    });

    for (const [itemIndex, item] of menuItems[categoryName].entries()) {
      await prisma.menuItem.upsert({
        where: { id: `${restaurant.slug}-${categoryName.toLowerCase()}-${itemIndex + 1}` },
        update: {
          name: item.name,
          price: item.price,
          description: item.description,
          categoryId: category.id,
          imageUrl: seededMenuImages[item.name.toLowerCase()] || null,
          isActive: true,
          isAvailable: true
        },
        create: {
          id: `${restaurant.slug}-${categoryName.toLowerCase()}-${itemIndex + 1}`,
          restaurantId: restaurant.id,
          categoryId: category.id,
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: seededMenuImages[item.name.toLowerCase()] || null,
          sortOrder: itemIndex + 1
        }
      });
    }
  }

  await prisma.subscription.upsert({
    where: { id: `${restaurant.id}-pilot` },
    update: {},
    create: {
      id: `${restaurant.id}-pilot`,
      restaurantId: restaurant.id,
      planName: "Pilot",
      monthlyPrice: 0,
      status: "ACTIVE",
      startDate: new Date()
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
