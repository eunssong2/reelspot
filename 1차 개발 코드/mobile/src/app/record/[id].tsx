import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, PanResponder, Animated } from 'react-native';
import { router, useLocalSearchParams, useIsFocused } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useFocusLoad } from '../../lib/effects';
import { formatMoment } from '../../lib/preferences';
import { API, currentSession, api } from '../../lib/api';
import { Screen, Button, P, useAction } from '../../components/ui';
function Video({ uri }: { uri: string }) {
  const player = useVideoPlayer(
    { uri, useCaching: true, headers: { Authorization: `Bearer ${currentSession()?.accessToken}` } },
    (p) => {
      p.loop = false;
    },
  );
  const [error, setError] = useState('');
  useEffect(() => { const sub = player.addListener('statusChange', (event) => { setError(event.status === 'error' ? '영상을 불러오지 못했습니다. 네트워크 또는 파일 접근 상태를 확인해 주세요.' : ''); }); return () => { sub.remove(); }; }, [player]);
  return <><VideoView player={player} style={{ height: 430 }} nativeControls />{error && <P>{error}</P>}</>;
}
function ZoomPhoto({ uri }: { uri: string }) {
  const [error, setError] = useState('');
  const [scale] = useState(() => new Animated.Value(1)),
    [offset] = useState(() => new Animated.ValueXY());
  const initial = useRef(0);
  const responder = useMemo(() => {
    // PanResponder stores these callbacks; the ref is read only by gesture events.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (e.nativeEvent.touches.length === 2) {
          const [a, b] = e.nativeEvent.touches;
          initial.current = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
        }
      },
      onPanResponderMove: (e, g) => {
        if (e.nativeEvent.touches.length === 2) {
          const [a, b] = e.nativeEvent.touches;
          scale.setValue(
            Math.max(
              1,
              Math.min(
                5,
                Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) / (initial.current || 1),
              ),
            ),
          );
        } else offset.setValue({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: () => {},
    });
  }, [scale, offset]);
  return (
    <View style={{ height: 430, overflow: 'hidden' }} {...responder.panHandlers}>
      {error && <P>{error}</P>}
      {/* RN 0.86 Android forwards authenticated image headers for array sources. */}
      <Animated.Image onLoad={() => setError('')} onError={() => setError('사진을 불러오지 못했습니다. 네트워크 또는 파일 접근 상태를 확인해 주세요.')}
        source={[{ uri, headers: { Authorization: `Bearer ${currentSession()?.accessToken}` } }]}
        style={{
          width: '100%',
          height: 430,
          transform: [...offset.getTranslateTransform(), { scale }],
        }}
        resizeMode="contain"
      />
    </View>
  );
}
export default function Record() {
  const {
    id,
    context = 'shared',
    kind, authorUserId, metadata,
    allowSave = 'true',
  } = useLocalSearchParams<{ id: string; context?: string; kind?: string; authorUserId?: string; metadata?: string; allowSave?: string }>();
  const focused = useIsFocused();
  const [actual, setActual] = useState<any>(null), a = useAction();
  useFocusLoad(() => { let live = true; setActual(null); a.run(async () => { const r = await api(`/media/${id}?context=${context}`); if (live) setActual(r); }); return () => { live = false; }; }, [id, context]);
  let info: any = {}; try { info = JSON.parse(metadata ?? '{}'); } catch { /* Invalid route metadata is ignored. */ }
  if (actual) info = actual.media;
  const uri = `${API}/v1/media/${id}/content?variant=view&context=${context}&cacheScope=${currentSession()?.userId}&cacheVersion=${actual?.media.version ?? ''}`;
  return (
    <Screen title="우리의 기록">
      {focused && actual && (actual.media.kind === 'video' ? <Video uri={uri} /> : <ZoomPhoto uri={uri} />)}
      {info.displayName && <P>작성자 {info.displayName}</P>}
      {info.recordDate && <P>기록일 {info.recordDate} · {info.visitName || '장소 미지정'}</P>}
      {info.description && <P>{info.description}</P>}
      <P>촬영 시각 {formatMoment(info.capturedAt)}</P>
      {info.completedAt && <P>업로드 시각 {formatMoment(info.completedAt)}</P>}
      {info.retentionLastDate && <P>{info.retentionLastDate}까지 보관</P>}
      <P>
        {(actual?.media.kind ?? kind) === 'video'
          ? '재생 버튼으로 영상을 보고 전체 화면으로 감상할 수 있어요.'
          : '사진은 두 손가락으로 확대하고 드래그해 살펴볼 수 있어요.'}
      </P>
      {allowSave === 'true' && actual?.canSave && (
        <Button onPress={() => router.push({ pathname: '/save', params: { ids: id } })}>
          휴대폰에 저장
        </Button>
      )}
      {actual?.canEdit && (!authorUserId || authorUserId === currentSession()?.userId) && <Button
        secondary
        onPress={() => router.push({ pathname: '/edit-records', params: { ids: id, context } })}
      >
        본인 기록 수정·삭제
      </Button>}
      <Button
        secondary
        onPress={() =>
          router.push({ pathname: '/report', params: { targetType: 'media', targetId: id, userId: actual?.media.authorUserId } })
        }
      >
        신고
      </Button>
      {a.errorView}
    </Screen>
  );
}
