const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DD_MM_YYYY_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T/;

export function parseDate(input: string | number): Date | null {
  if (typeof input === "number") {
    return excelSerialToDate(input);
  }

  if (typeof input !== "string" || input.trim() === "") {
    return null;
  }

  if (ISO_DATE_RE.test(input)) {
    const d = new Date(input + "T00:00:00Z");
    return isNaN(d.getTime()) ? null : d;
  }

  if (ISO_TIMESTAMP_RE.test(input)) {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : stripTime(d);
  }

  const ddMmMatch = DD_MM_YYYY_RE.exec(input);
  if (ddMmMatch) {
    const [, dd, mm, yyyy] = ddMmMatch;
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function excelSerialToDate(serial: number): Date | null {
  if (serial < 1 || serial > 100000) return null;
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const ms = excelEpoch.getTime() + serial * 86400000;
  return new Date(ms);
}

function stripTime(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
