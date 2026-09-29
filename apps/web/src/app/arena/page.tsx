import type { Metadata } from "next";
import { ArenaClient } from "@/components/arena/ArenaClient";

export const metadata: Metadata = { title: "Scroll-Arena · Guide me on the right way." };

export default function ArenaPage() {
  return <ArenaClient />;
}
