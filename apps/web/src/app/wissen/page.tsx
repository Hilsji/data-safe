import type { Metadata } from "next";
import { StoryCards } from "@/components/modules/StoryCards";
import { de } from "@/i18n/de";

export const metadata: Metadata = { title: "Was Social Media mit dir macht · Guide me on the right way." };

export default function WissenPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{de.story.title}</h1>
      <p style={{ color: "var(--muted)" }}>{de.story.intro}</p>
      <StoryCards />
    </div>
  );
}
