import { Modal, View, Text, Pressable } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeImage, authorizedImage } from './SafeImage';
import type { PlaceRecordItem } from '../types';
export interface ViewerTarget { item: PlaceRecordItem; author: string; time: string }
function Video({ uri }: { uri: string }) {
  const player = useVideoPlayer(authorizedImage(uri), (p) => p.play());
  return <VideoView player={player} style={{ flex: 1 }} nativeControls />;
}
export function MediaViewerModal({ target, onClose, action }: { target: ViewerTarget | null; onClose: () => void; action?: { label: string; onPress: () => void } }) {
  return <Modal visible={!!target} onRequestClose={onClose}><SafeAreaView style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
    <Pressable accessibilityRole="button" onPress={onClose}><Text style={{ padding: 16 }}>닫기</Text></Pressable>
    {target && <><View style={{ flex: 1 }}>{target.item.videoSource ? <Video uri={target.item.videoSource} /> : <SafeImage source={target.item.imageUrl} style={{ flex: 1 }} resizeMode="contain" />}</View><Text>{target.author} · {target.time}</Text></>}
    {action && <Pressable accessibilityRole="button" onPress={action.onPress}><Text style={{ padding: 20 }}>{action.label}</Text></Pressable>}
  </SafeAreaView></Modal>;
}
