"""자막 글씨체 만들기: 받기 → 한글만 남기기(서브셋) → 예약명 바꾸기 → 크기 보정값 재기 → 코드 생성.

google/fonts(SIL OFL) 에서 받아 한글 2,350자(KS X 1001 완성형)만 남겨 용량을 1/10 로 줄인다.
서브셋은 OFL 상 '수정본'이므로, 예약명(Reserved Font Name)이 있는 글꼴은 내부 이름을 바꾼다(OFL 3항).
"""
import json
import pathlib
import subprocess
import sys

BASE = 'https://github.com/google/fonts/raw/main/ofl'
OUT = pathlib.Path('assets/fonts')
WORK = pathlib.Path('/tmp/fontwork')

# (id, 화면에 쓰는 이름, 설명, 묶음, 앱에서 쓰는 글꼴 이름, google/fonts 경로, 예약명 있음)
# 예약명이 있는 글꼴은 그 이름을 쓰지 않는 중립적인 이름으로 바꾼다.
FONTS = [
    # ---- 고딕 ----
    ('gothic',       '기기 기본',   '휴대폰에 들어 있는 기본 글씨',   '고딕',   None,             None, False),
    ('gothicTitle',  '제목 고딕',   '또박또박한 제목용',             '고딕',   'DoHyeon',        'dohyeon/DoHyeon-Regular.ttf', False),
    ('bold',         '임팩트',      '굵고 꽉 차는 제목 느낌',         '고딕',   'BlackHanSans',   'blackhansans/BlackHanSans-Regular.ttf', False),
    ('boldFat',      '초굵은체',    '화면을 꽉 채우는 가장 굵은 글씨', '고딕',   'GasoekOne',      'gasoekone/GasoekOne-Regular.ttf', False),
    ('gothicSharp',  '선명 고딕',   '각이 또렷해 잘 읽혀요',          '고딕',   'GothicA1',       'gothica1/GothicA1-Bold.ttf', False),
    ('gothicNeat',   '단정 고딕',   '군더더기 없이 단정해요',         '고딕',   'GothicKR',       'nanumgothic/NanumGothic-Bold.ttf', True),
    ('gothicModern', '모던 고딕',   '깔끔하고 요즘 느낌',            '고딕',   'ModernKR',       'ibmplexsanskr/IBMPlexSansKR-SemiBold.ttf', True),
    ('gothicSoft',   '산뜻 고딕',   '가볍고 산뜻해요',               '고딕',   'Sunflower',      'sunflower/Sunflower-Bold.ttf', False),
    ('gothicThin',   '얇은 고딕',   '가늘고 차분해요',               '고딕',   'Stylish',        'stylish/Stylish-Regular.ttf', False),
    ('gothicPlain',  '담백 고딕',   '담백하고 조용한 느낌',           '고딕',   'GowunDodum',     'gowundodum/GowunDodum-Regular.ttf', False),
    ('gothicIsland', '섬 고딕',     '여행지 안내판 같은 글씨',        '고딕',   'IslandGothic',   'jejugothic/JejuGothic-Regular.ttf', True),
    # ---- 명조 ----
    ('serif',        '명조체',      '차분하고 담백한 느낌',           '명조',   'MyeongjoKR',     'nanummyeongjo/NanumMyeongjo-Bold.ttf', True),
    ('serifSong',    '옛 명조',     '옛 책에서 본 듯한 글씨',         '명조',   'SongMyung',      'songmyung/SongMyung-Regular.ttf', False),
    ('serifBatang',  '고운 바탕',   '부드럽고 단정한 바탕체',         '명조',   'GowunBatang',    'gowunbatang/GowunBatang-Bold.ttf', False),
    ('serifIsland',  '섬 명조',     '여행 기록에 잘 맞는 바탕체',      '명조',   'IslandMyeongjo', 'jejumyeongjo/JejuMyeongjo-Regular.ttf', True),
    ('serifClassic', '고전체',      '장식 있는 고전 느낌',            '명조',   'Diphylleia',     'diphylleia/Diphylleia-Regular.ttf', False),
    # ---- 손글씨 ----
    ('hand',         '손글씨',      '공책에 적은 듯한 손글씨',        '손글씨', 'Gaegu',          'gaegu/Gaegu-Bold.ttf', False),
    ('pen',          '펜글씨',      '사인펜으로 쓴 여행 일기',        '손글씨', 'PenKR',          'nanumpenscript/NanumPenScript-Regular.ttf', True),
    ('brush',        '붓글씨',      '붓으로 쓱 쓴 느낌',             '손글씨', 'BrushKR',        'nanumbrushscript/NanumBrushScript-Regular.ttf', True),
    ('brushYeon',    '먹붓체',      '진한 먹으로 쓴 붓글씨',          '손글씨', 'YeonSung',       'yeonsung/YeonSung-Regular.ttf', False),
    ('brushIsland',  '섬 붓글씨',   '거친 붓 자국이 남는 글씨',       '손글씨', 'IslandBrush',    'jejuhallasan/JejuHallasan-Regular.ttf', True),
    ('handRough',    '거친 손글씨', '빠르게 휘갈긴 손글씨',           '손글씨', 'Dokdo',          'dokdo/Dokdo-Regular.ttf', False),
    ('handThin',     '가는 손글씨', '얇은 펜으로 쓴 손글씨',          '손글씨', 'EastSeaDokdo',   'eastseadokdo/EastSeaDokdo-Regular.ttf', False),
    ('handMelody',   '또박 손글씨', '또박또박 쓴 둥근 손글씨',        '손글씨', 'HiMelody',       'himelody/HiMelody-Regular.ttf', False),
    ('handKirang',   '옛 간판체',   '옛 간판에서 본 듯한 글씨',       '손글씨', 'KirangHaerang',  'kiranghaerang/KirangHaerang-Regular.ttf', False),
    ('handStory',    '동화 손글씨', '동화책에 적힌 듯한 글씨',        '손글씨', 'PoorStory',      'poorstory/PoorStory-Regular.ttf', False),
    ('handDay',      '하루 손글씨', '일기장에 적은 하루',            '손글씨', 'SingleDay',      'singleday/SingleDay-Regular.ttf', False),
    ('handFlower',   '꽃잎 손글씨', '동글동글 귀여운 손글씨',         '손글씨', 'GamjaFlower',    'gamjaflower/GamjaFlower-Regular.ttf', False),
    ('handCute',     '아기 손글씨', '아이가 쓴 듯 작고 귀여워요',      '손글씨', 'CuteFont',       'cutefont/CuteFont-Regular.ttf', False),
    ('handDongle',   '동글 손글씨', '길쭉하고 동글한 손글씨',         '손글씨', 'Dongle',         'dongle/Dongle-Bold.ttf', False),
    # ---- 개성 ----
    ('round',        '둥근체',      '동글동글 가볍고 친근해요',        '개성',   'Jua',            'jua/Jua-Regular.ttf', False),
    ('quirkBagel',   '통통체',      '통통하고 장난스러워요',          '개성',   'BagelFatOne',    'bagelfatone/BagelFatOne-Regular.ttf', False),
    ('quirkMoirai',  '또렷체',      '굵은 테두리로 또렷해요',         '개성',   'MoiraiOne',      'moiraione/MoiraiOne-Regular.ttf', False),
    ('quirkGugi',    '각진체',      '각지고 개성 있어요',            '개성',   'Gugi',           'gugi/Gugi-Regular.ttf', False),
    ('quirkOrbit',   '미래체',      '선으로 그린 미래 느낌',          '개성',   'Orbit',          'orbit/Orbit-Regular.ttf', False),
]

# 남길 글자: 한글 2,350자(KS X 1001 완성형) + 호환 자모 + ASCII + 자주 쓰는 기호
EXTRA_UNICODES = 'U+0020-007E,U+00A0-00FF,U+3131-3163,U+2018-201D,U+2026,U+00B7,U+2013-2014,U+FF01-FF60,U+20A9,U+2605-2606,U+2661'
# 글씨체마다 같은 크기에서 보이는 덩치가 다르다. '한' 글자의 실제 높이를 기기 기본 글꼴에 맞춘다.
TARGET_INK = 0.874


def ks_x_1001() -> str:
    out = []
    for c in range(0xAC00, 0xD7A4):
        b = chr(c).encode('cp949')
        if len(b) == 2 and 0xB0 <= b[0] <= 0xC8 and 0xA1 <= b[1] <= 0xFE:
            out.append(chr(c))
    assert len(out) == 2350, len(out)
    return ''.join(out)


def fetch(url: str, dest: pathlib.Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    # python 의 인증서 저장소가 비어 있을 수 있어 curl 로 받는다.
    subprocess.run(['curl', '-sSL', '--fail', '-o', str(dest), url], check=True, capture_output=True)
    assert dest.stat().st_size > 1000, f'받지 못함: {url}'


def ink_height(path: pathlib.Path) -> float:
    """'한' 글자가 글씨 크기(em) 안에서 실제로 차지하는 높이 비율."""
    from fontTools.ttLib import TTFont
    font = TTFont(str(path))
    upem = font['head'].unitsPerEm
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    best = 0.0
    for ch in '한글가':
        name = cmap.get(ord(ch))
        if not name:
            continue
        from fontTools.pens.boundsPen import BoundsPen
        pen = BoundsPen(glyphs)
        glyphs[name].draw(pen)
        if pen.bounds:
            best = max(best, (pen.bounds[3] - pen.bounds[1]) / upem)
    font.close()
    return best


def rename(path: pathlib.Path, family: str) -> None:
    """예약명을 쓰지 않도록 글꼴 안의 이름을 바꾼다(저작권·라이선스 항목은 그대로 둔다)."""
    from fontTools.ttLib import TTFont
    font = TTFont(str(path))
    name = font['name']
    for rec in list(name.names):
        if rec.nameID in (1, 3, 4, 6, 16, 18, 21):
            value = family if rec.nameID != 3 else f'{family};subset'
            name.setName(value, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    font.save(str(path))
    font.close()


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    (WORK / 'ks.txt').write_text(ks_x_1001(), encoding='utf-8')

    # 이전 글꼴·라이선스는 지우고 새로 깐다(README 는 아래에서 다시 만든다).
    for old in OUT.glob('*'):
        old.unlink()

    rows = []
    total = 0
    for fid, label, desc, group, family, src, rfn in FONTS:
        if src is None:
            rows.append({'id': fid, 'label': label, 'desc': desc, 'group': group, 'family': None, 'scale': 1.0, 'src': None, 'rfn': False, 'size': 0})
            continue
        folder = src.split('/')[0]
        raw = WORK / pathlib.PurePath(src).name
        fetch(f'{BASE}/{src}', raw)
        lic = WORK / f'{folder}-OFL.txt'
        fetch(f'{BASE}/{folder}/OFL.txt', lic)

        out_ttf = OUT / f'{family}.ttf'
        cmd = [
            sys.executable, '-I', '-m', 'fontTools.subset', str(raw),
            f'--text-file={WORK / "ks.txt"}',
            f'--unicodes={EXTRA_UNICODES}',
            '--layout-features=*', '--no-hinting', '--drop-tables+=DSIG',
            '--name-IDs=0,1,2,3,4,5,6,13,14,16,17',
            f'--output-file={out_ttf}',
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        if rfn:
            rename(out_ttf, family)
        (OUT / f'{family}-OFL.txt').write_bytes(lic.read_bytes())

        ink = ink_height(out_ttf)
        scale = round(min(2.0, max(0.75, TARGET_INK / ink)), 2) if ink else 1.0
        size = out_ttf.stat().st_size
        total += size
        rows.append({'id': fid, 'label': label, 'desc': desc, 'group': group, 'family': family,
                     'scale': scale, 'src': src, 'rfn': rfn, 'size': size, 'ink': round(ink, 3)})
        print(f'{label:12} {family:16} {size/1024:7.0f} KB  ink {ink:.3f} → scale {scale}')

    print(f'\n글씨체 {len(rows)}종 · 파일 {sum(1 for r in rows if r["family"])}개 · 합계 {total/1048576:.1f} MB')
    (WORK / 'rows.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
    emit(rows)


README_TEMPLATE = """# 자막 글꼴

브이로그 자막에 쓰는 글꼴 {total_count}종입니다. '기기 기본'만 파일이 없고(휴대폰 글꼴을 그대로 씁니다)
나머지 {file_count}종은 이 폴더의 파일을 씁니다.

전부 [google/fonts](https://github.com/google/fonts) 에서 받은 **SIL Open Font License 1.1** 글꼴이라
상업 이용·앱 내 포함이 가능하며, 각 글꼴의 라이선스 원문을 `<이름>-OFL.txt` 로 함께 두었습니다.

## 용량을 줄인 방법

원본을 그대로 넣으면 {file_count}개가 230MB 가 넘습니다. 그래서 자막에 쓰이지 않는 글자(한자·가나·라틴 확장)를
덜어내고 **한글 2,350자(KS X 1001 완성형) + 영문·숫자·기호**만 남겼습니다. 덕분에 합계 **{total_mb}MB** 입니다.

2,350자에 없는 드문 음절(예: 뷁, 똠)은 그 글자만 기기 기본 글꼴로 보입니다. 글자가 사라지지는 않습니다.

## 예약명(Reserved Font Name) 처리

서브셋은 OFL 에서 말하는 '수정본'입니다. OFL 3항은 수정본이 예약명을 쓰지 못하게 하므로,
예약명이 있는 글꼴(나눔 계열·IBM Plex·제주 계열)은 **글꼴 안의 이름을 중립적인 이름으로 바꿨습니다**
(`나눔손글씨 펜` → `PenKR`). 저작권·라이선스 항목은 원본 그대로 두었고, 원본 이름은 아래 표에 적어 두었습니다.
화면에 보여 주는 이름도 예약명을 쓰지 않습니다(`펜글씨`).

## 글꼴 목록

| 묶음 | 화면 이름 | 앱에서 쓰는 이름 | 원본 글꼴 | 만든 곳 | 예약명 | KB |
|---|---|---|---|---|---|---|
{table}

## 글꼴을 더 넣을 때

`scripts/build-caption-fonts.py` 를 쓰면 받기 → 서브셋 → 이름 바꾸기 → 코드 생성까지 한 번에 됩니다.

1. 스크립트의 `FONTS` 목록에 한 줄을 더합니다(id · 화면 이름 · 설명 · 묶음 · 앱에서 쓰는 이름 · google/fonts 경로 · 예약명 여부).
   예약명이 있으면 그 이름이 들어가지 않는 이름을 고릅니다.
2. `python3 scripts/build-caption-fonts.py` 를 돌립니다.
3. 글씨체마다 같은 크기에서 보이는 덩치가 달라, 스크립트가 '한' 글자의 실제 높이를 재서
   기기 기본 글꼴(0.874em)에 맞는 `scale` 을 자동으로 계산합니다.
"""

# 글꼴 원본 이름(README 표시용)
ORIGIN = {
    'DoHyeon': ('Do Hyeon', '윤디자인'),
    'BlackHanSans': ('Black Han Sans', 'zesstype'),
    'GasoekOne': ('Gasoek One', 'Yangjin Shin'),
    'GothicA1': ('Gothic A1', 'Hanyang I&C'),
    'GothicKR': ('나눔고딕 Bold', '네이버'),
    'ModernKR': ('IBM Plex Sans KR SemiBold', 'IBM'),
    'Sunflower': ('Sunflower', 'Yoon Design'),
    'Stylish': ('Stylish', 'Yoon Design'),
    'GowunDodum': ('고운돋움', 'Yoon Design'),
    'IslandGothic': ('제주고딕', '제주특별자치도'),
    'MyeongjoKR': ('나눔명조 Bold', '네이버'),
    'SongMyung': ('Song Myung', 'Yoon Design'),
    'GowunBatang': ('고운바탕 Bold', 'Yoon Design'),
    'IslandMyeongjo': ('제주명조', '제주특별자치도'),
    'Diphylleia': ('Diphylleia', 'Yeun Kim'),
    'Gaegu': ('개구 Bold', '윤디자인'),
    'PenKR': ('나눔손글씨 펜', '네이버'),
    'BrushKR': ('나눔손글씨 붓', '네이버'),
    'YeonSung': ('Yeon Sung', 'Yoon Design'),
    'IslandBrush': ('제주한라산', '제주특별자치도'),
    'Dokdo': ('Dokdo', 'Yoon Design'),
    'EastSeaDokdo': ('East Sea Dokdo', 'Yoon Design'),
    'HiMelody': ('Hi Melody', 'Yoon Design'),
    'KirangHaerang': ('Kirang Haerang', 'Yoon Design'),
    'PoorStory': ('Poor Story', 'Yoon Design'),
    'SingleDay': ('Single Day', 'Woowa Brothers'),
    'GamjaFlower': ('Gamja Flower', 'Yoon Design'),
    'CuteFont': ('Cute Font', 'TYPE-Q'),
    'Dongle': ('Dongle Bold', 'Yangjin Shin'),
    'Jua': ('배달의민족 주아', '우아한형제들'),
    'BagelFatOne': ('Bagel Fat One', 'Dalhaem Kim'),
    'MoiraiOne': ('Moirai One', 'Dalhaem Kim'),
    'Gugi': ('Gugi', 'Yoon Design'),
    'Orbit': ('Orbit', 'Yoon Design'),
}


def emit(rows: list) -> None:
    """model.ts 에 붙일 FONTS 블록, fonts.ts, assets/fonts/README.md 를 만든다."""
    # ---------- model.ts 의 FONTS ----------
    lines = []
    group_now = None
    for r in rows:
        if r['group'] != group_now:
            group_now = r['group']
            lines.append(f'  // {group_now}')
        fam = f"family: '{r['family']}', " if r['family'] else ''
        style = "style: { fontWeight: '800' }" if not r['family'] else 'style: {}'
        lines.append(
            f"  {{ id: '{r['id']}', label: '{r['label']}', desc: '{r['desc']}', group: '{r['group']}', {fam}{style}, scale: {r['scale']} }},"
        )
    fonts_ts = 'export const FONTS: FontPreset[] = [\n' + '\n'.join(lines) + '\n];'
    (WORK / 'fonts_block.ts').write_text(fonts_ts, encoding='utf-8')

    # ---------- fonts.ts ----------
    assets = '\n'.join(
        f"  {r['family']}: require('../../../assets/fonts/{r['family']}.ttf'),"
        for r in rows if r['family']
    )
    fonts_module = f"""import {{ useFonts }} from 'expo-font';

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
export const VLOG_FONT_ASSETS = {{
{assets}
}};

/**
 * 자막 글꼴을 올린다. 다 올라오기 전에는 false 가 돌아가며, 그동안 자막은 기기 기본 글꼴로 보인다
 * (글꼴을 기다리며 화면을 멈추지는 않는다 — 자막 말고는 이 글꼴이 필요 없다).
 *
 * 앱(iOS·Android)에서는 앱 안에 들어 있는 파일을 읽으므로 내려받기가 없다.
 * 웹에서는 글꼴 파일을 가져오는데, 프로토타입은 같은 기기에서 띄워 보므로 바로 올라온다.
 */
export function useVlogFonts(): boolean {{
  const [loaded] = useFonts(VLOG_FONT_ASSETS);
  return loaded;
}}
"""
    pathlib.Path('src/prototype/vlog/fonts.ts').write_text(fonts_module, encoding='utf-8')

    # ---------- README ----------
    total = sum(r['size'] for r in rows)
    table = '\n'.join(
        f"| {r['group']} | {r['label']} | `{r['family'] or '—'}` | {ORIGIN.get(r['family'], ('기기 기본 글꼴', '—'))[0]} | "
        f"{ORIGIN.get(r['family'], ('', '—'))[1]} | {'예' if r['rfn'] else '아니오'} | {r['size'] // 1024 if r['size'] else '—'} |"
        for r in rows
    )
    readme = README_TEMPLATE.format(
        total_count=len(rows),
        file_count=len([r for r in rows if r['family']]),
        total_mb=f'{total / 1048576:.1f}',
        table=table,
    )
    OUT.joinpath('README.md').write_text(readme, encoding='utf-8')

    print(f'글씨체 {len(rows)}종 · 합계 {total / 1048576:.1f} MB')
    print('보정값 범위:', min(r['scale'] for r in rows if r['family']), '~', max(r['scale'] for r in rows if r['family']))
    print('생성:', WORK / 'fonts_block.ts', '/ src/prototype/vlog/fonts.ts / assets/fonts/README.md')


if __name__ == '__main__':
    main()
