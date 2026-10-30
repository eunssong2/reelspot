import { useInitialize } from '../lib/effects';
import React, { useRef, useState } from 'react';
import { View, AppState, Image } from 'react-native';
import { router, useLocalSearchParams, useIsFocused } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVideoPlayer, VideoView } from 'expo-video';
import { api } from '../lib/api';
import { Transfer } from '../../modules/atp-transfer';
import { Screen, Button, P, useAction, s } from '../components/ui';
function CaptureVideo({ uri }: { uri: string }) { const player = useVideoPlayer(uri); return <VideoView player={player} style={{ height: 360 }} nativeControls />; }
export default function Camera() {
  const params = useLocalSearchParams<Record<string, string>>(),
    camera = useRef<CameraView>(null),
    [permission, request] = useCameraPermissions(),
    [microphone, requestMic] = useMicrophonePermissions(),
    [mode, setMode] = useState<'picture' | 'video'>('picture'),
    [facing, setFacing] = useState<CameraType>('back'),
    [seconds, setSeconds] = useState(3),
    [recording, setRecording] = useState(false),
    [preparing, setPreparing] = useState(false),
    [sound, setSound] = useState(true),
    [ready, setReady] = useState(false), [allowed, setAllowed] = useState(false),
    [result, setResult] = useState<{ uri: string; mime: string } | null>(null), [quality, setQuality] = useState<'1080p' | '720p'>('1080p');
  const focused = useIsFocused();
  const a = useAction();
  useInitialize(() => {
    a.run(async () => { const d = await api(`/schedules/${params.id}`); if (d.schedule.status !== 'active' || Date.parse(d.retention.expiresAt) <= Date.now()) throw new Error('취소·만료된 일정에는 새로 촬영해 올릴 수 없습니다.'); setAllowed(true); });
    AsyncStorage.getItem('atp.camera-duration').then((v) => {
      if (v) setSeconds(Number(v));
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') camera.current?.stopRecording();
    });
    return () => {
      sub.remove();
      camera.current?.stopRecording();
    };
  }, []);
  if (result) return <Screen title="촬영 결과 확인"><P>{result.mime.startsWith('video/') ? '영상의 전체 길이와 소리를 확인해 주세요.' : '이 사진을 업로드 후보로 추가할까요?'}</P>
    {result.mime.startsWith('video/') ? <CaptureVideo uri={result.uri} /> : <Image source={{ uri: result.uri }} style={{ height: 360 }} resizeMode="contain" />}
    <Button onPress={() => router.dismissTo({ pathname: '/upload', params: { ...params, uri: result.uri, mime: result.mime } })}>이 파일 사용</Button>
    <Button secondary onPress={() => { setResult(null); setReady(false); }}>다시 촬영</Button>
    <Button secondary onPress={() => router.back()}>촬영 취소</Button>
  </Screen>;
  if (!permission?.granted)
    return (
      <Screen title="지금의 순간 남기기">
        <P>카메라 사용 권한이 필요합니다.</P>
        <Button onPress={request}>카메라 허용</Button>
        {a.errorView}
      </Screen>
    );
  async function capture() {
    await a.run(async () => {
      if (mode === 'video') {
        if (recording) {
          camera.current?.stopRecording();
          return;
        }
        setRecording(true);
        const start = Date.now();
        try {
          const v = await camera.current!.recordAsync({ maxDuration: seconds });
          if (v) {
            if (Date.now() - start < 500) throw new Error('0.5초 이상 촬영해 주세요.');
            setRecording(false);
            setPreparing(true);
            if (!Transfer?.normalizeCapture)
              throw new Error('최신 Android 개발 빌드를 설치해 주세요.');
            const uri = await Transfer.normalizeCapture(v.uri);
            setResult({ uri, mime: 'video/mp4' });
          }
        } finally {
          setRecording(false);
          setPreparing(false);
        }
      } else {
        const p = await camera.current!.takePictureAsync({ quality: 1, exif: true });
        if (p)
          setResult({ uri: p.uri, mime: 'image/jpeg' });
      }
    });
  }
  return (
    <Screen title={preparing ? '영상 준비 중' : recording ? '촬영 중' : '순간을 남겨요'}>
      {focused && <CameraView
        ref={camera}
        style={{ height: 420, borderRadius: 18 }}
        mode={mode}
        facing={facing}
        mute={!microphone?.granted || !sound}
        videoQuality={quality}
        onMountError={() => { if (quality === '1080p') setQuality('720p'); else a.run(async () => { throw new Error('카메라를 사용할 수 없습니다. 다른 앱의 카메라 사용이나 권한을 확인해 주세요.'); }); }}
        onCameraReady={() => setReady(true)}
      />}
      <View style={s.row}>
        <Button
          secondary
          disabled={recording || preparing}
          onPress={() => {
            if (mode !== 'picture') { setMode('picture'); setReady(false); }
          }}
        >
          사진
        </Button>
        <Button
          secondary
          disabled={recording || preparing}
          onPress={() => {
            if (mode !== 'video') { setMode('video'); setReady(false); }
          }}
        >
          영상
        </Button>
        <Button
          secondary
          disabled={recording || preparing}
          onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
        >
          전·후면 전환
        </Button>
      </View>
      {mode === 'video' && (
        <>
          <View style={s.row}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                secondary={seconds !== n}
                disabled={recording || preparing}
                onPress={() => {
                  setSeconds(n);
                  AsyncStorage.setItem('atp.camera-duration', String(n));
                }}
              >
                {n}초
              </Button>
            ))}
          </View>
          <P>{microphone?.granted && sound ? '소리 있는 영상' : '무음 영상'}</P>
          {microphone?.granted && (
            <Button secondary disabled={recording || preparing} onPress={() => setSound(!sound)}>
              {sound ? '소리 끄기' : '소리 켜기'}
            </Button>
          )}
          {!microphone?.granted && (
            <Button secondary onPress={requestMic}>
              마이크 허용
            </Button>
          )}
        </>
      )}
      <Button
        disabled={!allowed || !ready || preparing || (!recording && a.busy)}
        onPress={recording ? () => camera.current?.stopRecording() : capture}
      >
        {preparing
          ? '영상 준비 중'
          : recording
            ? '촬영 종료'
            : mode === 'video'
              ? '영상 촬영 시작'
              : '사진 촬영'}
      </Button>
      {a.errorView}
    </Screen>
  );
}
