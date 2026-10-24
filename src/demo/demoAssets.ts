/**
 * 앱에 포함된 예시 이미지·영상. 인터넷 없이도 보이도록 모두 번들 자산(require)을 쓴다.
 * 파일은 scripts/build-demo-assets.mjs 가 도형으로 그린 "예시 일러스트"이며 실제 사진·영상이 아니다.
 */
export const DEMO_IMAGES = {
  cafe1: require('../../assets/demo/cafe-1.jpg') as number,
  cafe2: require('../../assets/demo/cafe-2.jpg') as number,
  cafe3: require('../../assets/demo/cafe-3.jpg') as number,
  cafe4: require('../../assets/demo/cafe-4.jpg') as number,
  forest1: require('../../assets/demo/forest-1.jpg') as number,
  forest2: require('../../assets/demo/forest-2.jpg') as number,
  forest3: require('../../assets/demo/forest-3.jpg') as number,
  food1: require('../../assets/demo/food-1.jpg') as number,
  food2: require('../../assets/demo/food-2.jpg') as number,
  food3: require('../../assets/demo/food-3.jpg') as number,
  videoCafePoster: require('../../assets/demo/video-cafe-poster.jpg') as number,
  videoForestPoster: require('../../assets/demo/video-forest-poster.jpg') as number,
};

export const DEMO_AVATARS = {
  me: require('../../assets/demo/avatar-me.jpg') as number,
  suah: require('../../assets/demo/avatar-suah.jpg') as number,
  doyun: require('../../assets/demo/avatar-doyun.jpg') as number,
  haeun: require('../../assets/demo/avatar-haeun.jpg') as number,
  jiho: require('../../assets/demo/avatar-jiho.jpg') as number,
};

/** 예시 영상. 길이(초)는 scripts/build-demo-assets.mjs 의 videos 정의와 같아야 한다. */
export const DEMO_VIDEOS = {
  cafe: { source: require('../../assets/demo/video-cafe.mp4') as number, seconds: 6 },
  forest: { source: require('../../assets/demo/video-forest.mp4') as number, seconds: 8 },
};
