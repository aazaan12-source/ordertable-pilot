import { redirect } from "next/navigation";

export default async function AdminMenuCategoriesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/restaurants/${id}/menu#categories`);
}
