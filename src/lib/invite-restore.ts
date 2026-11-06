// One decision per account per JS execution, not per Home instance.
// A cold app start creates a fresh set; the persisted invitation is never consumed here.
const handled = new Set<string>();
export function markInviteRestoreHandled(userId: string) { handled.add(userId); }
export function claimInviteRestore(userId: string) {
  if (handled.has(userId)) return false;
  handled.add(userId);
  return true;
}
