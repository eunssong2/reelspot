"""
브이로그 배경 음악 "예시" 음원 20곡을 직접 합성해서 만든다(assets/music/*.wav).

외부 음원을 가져오지 않고 사인파·잡음으로 처음부터 만든 곡이라 저작권 문제가 없다(CC0, 자유롭게 사용 가능).
실제 서비스에서는 사용권이 확인된 음원으로 바꿔야 한다. 이 곡들은 프로토타입 시연용이다.

실행: python scripts/make_example_music.py          (numpy 필요, 20곡 생성)
      python scripts/make_example_music.py --ts     (앱의 곡 목록 TypeScript 코드를 출력)
"""
import sys
import wave
from pathlib import Path

import numpy as np

SR = 12000  # 용량을 줄이려고 12kHz 모노
OUT = Path(__file__).resolve().parent.parent / 'assets' / 'music'
rng = np.random.default_rng(7)


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def env(n: int, attack: float, decay: float) -> np.ndarray:
    """짧게 켜지고 서서히 사라지는 소리의 크기 곡선"""
    t = np.arange(n) / SR
    a = np.minimum(1.0, t / max(attack, 1e-4))
    return a * np.exp(-t / max(decay, 1e-4))


def pluck(midi: float, dur: float, vol: float, timbre: str = 'piano') -> np.ndarray:
    """악기 소리 하나. timbre 에 따라 배음과 사라지는 속도가 달라진다."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(midi)
    if timbre == 'bell':  # 맑은 종소리
        s = np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 5) + 0.3 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t * 9)
        return vol * 0.8 * s * env(n, 0.003, dur * 0.7)
    if timbre == 'pizz':  # 통통 튀는 짧은 소리
        s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
        return vol * s * env(n, 0.004, 0.09)
    if timbre == 'marimba':  # 마림바
        s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 20)
        return vol * s * env(n, 0.003, 0.22)
    if timbre == 'keys':  # 부드러운 건반(홀수 배음)
        s = np.sin(2 * np.pi * f * t) + np.sin(2 * np.pi * 3 * f * t) / 3 + np.sin(2 * np.pi * 5 * f * t) / 5
        return vol * 0.7 * s * env(n, 0.01, dur * 0.6)
    s = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4) + 0.15 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 7)
    return vol * s * env(n, 0.005, dur * 0.45)  # 피아노


def pad(midis: list, dur: float, vol: float) -> np.ndarray:
    """느리게 켜지고 꺼지는 받침 소리(화음)"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for m in midis:
        f = hz(m)
        s += np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.003 * t)
    swell = np.minimum(1.0, t / 0.6) * np.minimum(1.0, (dur - t) / 0.6)
    return vol * s / max(1, len(midis)) * swell


def kick(vol: float) -> np.ndarray:
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    f = 110 * np.exp(-t * 18) + 45
    return vol * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)


def hat(vol: float) -> np.ndarray:
    n = int(0.05 * SR)
    noise = np.diff(rng.standard_normal(n), prepend=0)  # 높은 소리만 남긴다
    return vol * noise * np.exp(-np.arange(n) / SR * 70)


def clap(vol: float = 0.16) -> np.ndarray:
    n = int(0.1 * SR)
    return vol * rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 35)


def place(buf: np.ndarray, snd: np.ndarray, at_sec: float) -> None:
    """소리를 넣는다. 끝이 곡 끝을 넘으면 처음으로 이어 붙여 반복해도 끊기지 않게 한다."""
    i = int(at_sec * SR)
    idx = (i + np.arange(len(snd))) % len(buf)
    np.add.at(buf, idx, snd)


KINDS = {
    'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'maj': [0, 4, 7], 'm': [0, 3, 7], '6': [0, 4, 7, 9],
    'sus': [0, 5, 7], 'add9': [0, 4, 7, 14], 'm9': [0, 3, 7, 14],
}
PATTERNS = {'up': [0, 1, 2, 3], 'broken': [0, 2, 1, 3, 2, 1], 'down': [3, 2, 1, 0], 'wide': [0, 2, 3, 2]}


def render(bpm: int, bars: int, prog: list, st: dict) -> np.ndarray:
    beat = 60.0 / bpm
    bar = beat * 4
    buf = np.zeros(int(bar * bars * SR))
    per = max(1, bars // len(prog))  # 화음 하나가 이어지는 마디 수
    pat = PATTERNS[st.get('pattern', 'up')]
    timbre = st.get('timbre', 'piano')
    for ci, (root, kind) in enumerate(prog):
        notes = [root + k for k in KINDS[kind]]
        start = ci * per * bar
        place(buf, pad([n - 12 for n in notes], per * bar + 0.3, st.get('pad', 0.12)), start)
        if st.get('step'):
            step = st['step'] * beat
            for k in range(int(per * bar / step)):
                n = notes[pat[k % len(pat)] % len(notes)] + (12 if (k // len(pat)) % 2 and st.get('octave', True) else 0)
                place(buf, pluck(n, step * st.get('ring', 2.2), st.get('pluck', 0.2), timbre), start + k * step)
        if st.get('melody'):
            for b in range(per):
                top = notes[(b + ci) % len(notes)] + 24
                place(buf, pluck(top, bar * 0.9, 0.15, st.get('melody_timbre', 'bell')), start + b * bar + beat * st['melody'])
        if st.get('bass'):  # 낮은 뿌리음
            for b in range(per):
                for q in st['bass']:
                    place(buf, pluck(root - 24, beat * 1.6, 0.3, 'keys'), start + b * bar + q * beat)
    for b in range(bars):
        t0 = b * bar
        for q in st.get('kick', []):
            place(buf, kick(st.get('kick_vol', 0.4)), t0 + q * beat)
        if st.get('hat'):
            for e in range(8):
                place(buf, hat(st.get('hat_vol', 0.06)), t0 + e * beat * 0.5 + beat * 0.25)
        for q in st.get('clap', []):
            place(buf, clap(), t0 + q * beat)
    peak = float(np.max(np.abs(buf))) or 1.0
    return buf / peak * 0.6


C, D, E, F, G, A, B = 60, 62, 64, 65, 67, 69, 71
Bb = 70
Cm, Dm, Em, Fm, Gm, Am = C, D, E, F, G, A

# (id, 이름, 설명, 분위기, bpm, 마디, 화음 진행, 스타일)
TRACKS = [
    # ---- 잔잔 ----
    ('calm', '잔잔한 오후', '느리고 포근한 피아노', '잔잔', 72, 8, [(C, 'maj7'), (A - 12, 'm7'), (F, 'maj7'), (G - 12, '6')], {'step': 0.5, 'pad': 0.14, 'pluck': 0.22}),
    ('dawn', '고요한 새벽', '맑은 종소리가 천천히', '잔잔', 60, 8, [(D, 'm9'), (Bb - 12, 'maj7'), (F, 'add9'), (C, 'sus')], {'step': 1.0, 'timbre': 'bell', 'pad': 0.16, 'pluck': 0.2, 'ring': 3.5}),
    ('sunbeam', '포근한 햇살', '따뜻한 건반 아르페지오', '잔잔', 76, 8, [(G, 'maj7'), (E - 12, 'm7'), (C, 'maj7'), (D, '6')], {'step': 0.5, 'timbre': 'keys', 'pattern': 'broken', 'pad': 0.12, 'pluck': 0.2, 'bass': [0]}),
    ('slow', '느린 산책길', '여유로운 걸음 속도', '잔잔', 66, 8, [(F, 'maj'), (C, 'sus'), (D, 'm7'), (Bb - 12, 'maj7')], {'step': 1.0, 'pad': 0.15, 'pluck': 0.22, 'melody': 1, 'kick': [0], 'kick_vol': 0.2}),
    # ---- 산뜻 ----
    ('walk', '산뜻한 산책', '가볍게 걷는 박자', '산뜻', 108, 8, [(C, 'maj'), (G - 12, 'maj'), (A - 12, 'm'), (F, 'maj')], {'step': 0.5, 'pad': 0.1, 'pluck': 0.2, 'kick': [0, 2], 'hat': True}),
    ('morning', '가벼운 아침', '눈 뜨자마자 상쾌하게', '산뜻', 100, 8, [(G, 'maj'), (D, 'maj'), (E - 12, 'm'), (C, 'maj')], {'step': 0.5, 'timbre': 'marimba', 'pattern': 'broken', 'pad': 0.08, 'pluck': 0.22, 'kick': [0, 2], 'kick_vol': 0.3}),
    ('breeze', '상쾌한 바람', '시원하게 스치는 소리', '산뜻', 112, 8, [(D, 'maj'), (A - 12, 'maj'), (B - 12, 'm'), (G - 12, 'maj')], {'step': 0.25, 'timbre': 'keys', 'pad': 0.08, 'pluck': 0.15, 'hat': True, 'kick': [0, 2]}),
    ('sky', '맑은 하늘', '구름 사이로 퍼지는 종소리', '산뜻', 96, 8, [(C, 'add9'), (G - 12, 'sus'), (A - 12, 'm7'), (F, 'maj7')], {'step': 0.5, 'timbre': 'bell', 'pad': 0.1, 'pluck': 0.2, 'melody': 2, 'hat': True, 'hat_vol': 0.04}),
    # ---- 감성 ----
    ('evening', '따뜻한 저녁', '천천히 흐르는 따뜻한 화음', '감성', 80, 8, [(A - 12, 'm'), (F, 'maj7'), (C, 'maj'), (G - 12, '6')], {'step': 1.0, 'pad': 0.16, 'pluck': 0.18, 'melody': 1, 'kick': [0], 'kick_vol': 0.25}),
    ('sunset', '노을빛', '붉게 물드는 시간', '감성', 70, 8, [(F, 'maj7'), (E, 'm7'), (D, 'm7'), (C, 'add9')], {'step': 0.5, 'timbre': 'keys', 'pattern': 'down', 'pad': 0.15, 'pluck': 0.2, 'melody': 1.5}),
    ('rain', '비 오는 창가', '차분한 빗소리 같은 리듬', '감성', 64, 8, [(A - 12, 'm9'), (F, 'maj7'), (G - 12, '6'), (E - 12, 'm7')], {'step': 0.5, 'timbre': 'pizz', 'pattern': 'broken', 'pad': 0.14, 'pluck': 0.25, 'hat': True, 'hat_vol': 0.03}),
    ('memory', '오래된 기억', '아련한 멜로디', '감성', 68, 8, [(D, 'm'), (Bb - 12, 'maj7'), (F, 'maj'), (A - 12, 'sus')], {'step': 1.0, 'timbre': 'bell', 'pad': 0.16, 'pluck': 0.2, 'melody': 0, 'bass': [0]}),
    # ---- 신나는 ----
    ('trip', '설레는 여행', '밝고 빠른 박자', '신나는', 120, 8, [(D, 'maj'), (A - 12, 'maj'), (B - 12, 'm'), (G - 12, 'maj')], {'step': 0.25, 'pad': 0.08, 'pluck': 0.17, 'kick': [0, 1, 2, 3], 'hat': True, 'clap': [1, 3]}),
    ('drive', '신나는 드라이브', '창문 열고 달리는 기분', '신나는', 124, 8, [(E, 'm'), (C, 'maj'), (G, 'maj'), (D, 'maj')], {'step': 0.25, 'timbre': 'keys', 'pad': 0.08, 'pluck': 0.15, 'kick': [0, 1, 2, 3], 'hat': True, 'clap': [1, 3], 'bass': [0, 2]}),
    ('party', '파티 타임', '통통 튀는 비트', '신나는', 128, 8, [(A - 12, 'm'), (F, 'maj'), (C, 'maj'), (G, 'maj')], {'step': 0.5, 'timbre': 'marimba', 'pad': 0.07, 'pluck': 0.22, 'kick': [0, 1, 2, 3], 'hat': True, 'clap': [1, 3], 'bass': [0, 1, 2, 3]}),
    ('train', '달리는 기차', '쉬지 않는 규칙적인 리듬', '신나는', 116, 8, [(G, 'maj'), (C, 'maj'), (D, 'maj'), (G, 'maj')], {'step': 0.25, 'timbre': 'pizz', 'pad': 0.06, 'pluck': 0.2, 'kick': [0, 2], 'hat': True, 'hat_vol': 0.08, 'clap': [1, 3]}),
    # ---- 귀여운 ----
    ('hop', '통통 튀는 하루', '발걸음이 가벼워요', '귀여운', 104, 8, [(C, 'maj'), (F, 'maj'), (G, 'maj'), (C, 'maj')], {'step': 0.5, 'timbre': 'pizz', 'pattern': 'broken', 'pad': 0.07, 'pluck': 0.26, 'kick': [0, 2], 'kick_vol': 0.25}),
    ('playful', '장난스러운 오후', '살짝 장난기 있는 멜로디', '귀여운', 112, 8, [(G, 'maj'), (E - 12, 'm'), (A - 12, 'm'), (D, 'maj')], {'step': 0.5, 'timbre': 'marimba', 'pattern': 'wide', 'pad': 0.07, 'pluck': 0.24, 'hat': True, 'hat_vol': 0.04}),
    ('picnic', '소풍날', '돗자리 펴고 도시락', '귀여운', 92, 8, [(F, 'maj'), (C, 'maj'), (D, 'm'), (Bb - 12, 'maj')], {'step': 0.5, 'timbre': 'keys', 'pattern': 'broken', 'pad': 0.1, 'pluck': 0.2, 'melody': 2, 'bass': [0, 2]}),
    ('snack', '간식 시간', '달콤하고 가벼운 종소리', '귀여운', 100, 8, [(C, 'add9'), (A - 12, 'm7'), (F, 'maj7'), (G, 'sus')], {'step': 0.5, 'timbre': 'bell', 'pattern': 'wide', 'pad': 0.08, 'pluck': 0.22, 'kick': [0], 'kick_vol': 0.2, 'hat': True, 'hat_vol': 0.03}),
]


def save(name: str, buf: np.ndarray) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(buf, -1, 1) * 32767).astype('<i2')
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f'{name}.wav  {len(buf) / SR:.1f}s  {len(pcm) * 2 // 1024}KB')


def ts_code() -> str:
    """앱의 곡 목록(src/prototype/vlog/musicTracks.ts)에 들어갈 코드"""
    rows = [f"  {{ id: '{i}', label: '{label}', desc: '{desc}', mood: '{mood}', source: require('../../../assets/music/{i}.wav') }}," for i, label, desc, mood, *_ in TRACKS]
    return '\n'.join(rows)


if __name__ == '__main__':
    if '--ts' in sys.argv:
        print(ts_code())
    else:
        for tid, _label, _desc, _mood, bpm, bars, prog, style in TRACKS:
            save(tid, render(bpm, bars, prog, style))
