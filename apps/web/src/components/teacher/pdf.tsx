/**
 * PDF-Export im Browser (@react-pdf/renderer) – es geht nichts an einen PDF-Dienst.
 * Wird erst beim Klick geladen (dynamischer Import), damit das Dashboard schlank bleibt.
 */
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { CATEGORY_LABELS } from "@/content/categories";
import type { Category } from "@/engine/types";
import { de } from "@/i18n/de";
import type { ClassOverview } from "@/server/classes";
import type { OkGroup } from "./ClassDetail";

const t = de.teacher;

// Standard-PDF-Schrift (WinAnsi) kennt „′“, „≤“ usw. nicht
const safe = (s: string) => s.replace(/′/g, "'").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/→/g, "->");
const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)} %`);
const num = (v: number | null, d = 1) => (v === null ? "–" : v.toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d }));

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.4 },
  motto: { fontSize: 9, color: "#1f5f8b", marginBottom: 8 },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 4 },
  muted: { color: "#55524c" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d9d5cc", paddingVertical: 3 },
  cellKey: { width: "55%", color: "#55524c" },
  cellVal: { width: "45%" },
  barTrack: { height: 8, backgroundColor: "#e4e1da", borderRadius: 2, marginTop: 2 },
  barFill: { height: 8, backgroundColor: "#2a78d6", borderRadius: 2 },
  question: { marginTop: 12 },
  lines: { borderBottomWidth: 0.5, borderBottomColor: "#b4b0a8", height: 22 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#55524c" },
});

async function download(doc: React.ReactElement, filename: string) {
  const blob = await pdf(doc as Parameters<typeof pdf>[0]).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

const fileSafe = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 40);

export async function downloadResultsPdf(o: ClassOverview, ok: OkGroup[]) {
  const doc = (
    <Document title={`${o.title} – Ergebnisse`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.motto}>{de.common.motto}</Text>
        <Text style={styles.h1}>{safe(`${o.title} – ${t.resultsHeading}`)}</Text>
        <Text style={styles.muted}>{safe(t.resultsPending)}</Text>
        <Text style={styles.h2}>{t.compareHeading}</Text>
        {[...ok]
          .sort((a, b) => a.durationMin - b.durationMin)
          .map((g) => (
            <View key={g.groupId} style={{ marginBottom: 6 }}>
              <Text>
                {safe(`${g.label} (${g.durationMin} min): ${pct(g.stats.contentCorrectMean)}`)}
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.round((g.stats.contentCorrectMean ?? 0) * 100)}%` }]} />
              </View>
            </View>
          ))}
        {(o.results ?? []).map((r) => {
          const g = ok.find((x) => x.groupId === r.groupId);
          return (
            <View key={r.groupId} wrap={false}>
              <Text style={styles.h2}>{safe(`${r.label} · ${r.durationMin} ${de.common.minutes}`)}</Text>
              {!g ? (
                <Text>{safe(t.suppressed)}</Text>
              ) : (
                (
                  [
                    [t.contributions, String(g.stats.n)],
                    [t.contentCorrect, pct(g.stats.contentCorrectMean)],
                    [t.dPrime, num(g.stats.dPrimeMean)],
                    [t.videos, num(g.stats.videosSeenMean, 0)],
                    [t.prospective, pct(g.stats.prospectiveRate)],
                    [t.entropyDrop, num(g.stats.entropyDropMean, 2)],
                    [t.topics, g.stats.topCategories.slice(0, 3).map((c) => CATEGORY_LABELS[c.category as Category] ?? c.category).join(", ") || "–"],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <View key={k} style={styles.row}>
                    <Text style={styles.cellKey}>{safe(k)}</Text>
                    <Text style={styles.cellVal}>{safe(v)}</Text>
                  </View>
                ))
              )}
            </View>
          );
        })}
        <Text style={[styles.muted, { marginTop: 14 }]}>{safe(t.politicsNote)}</Text>
        <Text style={styles.footer}>{safe(de.report.result.infoHeading)} – Interferenz und Listenlänge erklären einen Teil der Unterschiede zwischen den Gruppen.</Text>
      </Page>
    </Document>
  );
  await download(doc, `Ergebnisse_${fileSafe(o.title)}.pdf`);
}

export async function downloadWorksheetPdf(title: string) {
  const w = t.worksheet;
  const doc = (
    <Document title={w.title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.motto}>{w.footer}</Text>
        <Text style={styles.h1}>{safe(w.title)}</Text>
        <Text style={styles.muted}>{safe(title)}</Text>
        <Text style={{ marginTop: 8 }}>{safe(w.intro)}</Text>
        {w.questions.map((q, i) => (
          <View key={q} style={styles.question} wrap={false}>
            <Text>
              {i + 1}. {safe(q)}
            </Text>
            <View style={styles.lines} />
            <View style={styles.lines} />
            <View style={styles.lines} />
          </View>
        ))}
      </Page>
    </Document>
  );
  await download(doc, `Arbeitsblatt_${fileSafe(title)}.pdf`);
}
