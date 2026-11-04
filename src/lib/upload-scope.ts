import type { Candidate } from './uploads';
export interface UploadScope { userId: string; scheduleId: string; recordDate: string; visitId: string | null }
export const uploadDraftKey = (s: UploadScope) => `atp.upload-draft:${s.userId}:v2:${JSON.stringify([s.scheduleId, s.recordDate, s.visitId])}`;
export function assertUploadScope(scope: UploadScope, files: Candidate[]) {
  if (files.some((f) => f.recordDate !== scope.recordDate || f.visitId !== scope.visitId))
    throw new Error('다른 날짜·장소의 파일이 섞여 있어요. 원래 장소의 업로드 시트에서 다시 확인해 주세요.');
}
