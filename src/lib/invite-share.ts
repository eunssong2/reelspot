import { Share } from 'react-native';
import { monthDayTime } from './day-labels';
type ShareGroup = { name: string; scheduleSummary?: { title: string; startDate: string; endDate: string } | null };
type ShareInvite = { code: string; link: string; expiresAt: string };
export function inviteShareMessage(group: ShareGroup, invite: ShareInvite) {
  return [
    `[At that place] '${group.name}'에 초대해요.`,
    ...(group.scheduleSummary ? [`일정: ${group.scheduleSummary.title} (${group.scheduleSummary.startDate} ~ ${group.scheduleSummary.endDate})`] : []),
    `링크를 누르거나 앱에서 코드 ${invite.code} 를 입력하세요.`,
    invite.link,
    `${monthDayTime(invite.expiresAt)}까지 참여할 수 있어요.`,
  ].join('\n');
}
export async function shareGroupInvite(group: ShareGroup, invite: ShareInvite) {
  try { await Share.share({ message: inviteShareMessage(group, invite) }); }
  catch { throw new Error('공유할 수 없어요. 링크 복사를 이용해 주세요'); }
}
