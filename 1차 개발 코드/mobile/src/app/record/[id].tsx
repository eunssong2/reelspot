import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, PanResponder, Animated, Text, Pressable, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams, useIsFocused } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useFocusLoad } from '../../lib/effects';
import { formatMoment } from '../../lib/preferences';
import { API, currentSession, api } from '../../lib/api';
import { Button, P, Sheet, useAction } from '../../components/ui';
function Video({ uri }: { uri: string }) {
  const player = useVideoPlayer(
    {
      uri,
      useCaching: true,
      headers: { Authorization: `Bearer ${currentSession()?.accessToken}` },
    },
    (p) => {
      p.loop = false;
    },
  );
  const [error, setError] = useState('');
  useEffect(() => {
    const sub = player.addListener('statusChange', (event) => {
      setError(
        event.status === 'error'
          ? '영상을 불러오지 못했습니다. 네트워크 또는 파일 접근 상태를 확인해 주세요.'
          : '',
      );
    });
    return () => {
      sub.remove();
    };
  }, [player]);
  return (
    <>
      <VideoView player={player} style={{ flex: 1 }} nativeControls />
      {error && <P>{error}</P>}
    </>
  );
}
function ZoomPhoto({ uri }: { uri: string }) {
  const [error, setError] = useState('');
  const { height } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);
  const [scale] = useState(() => new Animated.Value(1)),
    [offset] = useState(() => new Animated.ValueXY());
  const initial = useRef(0),
    baseZoom = useRef(1),
    currentZoom = useRef(1);
  const responder = useMemo(() => {
    // PanResponder stores these callbacks; the ref is read only by gesture events.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (e.nativeEvent.touches.length === 2) {
          const [a, b] = e.nativeEvent.touches;
          baseZoom.current = currentZoom.current;
          initial.current = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
        }
      },
      onPanResponderMove: (e, g) => {
        if (e.nativeEvent.touches.length === 2) {
          const [a, b] = e.nativeEvent.touches;
          currentZoom.current = Math.max(
            1,
            Math.min(
              5,
              (baseZoom.current * Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)) /
                (initial.current || 1),
            ),
          );
          scale.setValue(currentZoom.current);
        } else offset.setValue({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: () => setZoom(Math.round(currentZoom.current * 10) / 10),
    });
  }, [scale, offset]);
  return (
    <View style={{ flex: 1, justifyContent: 'center', overflow: 'hidden' }}>
      {error && <P>{error}</P>}
      {/* RN 0.86 Android forwards authenticated image headers for array sources. */}
      <Animated.Image
        onLoad={() => setError('')}
        onError={() =>
          setError('사진을 불러오지 못했습니다. 네트워크 또는 파일 접근 상태를 확인해 주세요.')
        }
        source={[{ uri, headers: { Authorization: `Bearer ${currentSession()?.accessToken}` } }]}
        style={{
          width: '100%',
          height: height * 0.65,
          transform: [...offset.getTranslateTransform(), { scale }],
        }}
        resizeMode="contain"
        {...responder.panHandlers}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 10,
          alignSelf: 'center',
          flexDirection: 'row',
          gap: 20,
          alignItems: 'center',
        }}
      >
        <Pressable
          accessibilityLabel="축소"
          onPress={() => {
            const z = Math.max(1, zoom - 1);
            currentZoom.current = z;
            setZoom(z);
            scale.setValue(z);
            offset.setValue({ x: 0, y: 0 });
          }}
          style={{ padding: 12, borderRadius: 24, backgroundColor: '#29292B' }}
        >
          <Text style={{ color: 'white' }}>−</Text>
        </Pressable>
        <Text style={{ color: 'white', fontSize: 12 }}>{zoom}배</Text>
        <Pressable
          accessibilityLabel="확대"
          onPress={() => {
            const z = Math.min(5, zoom + 1);
            currentZoom.current = z;
            setZoom(z);
            scale.setValue(z);
          }}
          style={{ padding: 12, borderRadius: 24, backgroundColor: '#29292B' }}
        >
          <Text style={{ color: 'white' }}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}
export default function Record() {
  const {
    id,
    context = 'shared',
    authorUserId,
    metadata,
    allowSave = 'true',
  } = useLocalSearchParams<{
    id: string;
    context?: string;
    kind?: string;
    authorUserId?: string;
    metadata?: string;
    allowSave?: string;
  }>();
  const focused = useIsFocused();
  const [actual, setActual] = useState<any>(null),
    [menu, setMenu] = useState(false),
    a = useAction();
  useFocusLoad(() => {
    let live = true;
    setActual(null);
    a.run(async () => {
      const r = await api(`/media/${id}?context=${context}`);
      if (live) setActual(r);
    });
    return () => {
      live = false;
    };
  }, [id, context]);
  let info: any = {};
  try {
    info = JSON.parse(metadata ?? '{}');
  } catch {
    /* Invalid route metadata is ignored. */
  }
  if (actual) info = actual.media;
  const uri = `${API}/v1/media/${id}/content?variant=view&context=${context}&cacheScope=${currentSession()?.userId}&cacheVersion=${actual?.media.version ?? ''}`;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#141416' }}>
      <StatusBar style="light" />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="기록 메뉴"
          onPress={() => setMenu(true)}
          style={{ padding: 14 }}
        >
          <Text style={{ color: 'white', fontSize: 22 }}>⋯</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="감상 닫기"
          onPress={() => router.back()}
          style={{ padding: 14 }}
        >
          <Text style={{ color: 'white', fontSize: 22 }}>×</Text>
        </Pressable>
      </View>
      {focused &&
        actual &&
        (actual.media.kind === 'video' ? <Video uri={uri} /> : <ZoomPhoto uri={uri} />)}
      {!actual && <View style={{ flex: 1 }}>{a.errorView}</View>}
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: 'white' }}>
          {info.displayName ?? '내 기록'} · {formatMoment(info.capturedAt ?? info.completedAt)}
        </Text>
        {!!info.description && (
          <Text style={{ fontSize: 12, lineHeight: 19, color: '#D1D6DB', marginTop: 6 }}>
            {info.description}
          </Text>
        )}
      </View>
      <Sheet visible={menu} title="기록 메뉴" onClose={() => setMenu(false)}>
        <P>
          {info.recordDate} · {info.visitName || '장소 미지정'}
        </P>
        {!!info.retentionLastDate && <P>{info.retentionLastDate}까지 보관</P>}
        {allowSave === 'true' && actual?.canSave && (
          <Button
            onPress={() => {
              setMenu(false);
              router.push({ pathname: '/save', params: { ids: id } });
            }}
          >
            휴대폰에 저장
          </Button>
        )}
        {actual?.canEdit && (!authorUserId || authorUserId === currentSession()?.userId) && (
          <Button
            secondary
            onPress={() => {
              setMenu(false);
              router.push({ pathname: '/edit-records', params: { ids: id, context } });
            }}
          >
            본인 기록 수정·삭제
          </Button>
        )}
        <Button
          secondary
          onPress={() => {
            setMenu(false);
            router.push({
              pathname: '/report',
              params: { targetType: 'media', targetId: id, userId: actual?.media.authorUserId },
            });
          }}
        >
          신고
        </Button>
        {a.errorView}
      </Sheet>
    </SafeAreaView>
  );
}
