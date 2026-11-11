/**
 * Stand van de zon in Nederland (midden van het land), goed genoeg voor licht in een 3D-kamer.
 * month 1-12 (midden van de maand), hour = kloktijd (zomertijd van april t/m oktober).
 */
export function sunPosition(month: number, hour: number, lat = 52.1, lon = 5.1) {
  const rad = Math.PI / 180;
  const day = Math.round((month - 1) * 30.4 + 15);
  const decl = 23.44 * Math.sin(rad * (360 / 365) * (284 + day));
  // tijdvereffening (minuten)
  const B = rad * (360 / 365) * (day - 81);
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const tz = month >= 4 && month <= 10 ? 2 : 1;
  const solar = hour - tz + lon / 15 + eot / 60;
  const H = rad * 15 * (solar - 12);
  const phi = rad * lat;
  const d = rad * decl;
  const sinAlt = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  // azimut vanaf het noorden, met de klok mee
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(d) * Math.cos(phi)) + Math.PI;
  return { altitude: altitude / rad, azimuth: ((az / rad) % 360 + 360) % 360 };
}

export const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

export function sunLabel(month: number, hour: number) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${MONTHS[month - 1]} · ${h}:${String(m).padStart(2, "0")}`;
}

/** Uit welke windrichting het licht komt, in gewone woorden. */
export function compass(azimuth: number) {
  const names = ["noorden", "noordoosten", "oosten", "zuidoosten", "zuiden", "zuidwesten", "westen", "noordwesten"];
  return names[Math.round(azimuth / 45) % 8];
}
