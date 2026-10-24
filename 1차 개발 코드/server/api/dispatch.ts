import type { Handler, Context } from '../core/context.js';
import { authHandlers } from '../services/auth.js';
import { groupHandlers } from '../services/groups.js';
import { recordHandlers } from '../services/records.js';
import { operationHandlers } from '../services/operations.js';
import { demand } from '../core/errors.js';
export const handlers: Record<string, Handler> = {
  ...authHandlers,
  ...groupHandlers,
  ...recordHandlers,
  ...operationHandlers,
};
export async function dispatch(id: string, c: Context) {
  demand(handlers[id], 'UNKNOWN_OPERATION', 404);
  return handlers[id](c);
}
export const operationKinds: Record<string, string> = {
  groupCreate: 'group_create',
  groupUpdate: 'group_update',
  profilePatch: 'profile_patch',
  scheduleCreate: 'schedule_create',
  scheduleUpdate: 'schedule_update',
  planUpdate: 'plan_update',
  metadataPatch: 'metadata_change',
  uploadCommit: 'media_commit',
  mediaDelete: 'media_delete',
  accountDelete: 'account_delete',
  groupClose: 'group_close',
  onboard: 'onboarding',
  visitCreate: 'visit_create',
};
