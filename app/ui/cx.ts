/** Junta classes CSS ignorando valores falsos. */
export function cx(...classes: unknown[]): string {
  return classes.filter(Boolean).join(' ');
}
