export function isStorageNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; status?: unknown };
  return candidate.code === "ENOENT" || candidate.status === 404;
}