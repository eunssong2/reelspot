import type { MusicId } from './model';

/**
 * 배경 음악 예시 곡 20곡. assets/music 의 곡은 scripts/make_example_music.py 로 직접 합성한 것이라
 * 저작권 문제가 없다(CC0). 시연용이며, 서비스에서는 사용권이 확인된 음원으로 바꿔야 한다.
 * 목록은 같은 스크립트의 `--ts` 출력으로 만든다.
 */
export interface MusicTrack {
  id: string;
  label: string;
  desc: string;
  /** 분위기 묶음(선택 화면의 탭) */
  mood: string;
  source: number;
}

/** 분위기 묶음 순서 */
export const MUSIC_MOODS = ['잔잔', '산뜻', '감성', '신나는', '귀여운'] as const;

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'calm', label: '잔잔한 오후', desc: '느리고 포근한 피아노', mood: '잔잔', source: require('../../../assets/music/calm.wav') },
  { id: 'dawn', label: '고요한 새벽', desc: '맑은 종소리가 천천히', mood: '잔잔', source: require('../../../assets/music/dawn.wav') },
  { id: 'sunbeam', label: '포근한 햇살', desc: '따뜻한 건반 아르페지오', mood: '잔잔', source: require('../../../assets/music/sunbeam.wav') },
  { id: 'slow', label: '느린 산책길', desc: '여유로운 걸음 속도', mood: '잔잔', source: require('../../../assets/music/slow.wav') },
  { id: 'walk', label: '산뜻한 산책', desc: '가볍게 걷는 박자', mood: '산뜻', source: require('../../../assets/music/walk.wav') },
  { id: 'morning', label: '가벼운 아침', desc: '눈 뜨자마자 상쾌하게', mood: '산뜻', source: require('../../../assets/music/morning.wav') },
  { id: 'breeze', label: '상쾌한 바람', desc: '시원하게 스치는 소리', mood: '산뜻', source: require('../../../assets/music/breeze.wav') },
  { id: 'sky', label: '맑은 하늘', desc: '구름 사이로 퍼지는 종소리', mood: '산뜻', source: require('../../../assets/music/sky.wav') },
  { id: 'evening', label: '따뜻한 저녁', desc: '천천히 흐르는 따뜻한 화음', mood: '감성', source: require('../../../assets/music/evening.wav') },
  { id: 'sunset', label: '노을빛', desc: '붉게 물드는 시간', mood: '감성', source: require('../../../assets/music/sunset.wav') },
  { id: 'rain', label: '비 오는 창가', desc: '차분한 빗소리 같은 리듬', mood: '감성', source: require('../../../assets/music/rain.wav') },
  { id: 'memory', label: '오래된 기억', desc: '아련한 멜로디', mood: '감성', source: require('../../../assets/music/memory.wav') },
  { id: 'trip', label: '설레는 여행', desc: '밝고 빠른 박자', mood: '신나는', source: require('../../../assets/music/trip.wav') },
  { id: 'drive', label: '신나는 드라이브', desc: '창문 열고 달리는 기분', mood: '신나는', source: require('../../../assets/music/drive.wav') },
  { id: 'party', label: '파티 타임', desc: '통통 튀는 비트', mood: '신나는', source: require('../../../assets/music/party.wav') },
  { id: 'train', label: '달리는 기차', desc: '쉬지 않는 규칙적인 리듬', mood: '신나는', source: require('../../../assets/music/train.wav') },
  { id: 'hop', label: '통통 튀는 하루', desc: '발걸음이 가벼워요', mood: '귀여운', source: require('../../../assets/music/hop.wav') },
  { id: 'playful', label: '장난스러운 오후', desc: '살짝 장난기 있는 멜로디', mood: '귀여운', source: require('../../../assets/music/playful.wav') },
  { id: 'picnic', label: '소풍날', desc: '돗자리 펴고 도시락', mood: '귀여운', source: require('../../../assets/music/picnic.wav') },
  { id: 'snack', label: '간식 시간', desc: '달콤하고 가벼운 종소리', mood: '귀여운', source: require('../../../assets/music/snack.wav') },
];

export const musicLabel = (id?: MusicId): string => (id && id !== 'none' ? (MUSIC_TRACKS.find((t) => t.id === id)?.label ?? '없음') : '없음');
