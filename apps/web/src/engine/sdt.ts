/**
 * Signalentdeckungstheorie für den Wiedererkennungstest.
 * d′ = z(H) − z(FA) mit Log-Linear-Korrektur nach Hautus (1995):
 *   H = (Treffer + 0,5) / (Signale + 1), FA = (Fehlalarme + 0,5) / (Rauschen + 1)
 * Die Korrektur verhindert unendliche Werte bei 0 % bzw. 100 %.
 */

export interface SdtCounts {
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejections: number;
}

export interface SdtResult {
  hitRate: number;
  falseAlarmRate: number;
  dPrime: number;
  /** Antwortkriterium c = −(z(H) + z(FA)) / 2; > 0 = eher vorsichtig */
  criterion: number;
}

/** Inverse der Standardnormalverteilung (Acklam, rel. Fehler < 1,15e-9). */
export function inverseNormalCdf(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError(`p muss in (0,1) liegen, war ${p}`);
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
}

export function computeSdt({ hits, misses, falseAlarms, correctRejections }: SdtCounts): SdtResult {
  for (const [name, v] of Object.entries({ hits, misses, falseAlarms, correctRejections })) {
    if (!Number.isInteger(v) || v < 0) throw new RangeError(`${name} muss eine nichtnegative ganze Zahl sein`);
  }
  const signals = hits + misses;
  const noise = falseAlarms + correctRejections;
  if (signals === 0 || noise === 0) throw new RangeError("Es braucht mindestens ein altes und ein neues Item");
  const hitRate = (hits + 0.5) / (signals + 1);
  const falseAlarmRate = (falseAlarms + 0.5) / (noise + 1);
  const zH = inverseNormalCdf(hitRate);
  const zF = inverseNormalCdf(falseAlarmRate);
  return {
    hitRate: hits / signals,
    falseAlarmRate: falseAlarms / noise,
    dPrime: zH - zF,
    criterion: -(zH + zF) / 2,
  };
}
