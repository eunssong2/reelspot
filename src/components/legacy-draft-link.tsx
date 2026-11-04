import { useState } from 'react';
import { router } from 'expo-router';
import { currentSession } from '../lib/api';
import { useFocusLoad } from '../lib/effects';
import { listUploadDrafts } from '../lib/upload-draft';
import { Button } from './ui';

export function LegacyDraftLink() {
  const userId = currentSession()?.userId;
  const [exists, setExists] = useState(false);
  useFocusLoad(() => {
    let live = true;
    if (userId) void listUploadDrafts(userId).then((entries) => { if (live) setExists(entries.length > 0); }).catch(() => { if (live) setExists(false); });
    else setExists(false);
    return () => { live = false; };
  }, [userId]);
  return exists ? <Button secondary onPress={() => router.push('/upload-drafts')}>이전 저장 후보 정리</Button> : null;
}
