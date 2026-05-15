import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, RestaurantStatus, SubscriptionStatus } from "@prisma/client";
import { imageForSeededItem, sampleCategoryNames, sampleMenuItems } from "../lib/sample-menu";
import { absoluteTableQrUrl } from "../lib/qr";

const prisma = new PrismaClient();

const seededRestaurants = [
  {
    name: "Demo Restaurant Islamabad",
    slug: "demo-restaurant-islamabad",
    branchName: "F-7 Islamabad",
    city: "Islamabad",
    address: "F-7, Islamabad, Pakistan",
    phone: "03000000000",
    tables: 20,
    managerName: "Demo Manager",
    managerEmail: "manager@demo.com",
    plan: SubscriptionStatus.PILOT
  },
  {
    name: "Cafe Aroma Islamabad",
    slug: "cafe-aroma-islamabad",
    branchName: "Blue Area",
    city: "Islamabad",
    address: "Blue Area, Islamabad, Pakistan",
    phone: "03001111111",
    tables: 10,
    managerName: "Cafe Aroma Manager",
    managerEmail: "manager@cafearoma.pk",
    plan: SubscriptionStatus.STARTER
  },
  {
    name: "Burger House Rawalpindi",
    slug: "burger-house-rawalpindi",
    branchName: "Saddar",
    city: "Rawalpindi",
    address: "Saddar, Rawalpindi, Pakistan",
    phone: "03002222222",
    tables: 12,
    managerName: "Burger House Manager",
    managerEmail: "manager@burgerhouse.pk",
    plan: SubscriptionStatus.STARTER
  },
  {
    name: "Pizza Point Lahore",
    slug: "pizza-point-lahore",
    branchName: "Gulberg",
    city: "Lahore",
    address: "Gulberg, Lahore, Pakistan",
    phone: "03003333333",
    tables: 15,
    managerName: "Pizza Point Manager",
    managerEmail: "manager@pizzapoint.pk",
    plan: SubscriptionStatus.GROWTH
  }
];

async function seedRestaurant(restaurantSeed: (typeof seededRestaurants)[number], managerHash: string) {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: restaurantSeed.slug },
    update: {
      name: restaurantSeed.name,
      branchName: restaurantSeed.branchName,
      city: restaurantSeed.city,
      address: restaurantSeed.address,
      phone: restaurantSeed.phone,
      status: RestaurantStatus.ACTIVE,
      subscriptionStatus: restaurantSeed.plan,
      orderingEnabled: true,
      customerCancelWindowMinutes: 3,
      serviceChargePercent: 0,
      taxPercent: 0
    },
    create: {
      name: restaurantSeed.name,
      slug: restaurantSeed.slug,
      branchName: restaurantSeed.branchName,
      city: restaurantSeed.city,
      address: restaurantSeed.address,
      phone: restaurantSeed.phone,
      status: RestaurantStatus.ACTIVE,
      subscriptionStatus: restaurantSeed.plan,
      orderingEnabled: true,
      pilotStartDate: new Date(),
      serviceChargePercent: 0,
      taxPercent: 0,
      customerCancelWindowMinutes: 3
    }
  });

  await prisma.user.upsert({
    where: { email: restaurantSeed.managerEmail },
    update: { passwordHash: managerHash, restaurantId: restaurant.id, role: UserRole.RESTAURANT_MANAGER, isActive: true },
    create: {
      name: restaurantSeed.managerName,
      email: restaurantSeed.managerEmail,
      passwordHash: managerHash,
      role: UserRole.RESTAURANT_MANAGER,
      restaurantId: restaurant.id
    }
  });

  for (let tableNumber = 1; tableNumber <= restaurantSeed.tables; tableNumber++) {
    await prisma.restaurantTable.upsert({
      where: { restaurantId_tableNumber: { restaurantId: restaurant.id, tableNumber } },
      update: { qrUrl: absoluteTableQrUrl(restaurant.slug, tableNumber), status: "EMPTY" },
      create: { restaurantId: restaurant.id, tableNumber, qrUrl: absoluteTableQrUrl(restaurant.slug, tableNumber) }
    });
  }

  for (const [index, categoryName] of sampleCategoryNames.entries()) {
    const category = await prisma.category.upsert({
      where: { id: `${restaurant.slug}-${categoryName.toLowerCase()}` },
      update: { name: categoryName, sortOrder: index + 1, isActive: true },
      create: {
        id: `${restaurant.slug}-${categoryName.toLowerCase()}`,
        restaurantId: restaurant.id,
        name: categoryName,
        sortOrder: index + 1
      }
    });

    for (const [itemIndex, item] of sampleMenuItems[categoryName].entries()) {
      await prisma.menuItem.upsert({
        where: { id: `${restaurant.slug}-${categoryName.toLowerCase()}-${itemIndex + 1}` },
        update: {
          name: item.name,
          price: item.price,
          description: item.description,
          categoryId: category.id,
          imageUrl: imageForSeededItem(item.name),
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
          imageUrl: imageForSeededItem(item.name),
          sortOrder: itemIndex + 1
        }
      });
    }
  }

  await prisma.subscription.upsert({
    where: { id: `${restaurant.id}-${restaurantSeed.plan.toLowerCase()}` },
    update: {},
    create: {
      id: `${restaurant.id}-${restaurantSeed.plan.toLowerCase()}`,
      restaurantId: restaurant.id,
      planName: restaurantSeed.plan,
      monthlyPrice: restaurantSeed.plan === "PILOT" ? 0 : restaurantSeed.plan === "GROWTH" ? 15000 : 5000,
      status: "ACTIVE",
      startDate: new Date()
    }
  });

  return restaurant;
}

async function main() {
  const adminHash = await bcrypt.hash("Admin12345", 12);
  const managerHash = await bcrypt.hash("Manager12345", 12);

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

  for (const restaurantSeed of seededRestaurants) {
    await seedRestaurant(restaurantSeed, managerHash);
  }
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
