import { useFonts } from 'expo-font';

/**
 * 자막에 쓰는 글꼴 파일. 키는 model.ts 의 FontPreset.family 와 같아야 한다
 * (스타일에서 fontFamily 로 이 이름을 그대로 쓴다).
 *
 * 이 파일은 scripts/build-caption-fonts.py 가 만든다. 직접 고치지 말고 스크립트를 다시 돌린다.
 *
 * 모두 SIL Open Font License 1.1 이고, 라이선스 원문·원본 이름은 assets/fonts/README.md 에 적어 두었다.
 * 용량을 줄이려고 한글 2,350자(KS X 1001 완성형)와 영문·숫자·기호만 남긴 서브셋이다.
 * 서브셋은 OFL 상 '수정본'이라, 예약명(Reserved Font Name)이 있는 글꼴은 그 이름을 쓰지 않도록
 * 글꼴 안의 이름을 중립적으로 바꿨다(저작권·라이선스 항목은 그대로 두었다).
 */
export const VLOG_FONT_ASSETS = {
  DoHyeon: require('../../../assets/fonts/DoHyeon.ttf'),
  BlackHanSans: require('../../../assets/fonts/BlackHanSans.ttf'),
  GasoekOne: require('../../../assets/fonts/GasoekOne.ttf'),
  GothicA1: require('../../../assets/fonts/GothicA1.ttf'),
  GothicKR: require('../../../assets/fonts/GothicKR.ttf'),
  ModernKR: require('../../../assets/fonts/ModernKR.ttf'),
  Sunflower: require('../../../assets/fonts/Sunflower.ttf'),
  Stylish: require('../../../assets/fonts/Stylish.ttf'),
  GowunDodum: require('../../../assets/fonts/GowunDodum.ttf'),
  IslandGothic: require('../../../assets/fonts/IslandGothic.ttf'),
  MyeongjoKR: require('../../../assets/fonts/MyeongjoKR.ttf'),
  SongMyung: require('../../../assets/fonts/SongMyung.ttf'),
  GowunBatang: require('../../../assets/fonts/GowunBatang.ttf'),
  IslandMyeongjo: require('../../../assets/fonts/IslandMyeongjo.ttf'),
  Diphylleia: require('../../../assets/fonts/Diphylleia.ttf'),
  Gaegu: require('../../../assets/fonts/Gaegu.ttf'),
  PenKR: require('../../../assets/fonts/PenKR.ttf'),
  BrushKR: require('../../../assets/fonts/BrushKR.ttf'),
  YeonSung: require('../../../assets/fonts/YeonSung.ttf'),
  IslandBrush: require('../../../assets/fonts/IslandBrush.ttf'),
  Dokdo: require('../../../assets/fonts/Dokdo.ttf'),
  EastSeaDokdo: require('../../../assets/fonts/EastSeaDokdo.ttf'),
  HiMelody: require('../../../assets/fonts/HiMelody.ttf'),
  KirangHaerang: require('../../../assets/fonts/KirangHaerang.ttf'),
  PoorStory: require('../../../assets/fonts/PoorStory.ttf'),
  SingleDay: require('../../../assets/fonts/SingleDay.ttf'),
  GamjaFlower: require('../../../assets/fonts/GamjaFlower.ttf'),
  CuteFont: require('../../../assets/fonts/CuteFont.ttf'),
  Dongle: require('../../../assets/fonts/Dongle.ttf'),
  Jua: require('../../../assets/fonts/Jua.ttf'),
  BagelFatOne: require('../../../assets/fonts/BagelFatOne.ttf'),
  MoiraiOne: require('../../../assets/fonts/MoiraiOne.ttf'),
  Gugi: require('../../../assets/fonts/Gugi.ttf'),
  Orbit: require('../../../assets/fonts/Orbit.ttf'),
};

/**
 * 자막 글꼴을 올린다. 다 올라오기 전에는 false 가 돌아가며, 그동안 자막은 기기 기본 글꼴로 보인다
 * (글꼴을 기다리며 화면을 멈추지는 않는다 — 자막 말고는 이 글꼴이 필요 없다).
 *
 * 앱(iOS·Android)에서는 앱 안에 들어 있는 파일을 읽으므로 내려받기가 없다.
 * 웹에서는 글꼴 파일을 가져오는데, 프로토타입은 같은 기기에서 띄워 보므로 바로 올라온다.
 */
export function useVlogFonts(): boolean {
  const [loaded] = useFonts(VLOG_FONT_ASSETS);
  return loaded;
}
