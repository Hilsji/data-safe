/**
 * Modul 2 „Die Vergleichs-Falle“: Scrollzeit → Stunden pro Jahr und gewonnene Zeit.
 * Äquivalente (z. B. Nachhilfe-Stunden) werden NUR angezeigt, wenn sie eine geprüfte Quelle haben.
 */
import { EQUIVALENTS, type Equivalent } from "@/content/equivalents";

export const MAX_MINUTES_PER_DAY = 24 * 60;

export function hoursPerYear(minutesPerDay: number, daysPerYear = 365): number {
  if (!Number.isFinite(minutesPerDay) || minutesPerDay < 0 || minutesPerDay > MAX_MINUTES_PER_DAY) {
    throw new RangeError("Minuten pro Tag müssen zwischen 0 und 1440 liegen");
  }
  return (minutesPerDay * daysPerYear) / 60;
}

export interface FutureSelf {
  /** „weiter so“ */
  current: { minutesPerDay: number; hoursPerYear: number };
  /** „1 Stunde weniger pro Tag“ (nicht unter 0) */
  reduced: { minutesPerDay: number; hoursPerYear: number };
  gainedHoursPerYear: number;
  equivalents: { equivalent: Equivalent; times: number }[];
}

export function futureSelf(minutesPerDay: number, reduceBy = 60, equivalents: readonly Equivalent[] = EQUIVALENTS): FutureSelf {
  const reducedMin = Math.max(0, minutesPerDay - reduceBy);
  const current = hoursPerYear(minutesPerDay);
  const reduced = hoursPerYear(reducedMin);
  const gained = current - reduced;
  return {
    current: { minutesPerDay, hoursPerYear: current },
    reduced: { minutesPerDay: reducedMin, hoursPerYear: reduced },
    gainedHoursPerYear: gained,
    equivalents: equivalents
      .filter((e) => e.status === "verified" && e.hours !== null && e.hours > 0)
      .map((equivalent) => ({ equivalent, times: gained / equivalent.hours! })),
  };
}
