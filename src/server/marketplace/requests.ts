import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RequestInput, RequestRecord } from '../../shared/marketplace/requests.js';
import type { Quote, RequestStatus } from '../../shared/marketplace/types.js';

/**
 * Stores booking and enquiry requests on disk (one JSON object per line) so they survive restarts.
 * Only a hash of each request's access token is kept: whoever submitted the request can check or
 * withdraw it with the token; nobody else can read it through the API. Old requests are deleted
 * after the retention period.
 */
type Stored = RequestRecord & { tokenHash: string; input: RequestInput; expiresAt: string };

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export class RequestStore {
  private file: string;
  private records = new Map<string, Stored>();
  private ready?: Promise<void>;
  constructor(private dir: string, private retentionDays: number, private webhook: string | null, private fetcher: typeof fetch = fetch, private log: (line: string) => void = () => {}) {
    this.file = join(dir, 'requests.jsonl');
  }

  private init() {
    this.ready ??= (async () => {
      await mkdir(this.dir, { recursive: true, mode: 0o700 });
      let raw = '';
      try { raw = await readFile(this.file, 'utf8'); } catch { /* first run */ }
      const now = Date.now();
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
          const record = JSON.parse(line) as Stored;
          if (Date.parse(record.expiresAt) > now) this.records.set(record.ref, record); else this.records.delete(record.ref);
        } catch { /* skip a damaged line rather than refusing to start */ }
      }
      await this.compact();
    })();
    return this.ready;
  }

  /** Rewrites the file with only live records (drops expired and withdrawn history). */
  private async compact() {
    const lines = [...this.records.values()].map(record => JSON.stringify(record)).join('\n');
    const temp = `${this.file}.tmp`;
    await writeFile(temp, lines ? lines + '\n' : '', { mode: 0o600 });
    await rename(temp, this.file);
  }

  async create(input: RequestInput, summary: string, quote: Quote | null): Promise<RequestRecord & { token: string }> {
    await this.init();
    const token = randomBytes(24).toString('base64url');
    const ref = `ICR-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.retentionDays * 86_400_000).toISOString();
    const record: Stored = { ref, kind: input.kind, status: 'received', createdAt, summary, quote, forwarded: false, tokenHash: hash(token), input: { ...input, website: '' }, expiresAt };
    if (this.webhook) {
      try {
        const response = await this.fetcher(this.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref, kind: input.kind, summary, quote, createdAt, request: record.input }), signal: AbortSignal.timeout(8000) });
        record.forwarded = response.ok;
        if (response.ok) record.status = 'forwarded';
      } catch { record.forwarded = false; }
      this.log(`request ${ref} ${record.forwarded ? 'forwarded' : 'not forwarded'}`);
    }
    this.records.set(ref, record);
    await appendFile(this.file, JSON.stringify(record) + '\n', { mode: 0o600 });
    return { ...this.public(record), token };
  }

  private public(record: Stored): RequestRecord {
    return { ref: record.ref, kind: record.kind, status: record.status, createdAt: record.createdAt, summary: record.summary, quote: record.quote, forwarded: record.forwarded };
  }

  private async authorised(ref: string, token: string): Promise<Stored | null> {
    await this.init();
    const record = this.records.get(ref);
    if (!record) return null;
    const a = Buffer.from(hash(token)), b = Buffer.from(record.tokenHash);
    return a.length === b.length && timingSafeEqual(a, b) ? record : null;
  }

  async get(ref: string, token: string): Promise<RequestRecord | null> {
    const record = await this.authorised(ref, token);
    return record ? this.public(record) : null;
  }

  /** Withdraws a request and erases the personal details it contained. */
  async withdraw(ref: string, token: string): Promise<RequestRecord | null> {
    const record = await this.authorised(ref, token);
    if (!record) return null;
    record.status = 'withdrawn' as RequestStatus;
    record.input = { ...record.input, contact: { name: '', email: '', phone: '', preferred: 'email' }, message: '', guardian: record.input.guardian ? { relationship: '', consent: false } : null };
    await this.compact();
    return this.public(record);
  }

  async count() { await this.init(); return this.records.size; }
}
