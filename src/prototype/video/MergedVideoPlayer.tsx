import { Text } from 'react-native';

/** 네이티브에서는 합치기 자체가 없으므로 재생기도 안내 문구만 둔다(mergeVideos.ts 참고). */
export function MergedVideoPlayer(_props: { uri: string }) {
  return <Text>미리보기는 웹에서만 볼 수 있어요</Text>;
}
