import type { Metadata } from "next";
import { Beamer } from "@/components/teacher/Beamer";

export const metadata: Metadata = { title: "Beamer · Guide me on the right way." };

export default async function BeamerPage({ params }: { params: Promise<{ id: string }> }) {
  return <Beamer id={(await params).id} />;
}
