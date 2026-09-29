import type { Metadata } from "next";
import { ReportClient } from "@/components/report/ReportClient";

export const metadata: Metadata = { title: "Dein Feed-Bericht · Guide me on the right way." };

export default function BerichtPage() {
  return <ReportClient />;
}
