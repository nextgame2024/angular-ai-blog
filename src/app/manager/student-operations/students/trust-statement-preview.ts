export interface StatementDeposit {
  row: number;
  date: string;
  amount: string;
  reference: string;
  transactionId: string;
}

export const statementHeaders = ['Date', 'Amount', 'Currency', 'Status', 'Account', 'Transaction ID', 'Reference'];
export const statementFileLimit = 512 * 1024;

export async function readStatementFile(file: File) {
  const name = file.name.trim();
  if (!/^[^/\\\x00-\x1f\x7f]+\.csv$/i.test(name) || name.length > 255 || !file.size || file.size > statementFileLimit) {
    throw new Error('Select a nonempty CSV file up to 512 KB with a filename of at most 255 characters.');
  }
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256',bytes);
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
  return {name, sha256, text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};
}

// Record numbers include the header. Newlines inside quoted fields belong to one record.
function csvRecords(text: string): string[][] {
  const records: string[][] = [];
  let fields: string[] = [], field = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === undefined) throw new Error('A quoted CSV field is incomplete.');
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else { quoted = false; closed = true; }
      continue;
    }
    if (c === ',' || c === '\r' || c === '\n' || c === undefined) {
      fields.push(field.trim());
      if (fields.length > 100) throw new Error('Use a CSV with at most 100 columns.');
      field = '';
      closed = false;
      if (c !== ',') {
        records.push(fields);
        fields = [];
        if (records.length > 1002) throw new Error('Select a statement with up to 1,000 data rows.');
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (closed || c === '"') throw new Error('Check the commas and quotes in the CSV.');
    else field += c;
  }
  if (records.at(-1)?.every(cell => !cell)) records.pop();
  if (records.length > 1001) throw new Error('Select a statement with up to 1,000 data rows.');
  return records;
}

export function previewStatement(text: string, account: string, today: string) {
  const [header = [], ...rows] = csvRecords(text);
  const columns = header.map(name => name.toLowerCase());
  const indexes = statementHeaders.map(name => columns.indexOf(name.toLowerCase()));
  if (indexes.includes(-1) || new Set(columns).size !== columns.length) {
    throw new Error('Use each required column once: ' + statementHeaders.join(', ') + '.');
  }
  const reasons = new Map<string, number>();
  function skip(reason: string, count = 1) { reasons.set(reason, (reasons.get(reason) ?? 0) + count); }
  const groups = new Map<string, {deposit: StatementDeposit; fingerprint: string; count: number; reason: string}>();
  rows.forEach((cells, i) => {
    if (cells.every(cell => !cell)) return;
    if (cells.length !== header.length) throw new Error('Column count differs from the header in record ' + (i + 2) + '.');
    const [date, rawAmount, currency, status, sourceAccount, transactionId, reference] = indexes.map(index => cells[index]);
    if (sourceAccount.toLowerCase() !== account.trim().toLowerCase() || !sourceAccount) return skip('Different or missing account');
    if (!transactionId || transactionId.length > 150) return skip('Missing or invalid transaction ID');
    const validAmount = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(rawAmount) && Number(rawAmount) > 0;
    const amount = validAmount ? Number(rawAmount).toFixed(2) : rawAmount;
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(date + 'T00:00:00Z');
    const reason = currency.toUpperCase() !== 'AUD' ? 'Other or missing currency'
      : !['booked','posted'].includes(status.toLowerCase()) ? 'Status other than booked or posted'
      : !validAmount ? 'Amount is not a positive AUD deposit'
      : !parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date || date > today ? 'Invalid or future date'
      : reference.length > 150 ? 'Reference exceeds 150 characters' : '';
    const fingerprint = JSON.stringify([date, amount, currency.toUpperCase(), reason, reference]);
    const existing = groups.get(transactionId);
    if (existing) {
      existing.count++;
      if (fingerprint !== existing.fingerprint) existing.reason = 'Conflicting entries for one transaction ID';
    } else groups.set(transactionId, {deposit:{row:i + 2,date,amount,reference,transactionId},fingerprint,count:1,reason});
  });
  const deposits: StatementDeposit[] = [];
  for (const {deposit,count,reason} of groups.values()) {
    if (reason) skip(reason,count);
    else {
      deposits.push(deposit);
      if (count > 1) skip('Repeated statement row',count - 1);
    }
  }
  return {deposits, reasons:Array.from(reasons, ([label,count]) => ({label,count}))};
}
