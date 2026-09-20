/**
 * 분할 화면 템플릿.
 * 칸 하나가 스팟원 한 명의 기록이라, 칸 수 = 스팟원 정원이다.
 * 좌표는 0~1 비율이라 어떤 크기로 그려도 같은 배치가 나온다.
 */
export type LayoutPane = { x: number; y: number; w: number; h: number };

export type LayoutTemplate = {
  id: string;
  name: string;
  panes: LayoutPane[];
};

const pane = (x: number, y: number, w: number, h: number): LayoutPane => ({ x, y, w, h });

export const LAYOUTS: LayoutTemplate[] = [
  // 1명
  { id: 'single', name: '한 화면', panes: [pane(0, 0, 1, 1)] },

  // 2명
  { id: 'split-v', name: '좌우 2분할', panes: [pane(0, 0, 0.5, 1), pane(0.5, 0, 0.5, 1)] },
  { id: 'split-h', name: '위아래 2분할', panes: [pane(0, 0, 1, 0.5), pane(0, 0.5, 1, 0.5)] },

  // 3명
  {
    id: 'triple-v',
    name: '세로 3분할',
    panes: [pane(0, 0, 1 / 3, 1), pane(1 / 3, 0, 1 / 3, 1), pane(2 / 3, 0, 1 / 3, 1)],
  },
  {
    id: 'one-top-two',
    name: '위 하나 · 아래 둘',
    panes: [pane(0, 0, 1, 0.5), pane(0, 0.5, 0.5, 0.5), pane(0.5, 0.5, 0.5, 0.5)],
  },
  {
    id: 'two-top-one',
    name: '위 둘 · 아래 하나',
    panes: [pane(0, 0, 0.5, 0.5), pane(0.5, 0, 0.5, 0.5), pane(0, 0.5, 1, 0.5)],
  },

  // 4명
  {
    id: 'grid-2x2',
    name: '네 칸 격자',
    panes: [
      pane(0, 0, 0.5, 0.5),
      pane(0.5, 0, 0.5, 0.5),
      pane(0, 0.5, 0.5, 0.5),
      pane(0.5, 0.5, 0.5, 0.5),
    ],
  },
  {
    id: 'one-top-three',
    name: '위 하나 · 아래 셋',
    panes: [
      pane(0, 0, 1, 0.55),
      pane(0, 0.55, 1 / 3, 0.45),
      pane(1 / 3, 0.55, 1 / 3, 0.45),
      pane(2 / 3, 0.55, 1 / 3, 0.45),
    ],
  },
  {
    id: 'left-one-right-three',
    name: '왼쪽 크게 · 오른쪽 셋',
    panes: [
      pane(0, 0, 0.6, 1),
      pane(0.6, 0, 0.4, 1 / 3),
      pane(0.6, 1 / 3, 0.4, 1 / 3),
      pane(0.6, 2 / 3, 0.4, 1 / 3),
    ],
  },

  // 5명
  {
    id: 'one-top-four',
    name: '위 하나 · 아래 넷',
    panes: [
      pane(0, 0, 1, 0.55),
      pane(0, 0.55, 0.25, 0.45),
      pane(0.25, 0.55, 0.25, 0.45),
      pane(0.5, 0.55, 0.25, 0.45),
      pane(0.75, 0.55, 0.25, 0.45),
    ],
  },
  {
    id: 'two-top-three',
    name: '위 둘 · 아래 셋',
    panes: [
      pane(0, 0, 0.5, 0.5),
      pane(0.5, 0, 0.5, 0.5),
      pane(0, 0.5, 1 / 3, 0.5),
      pane(1 / 3, 0.5, 1 / 3, 0.5),
      pane(2 / 3, 0.5, 1 / 3, 0.5),
    ],
  },
  {
    id: 'left-one-right-four',
    name: '왼쪽 크게 · 오른쪽 넷',
    panes: [
      pane(0, 0, 0.6, 1),
      pane(0.6, 0, 0.4, 0.25),
      pane(0.6, 0.25, 0.4, 0.25),
      pane(0.6, 0.5, 0.4, 0.25),
      pane(0.6, 0.75, 0.4, 0.25),
    ],
  },
];

export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 5;

export const layoutsFor = (capacity: number) =>
  LAYOUTS.filter((layout) => layout.panes.length === capacity);

export const findLayout = (id: string) => LAYOUTS.find((layout) => layout.id === id) ?? LAYOUTS[0];

/** 정원이 바뀌면 칸 수가 안 맞는 배치는 그 정원의 첫 배치로 갈아탄다. */
export function layoutForCapacity(capacity: number, currentId: string) {
  const options = layoutsFor(capacity);
  return options.some((layout) => layout.id === currentId) ? currentId : options[0].id;
}
