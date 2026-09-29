"use client";

import dynamic from "next/dynamic";
import { de } from "@/i18n/de";

/** Nur im Browser: Entschlüsselung und Bericht bleiben auf dem Gerät. */
export const ReportClient = dynamic(() => import("./ReportFlow").then((m) => m.ReportFlow), {
  ssr: false,
  loading: () => <p>{de.common.loading}</p>,
});
