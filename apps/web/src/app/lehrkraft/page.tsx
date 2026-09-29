import type { Metadata } from "next";
import { TeacherHome } from "@/components/teacher/TeacherHome";
import { de } from "@/i18n/de";

export const metadata: Metadata = { title: "Für Lehrkräfte · Guide me on the right way." };

export default async function LehrkraftPage({ searchParams }: { searchParams: Promise<{ login?: string }> }) {
  const { login } = await searchParams;
  return <TeacherHome loginNotice={login ? de.teacher.loginExpired : null} />;
}
