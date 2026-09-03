export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"'; i += 1; continue;
    }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(field.trim()); field = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field.trim()); field = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function alignedLines(value: string) {
  const list = value.replace(/\r/g, '').split('\n').map((v) => v.trim());
  while (list.length && !list[list.length - 1]) list.pop();
  return list;
}

export function alignedFlexible(value: string) {
  const normalized = value.replace(/\r/g, '');
  const list = normalized.includes('\n') ? normalized.split('\n') : normalized.split(',');
  const clean = list.map((v) => v.trim());
  while (clean.length && !clean[clean.length - 1]) clean.pop();
  return clean;
}

export function lines(value: string) {
  return alignedLines(value).filter(Boolean);
}
