import type { Category, Spectrum } from "@/engine/types";

export const CATEGORY_LABELS: Record<Category, string> = {
  sport: "Sport",
  gaming: "Gaming",
  comedy: "Comedy",
  beauty_lifestyle: "Beauty & Lifestyle",
  luxury_hustle: "Luxus & Hustle",
  fitness: "Fitness",
  news: "Nachrichten",
  politics: "Politik",
  manosphere: "Manosphere",
  knowledge: "Wissen",
  music_dance: "Musik & Tanz",
  animals: "Tiere",
  food: "Essen",
  relationships: "Beziehungen",
  sexualized: "Anzügliches",
  advertising: "Werbung",
  other: "Sonstiges",
};

/** Ergänzt „Dein Feed hat sich in Richtung … verengt“ */
export const SPECTRUM_PHRASES: Record<Spectrum, string> = {
  left: "linker Politik-Inhalte",
  center_left: "Politik-Inhalte der linken Mitte",
  center: "Politik-Inhalte der Mitte",
  center_right: "Politik-Inhalte der rechten Mitte",
  right: "rechter Politik-Inhalte",
  unassignable: "nicht zuordenbarer Politik-Inhalte",
};
