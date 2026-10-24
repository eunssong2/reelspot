/** 합친 결과를 브라우저 기본 플레이어로 보여 준다. */
export function MergedVideoPlayer({ uri }: { uri: string }) {
  return (
    <video
      src={uri}
      controls
      playsInline
      style={{ width: '100%', height: '100%', backgroundColor: '#000', objectFit: 'contain' }}
    />
  );
}
