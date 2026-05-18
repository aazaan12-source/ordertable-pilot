import { redirect } from "next/navigation";

export default async function AdminQrCodesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/restaurants/${id}/tables-qr`);
}
