export type Group = { id: string; name: string };
export type PlaceRecordItem = { id: string; kind: 'photo' | 'video'; imageUrl: string; videoSource?: string; caption?: string; durationLabel?: string };
export type ItineraryPlace = { id: string; name: string; address?: string; imageUrl?: string; visitId?: string; visitTime?: string };
export type Rect = [number, number, number, number];

export interface Template {
  id: string;
  cuts: number;
  label: string;
  rects: Rect[];
}

const cols = (n: number): Rect[] => Array.from({ length: n }, (_, i) => [i / n, 0, 1 / n, 1]);
const rows = (n: number): Rect[] => Array.from({ length: n }, (_, i) => [0, i / n, 1, 1 / n]);

export const MAX_CUTS = 5;
export const CUT_OPTIONS = [1, 2, 3, 4, 5];

export const TEMPLATES: Template[] = [
  { id: 'c1-full', cuts: 1, label: '전체', rects: [[0, 0, 1, 1]] },
  { id: 'c1-frame', cuts: 1, label: '프레임', rects: [[0.12, 0.12, 0.76, 0.76]] },

  { id: 'c2-cols', cuts: 2, label: '좌우 2분할', rects: cols(2) },
  { id: 'c2-rows', cuts: 2, label: '상하 2분할', rects: rows(2) },
  { id: 'c2-wide', cuts: 2, label: '좌측 강조', rects: [[0, 0, 0.62, 1], [0.62, 0, 0.38, 1]] },

  { id: 'c3-cols', cuts: 3, label: '세로 3분할', rects: cols(3) },
  { id: 'c3-rows', cuts: 3, label: '가로 3분할', rects: rows(3) },
  { id: 'c3-big', cuts: 3, label: '좌측 크게', rects: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },

  { id: 'c4-grid', cuts: 4, label: '2×2 격자', rects: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: 'c4-cols', cuts: 4, label: '세로 4분할', rects: cols(4) },
  { id: 'c4-top', cuts: 4, label: '상단 크게', rects: [[0, 0, 1, 0.55], [0, 0.55, 1 / 3, 0.45], [1 / 3, 0.55, 1 / 3, 0.45], [2 / 3, 0.55, 1 / 3, 0.45]] },

  { id: 'c5-mix', cuts: 5, label: '2+3 배열', rects: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5]] },
  { id: 'c5-cols', cuts: 5, label: '세로 5분할', rects: cols(5) },
  { id: 'c5-big', cuts: 5, label: '좌측 크게', rects: [[0, 0, 0.5, 1], [0.5, 0, 0.25, 0.5], [0.75, 0, 0.25, 0.5], [0.5, 0.5, 0.25, 0.5], [0.75, 0.5, 0.25, 0.5]] },
];

export const templatesFor = (cuts: number): Template[] => TEMPLATES.filter((t) => t.cuts === cuts);
