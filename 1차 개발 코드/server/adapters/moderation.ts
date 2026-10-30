import { config } from '../core/config.js';
export type Verdict = 'passed' | 'review' | 'rejected';
export async function moderate(input: {
  text?: string;
  path?: string;
  mime?: string;
}): Promise<Verdict> {
  if (config.moderationMode === 'development' && !config.production)
    return input.text?.includes('[reject]')
      ? 'rejected'
      : input.text?.includes('[review]')
        ? 'review'
        : 'passed';
  if (!process.env.MODERATION_URL) return 'review';
  try {
    const body = input.path ? new FormData() : null;
    if (body) {
      const { readFile } = await import('node:fs/promises');
      body.append('file', new Blob([await readFile(input.path!)]), 'content');
      body.append('mime', input.mime ?? 'application/octet-stream');
      if (input.text) body.append('text', input.text);
    }
    const r = await fetch(process.env.MODERATION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MODERATION_TOKEN ?? ''}`,
        ...(!body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ?? JSON.stringify(input),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return 'review';
    const result = (await r.json()) as { verdict: string };
    return ['passed', 'rejected'].includes(result.verdict) ? (result.verdict as Verdict) : 'review';
  } catch {
    return 'review';
  }
}
