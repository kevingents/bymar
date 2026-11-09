/** Maakt een agendabestand (.ics) met de geplande klusstappen, voor iPhone, Google en Outlook. */
export function buildIcs(title: string, events: { date: string; summary: string; description: string }[]) {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Huisraad//Klusplanning//NL", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(title)}`];
  events.forEach((e, i) => {
    const d = e.date.replace(/-/g, "");
    const next = new Date(`${e.date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const end = next.toISOString().slice(0, 10).replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${d}-${i}-${Math.random().toString(36).slice(2)}@huisraad.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${esc(e.summary)}`,
      `DESCRIPTION:${esc(e.description)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT15H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(e.summary)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
