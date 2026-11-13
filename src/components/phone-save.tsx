import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { saveToPhone, type SaveResult, type SaveStage } from '../lib/save-to-phone';
import { savedMessage } from '../lib/upload-summary';
import { useAppToast } from './toast-provider';
import { Button, colors } from './ui';

const stageText = (s: SaveStage) =>
  s.step === 'preparing'
    ? '저장할 파일을 준비하고 있어요'
    : `${s.index}/${s.total} · ${s.step === 'downloading' ? '내려받는 중' : '휴대폰에 저장하는 중'}`;
/**
 * Saves records to the phone from the current screen (QA-04): no separate page and no second
 * button. The result is announced after the album write; only failed files are retried.
 */
export function usePhoneSave(onSaved?: () => void) {
  const toast = useAppToast();
  const running = useRef(false);
  const [stage, setStage] = useState<SaveStage | null>(null);
  const [failure, setFailure] = useState<{ ids: string[]; saved: string; reason: string } | null>(null);
  async function start(ids: string[]) {
    // A second tap while saving must not write the same files twice.
    if (running.current || !ids.length) return;
    running.current = true;
    setFailure(null);
    let results: SaveResult[];
    try {
      results = await saveToPhone(ids, setStage);
    } catch (e) {
      results = ids.map((mediaId) => ({ mediaId, kind: 'photo' as const, saved: false, reason: (e as Error).message }));
    } finally {
      running.current = false;
      setStage(null);
    }
    const saved = results.filter((r) => r.saved),
      failed = results.filter((r) => !r.saved);
    const message = savedMessage(saved.filter((r) => r.kind === 'photo').length, saved.filter((r) => r.kind === 'video').length);
    if (!failed.length) {
      toast(message);
      onSaved?.();
      return;
    }
    setFailure({ ids: failed.map((r) => r.mediaId), saved: message, reason: failed[0].reason ?? '' });
  }
  const view = (
    <Modal visible={!!stage || !!failure} transparent animationType="fade" onRequestClose={() => { if (!stage) setFailure(null); }}>
      <View style={{ flex: 1, backgroundColor: '#0007', justifyContent: 'flex-end', padding: 20, paddingBottom: 28 }}>
        <View accessibilityViewIsModal accessibilityLiveRegion="polite" style={{ backgroundColor: 'white', borderRadius: 20, padding: 20, gap: 12 }}>
          {stage ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink }}>{stageText(stage)}</Text>
            </View>
          ) : failure ? (
            <>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>
                {failure.saved ? `${failure.ids.length}개는 저장하지 못했어요` : '저장하지 못했어요'}
              </Text>
              {!!failure.saved && <Text style={{ fontSize: 15, color: colors.sub }}>{failure.saved}</Text>}
              {!!failure.reason && <Text style={{ fontSize: 14, lineHeight: 21, color: colors.sub }}>{failure.reason}</Text>}
              <Button onPress={() => void start(failure.ids)}>{failure.saved ? '실패한 파일만 다시 저장' : '다시 시도'}</Button>
              <Button secondary onPress={() => setFailure(null)}>닫기</Button>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
  return { start, view, busy: !!stage };
}
