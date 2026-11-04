import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { authorizedImage } from './ui/SafeImage';

export interface NaturalSize {
  w: number;
  h: number;
  /** 실제 크기를 알아냈는지(아니면 정사각형으로 가정한 값) */
  known: boolean;
}

/** 사진의 원래 가로·세로(비율 계산용). URL 은 불러와서, 번들 자산은 바로 알아낸다. */
export function useNaturalSize(source?: string | number): NaturalSize {
  const [size, setSize] = useState<NaturalSize & { source?: string | number }>({ w: 1, h: 1, known: false });
  useEffect(() => {
    if (source === undefined) return;
    let alive = true;
    const done = (w: number, h: number) => {
      if (alive && w > 0 && h > 0) setSize({ w, h, known: true, source });
    };
    if (typeof source === 'string') Image.getSizeWithHeaders(source, authorizedImage(source).headers ?? {}, done, () => undefined);
    else {
      const r = Image.resolveAssetSource(source);
      if (r) void Promise.resolve().then(() => done(r.width, r.height));
    }
    return () => {
      alive = false;
    };
  }, [source]);
  return size.source === source ? size : { w: 1, h: 1, known: false };
}
