import type { MergeClip, MergeOptions, MergeResult } from './mergeVideos';

export type { MergeClip, MergeOptions, MergeProgress, MergeResult } from './mergeVideos';

/**
 * 브라우저 안에서 동영상 여러 개를 순서대로 이어 붙인다(서버·추가 라이브러리 없음).
 *
 * 방법: 클립을 하나씩 숨은 <video> 로 재생하면서
 * - 화면은 canvas 에 그리고(canvas.captureStream),
 * - 소리는 Web Audio 로 한 줄에 모아(MediaStreamAudioDestinationNode),
 * 두 스트림을 MediaRecorder 로 녹화한다. 클립 사이에는 녹화를 잠깐 멈춰서 로딩 공백이 들어가지 않게 한다.
 *
 * 한계(가능성 확인용 프로토타입):
 * - 실제 재생하며 녹화하므로 합치는 데 "전체 길이만큼" 시간이 걸린다. 탭이 백그라운드로 가면 프레임이 끊긴다.
 * - 출력 형식은 브라우저가 정한다(크롬: webm, 사파리: mp4). 크롬 webm 은 길이 정보가 비어 있어 탐색이 불편할 수 있다.
 * - 브라우저가 못 여는 코덱(예: 크롬에서 아이폰 HEVC .mov)은 합칠 수 없다.
 */
export const MERGE_SUPPORTED =
  typeof window !== 'undefined' &&
  typeof MediaRecorder !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' &&
  'captureStream' in HTMLCanvasElement.prototype;

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

const pickMimeType = () => MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';

/** 클립 하나를 불러와 재생 준비가 될 때까지 기다린다. 못 열면 파일 이름을 담아 실패한다. */
function loadVideo(clip: MergeClip): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error(`'${clip.name}' 을(를) 이 브라우저에서 열 수 없어요 (지원하지 않는 코덱일 수 있어요)`));
    video.src = clip.uri;
  });
}

/** 원본 비율을 유지한 채 캔버스 안에 꽉 차게(남는 곳은 검은 여백) 그린다. */
function drawContain(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) {
  const vw = video.videoWidth || width;
  const vh = video.videoHeight || height;
  const scale = Math.min(width / vw, height / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh);
}

/** 위쪽 가운데에 흰 글씨 + 검은 테두리로 글씨를 얹는다(밝은 장면에서도 읽히게). 긴 글씨는 폭에 맞춰 줄인다. */
function drawOverlayText(ctx: CanvasRenderingContext2D, text: string, width: number, height: number) {
  const maxWidth = width * 0.86;
  let fontSize = Math.round(width * 0.12);
  const font = (size: number) => `800 ${size}px "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  ctx.font = font(fontSize);
  while (fontSize > 20 && ctx.measureText(text).width > maxWidth) {
    fontSize -= 2;
    ctx.font = font(fontSize);
  }

  const x = width / 2;
  const y = height * 0.12;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, fontSize * 0.12);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
}

export async function mergeVideos(clips: MergeClip[], options: MergeOptions = {}): Promise<MergeResult> {
  if (!MERGE_SUPPORTED) throw new Error('이 브라우저는 동영상 합치기를 지원하지 않아요');
  if (clips.length < 2) throw new Error('동영상을 2개 이상 골라 주세요');

  const { width = 720, height = 1280, fps = 30, onProgress } = options;
  const overlayText = options.overlayText?.trim() ?? '';

  // AudioContext 는 버튼을 누른 흐름 안(첫 await 전)에서 만들어야 자동재생 제한에 덜 걸린다.
  const audioCtx = new AudioContext();
  const audioDest = audioCtx.createMediaStreamDestination();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없어요');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // 매 프레임: 영상을 그린 뒤 그 위에 글씨를 얹는다.
  const drawFrame = (video: HTMLVideoElement) => {
    drawContain(ctx, video, width, height);
    if (overlayText) drawOverlayText(ctx, overlayText, width, height);
  };

  const canvasStream = canvas.captureStream(fps);
  const stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioDest.stream.getAudioTracks()]);

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  let muted = false;
  let recordedMs = 0;
  const startedAt = performance.now();

  try {
    await audioCtx.resume();

    for (let index = 0; index < clips.length; index += 1) {
      const video = await loadVideo(clips[index]);
      // 소리를 스피커가 아니라 녹화 스트림으로만 보낸다(합치는 동안 소리가 나지 않는다).
      audioCtx.createMediaElementSource(video).connect(audioDest);

      if (recorder.state === 'inactive') recorder.start(1000);
      else recorder.resume();

      const clipStart = performance.now();
      await new Promise<void>((resolve, reject) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          drawFrame(video); // 마지막 프레임을 확실히 남긴다.
          resolve();
        };
        video.onended = finish;
        video.onerror = () => reject(new Error(`'${clips[index].name}' 재생 중 오류가 났어요`));

        const tick = () => {
          if (done) return;
          drawFrame(video);
          const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
          onProgress?.({ index, total: clips.length, clipRatio: duration ? Math.min(video.currentTime / duration, 1) : 0 });
          requestAnimationFrame(tick);
        };

        video
          .play()
          .catch(async (error: unknown) => {
            // 자동재생 제한으로 소리 있는 재생이 막히면 음소거로 다시 시도한다(결과물에 소리가 빠진다).
            if (error instanceof DOMException && error.name === 'NotAllowedError' && !video.muted) {
              muted = true;
              video.muted = true;
              return video.play();
            }
            throw error;
          })
          .then(() => requestAnimationFrame(tick))
          .catch(reject);
      });

      recordedMs += performance.now() - clipStart;
      recorder.pause();
      video.removeAttribute('src');
      video.load();
    }

    recorder.resume();
    recorder.stop();
    await stopped;
  } catch (error) {
    if (recorder.state !== 'inactive') recorder.stop();
    throw error;
  } finally {
    canvasStream.getTracks().forEach((track) => track.stop());
    void audioCtx.close();
  }

  const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' });
  return {
    uri: URL.createObjectURL(blob),
    mimeType: blob.type,
    sizeBytes: blob.size,
    durationMs: Math.round(recordedMs),
    elapsedMs: Math.round(performance.now() - startedAt),
    muted,
  };
}
