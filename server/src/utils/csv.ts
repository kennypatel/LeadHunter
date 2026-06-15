// CSV lead import: parsing, normalization, and dedupe-key helpers.
import Papa from 'papaparse';

export interface ParsedLead {
  name: string;
  phone?: string;
  email?: string;
  source?: string;
  estimatedValue?: number;
  notesText?: string;
}

/** Normalize a US phone to digits only (last 10) for stable dedupe. */
export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed) ? trimmed : null;
}

/** Stable dedupe key: prefer phone, fall back to email, then name. */
export function dedupeKey(lead: { phone?: string | null; email?: string | null; name?: string | null }): string {
  return normalizePhone(lead.phone) || normalizeEmail(lead.email) || (lead.name || '').trim().toLowerCase();
}

const FIELD_ALIASES: Record<string, keyof ParsedLead> = {
  name: 'name',
  'full name': 'name',
  fullname: 'name',
  customer: 'name',
  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  cell: 'phone',
  email: 'email',
  'email address': 'email',
  source: 'source',
  lead_source: 'source',
  value: 'estimatedValue',
  'estimate': 'estimatedValue',
  'estimated value': 'estimatedValue',
  amount: 'estimatedValue',
  notes: 'notesText',
  note: 'notesText',
  comments: 'notesText',
};

function coerceRow(row: Record<string, string>): ParsedLead | null {
  const out: Partial<ParsedLead> = {};
  for (const [rawKey, rawVal] of Object.entries(row)) {
    const key = FIELD_ALIASES[rawKey.trim().toLowerCase()];
    if (!key || rawVal == null || rawVal === '') continue;
    if (key === 'estimatedValue') {
      const num = Number(String(rawVal).replace(/[^0-9.]/g, ''));
      if (!Number.isNaN(num)) out.estimatedValue = Math.round(num);
    } else {
      (out as Record<string, string>)[key] = String(rawVal).trim();
    }
  }
  if (!out.name) {
    // Synthesize a name so the lead is still usable.
    out.name = out.email || out.phone || 'Unknown Lead';
  }
  return out as ParsedLead;
}

export interface CsvImportResult {
  leads: ParsedLead[];
  errors: string[];
  duplicatesInFile: number;
}

/** Parse a CSV string into normalized, in-file-deduplicated leads. */
export function parseLeadsCsv(csv: string): CsvImportResult {
  const errors: string[] = [];
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length) {
    for (const e of parsed.errors.slice(0, 5)) {
      errors.push(`Row ${e.row}: ${e.message}`);
    }
  }

  const seen = new Set<string>();
  const leads: ParsedLead[] = [];
  let duplicatesInFile = 0;

  for (const row of parsed.data) {
    const lead = coerceRow(row);
    if (!lead) continue;
    const key = dedupeKey(lead);
    if (key && seen.has(key)) {
      duplicatesInFile++;
      continue;
    }
    if (key) seen.add(key);
    leads.push(lead);
  }

  return { leads, errors, duplicatesInFile };
}
