import type { Metadata } from "next";
import { AdminHome } from "@/components/admin/AdminHome";

export const metadata: Metadata = { title: "Kalibrierung · Guide me on the right way." };

export default function AdminPage() {
  return <AdminHome />;
}
