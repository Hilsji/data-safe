import type { Metadata } from "next";
import { ClassDetail } from "@/components/teacher/ClassDetail";

export const metadata: Metadata = { title: "Klassen-Session · Guide me on the right way." };

export default async function KlassePage({ params }: { params: Promise<{ id: string }> }) {
  return <ClassDetail id={(await params).id} />;
}
