import type { MetadataRoute } from "next";
import { RestaurantStatus, TableStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { tableQrUrl } from "@/lib/qr";
import { appBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = appBaseUrl();
  const baseEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7
    }
  ];

  try {
    const restaurants = await db.restaurant.findMany({
      where: { status: RestaurantStatus.ACTIVE, orderingEnabled: true },
      select: {
        slug: true,
        updatedAt: true,
        tables: {
          where: { status: { not: TableStatus.INACTIVE } },
          select: { tableNumber: true, updatedAt: true },
          orderBy: { tableNumber: "asc" }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    return [
      ...baseEntries,
      ...restaurants.flatMap((restaurant) =>
        restaurant.tables.map((table) => ({
          url: `${baseUrl}${tableQrUrl(restaurant.slug, table.tableNumber)}`,
          lastModified: table.updatedAt || restaurant.updatedAt,
          changeFrequency: "daily" as const,
          priority: 0.9
        }))
      )
    ];
  } catch (error) {
    console.error("[sitemap] failed to load table URLs", error);
    return baseEntries;
  }
}
