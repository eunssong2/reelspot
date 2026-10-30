import * as ImagePicker from 'expo-image-picker';

/** 프로필 사진 data URI 최대 길이. AsyncStorage(Android)는 값 하나가 2MB 를 넘으면 읽지 못할 수 있어 제한한다. */
const AVATAR_MAX_LENGTH = 1_400_000;

/**
 * 앨범에서 사진을 골라 주어진 비율로 잘라 data URI 로 돌려준다.
 * 사용자가 취소하면 null, 실패하면 { error } 로 안내 문구를 돌려준다.
 */
export async function pickPhoto(aspect: [number, number]): Promise<{ uri: string } | { error: string } | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.4,
      base64: true,
    });
    if (result.canceled || result.assets.length === 0) return null;
    const asset = result.assets[0];
    if (!asset.base64) return { error: '사진을 불러오지 못했어요. 다른 사진을 골라 보세요.' };
    const uri = 'data:' + (asset.mimeType ?? 'image/jpeg') + ';base64,' + asset.base64;
    if (uri.length > AVATAR_MAX_LENGTH) return { error: '사진 용량이 너무 커요. 더 작은 사진을 골라 보세요.' };
    return { uri };
  } catch {
    return { error: '사진을 열지 못했어요. 사진 접근 권한을 확인해 주세요.' };
  }
}

/** 프로필 사진: 정사각형. */
export const pickProfilePhoto = () => pickPhoto([1, 1]);
