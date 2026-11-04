/** Only an explicit task/clientFileId mapping proves acceptance. Missing errors are not proof. */
export function remainingCandidates<T extends { clientFileId: string }>(files: T[], tasks: { clientFileId: string }[]): T[] {
  const accepted = new Set(tasks.map((t) => t.clientFileId));
  return files.filter((f) => !accepted.has(f.clientFileId));
}
