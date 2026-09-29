"use client";

import dynamic from "next/dynamic";
import { de } from "@/i18n/de";

/** Nur im Browser rendern: Der Ablauf braucht sessionStorage, WebCrypto und Zufallszahlen. */
export const ArenaClient = dynamic(() => import("./ArenaFlow").then((m) => m.ArenaFlow), {
  ssr: false,
  loading: () => <p>{de.common.loading}</p>,
});
