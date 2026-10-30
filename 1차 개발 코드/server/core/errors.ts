export class DomainError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public details?: Record<string, unknown>,
  ) {
    super(code);
  }
}
export function demand(
  condition: unknown,
  code: string,
  status = 400,
  details?: Record<string, unknown>,
): asserts condition {
  if (!condition) throw new DomainError(code, status, details);
}
export function version(row: { version: number | string }, expected: number) {
  demand(Number(row.version) === expected, 'VERSION_CONFLICT', 409, {
    currentVersion: Number(row.version),
  });
}
export function mapDbError(e: unknown): DomainError {
  if (e instanceof DomainError) return e;
  const err = e as { code?: string; message?: string };
  if (err.code === '23505') return new DomainError('DUPLICATE_RESOURCE', 409);
  if (err.code === '23503' || err.code === '22P02' || err.code === '22007')
    return new DomainError('VALIDATION_ERROR');
  if (err.code === '23514')
    return new DomainError(
      /^[A-Z_]+$/.test(err.message ?? '') ? err.message! : 'VALIDATION_ERROR',
      409,
    );
  if (['40001', '40P01'].includes(err.code ?? '')) return new DomainError('CONCURRENT_CHANGE', 409);
  return new DomainError('INTERNAL_ERROR', 500);
}
