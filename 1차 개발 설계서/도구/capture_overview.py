"""UI 담당 '전체 화면 정리' PPTX에서 화면 이미지와 설명을 추출한다.

이 자료는 UI 설계의 최우선 기준이다. 원본 PPTX는 UI 브랜치에 있으므로 패키지에는
추출 이미지·슬라이드 문구·해시만 저장한다. 원격 브랜치의 추적 파일은 수정하지 않는다.

사용: .venv/bin/python 도구/capture_overview.py --pptx /절대경로/docs/AT_THAT_PLACE_전체화면정리.pptx --commit <커밋>
"""
import argparse, datetime, hashlib, json, re
from pathlib import Path
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from design_model import ROOT

OUT = ROOT/'UI/전체화면정리'
# (슬라이드, 슬라이드 안 이미지 순서) → 설계 화면 ID. 화면별 첫 이미지가 대표 이미지다.
UI_MAP = {
    (3,1):'UI01', (4,1):'UI02', (4,2):'UI02', (4,3):'UI02', (5,1):'UI03', (5,2):'UI03',
    (6,1):'UI04', (6,2):'UI04', (7,1):'UI05', (7,2):'UI05', (7,3):'UI05', (8,1):'UI05', (8,2):'UI05',
    (9,1):'UI38', (9,2):'UI38', (9,3):'UI38', (9,4):'UI38', (10,1):'UI06', (10,2):'UI06',
    (11,1):'UI23', (11,2):'UI23', (12,1):'UI24', (12,2):'UI24', (12,3):'UI24', (12,4):'UI24',
    (13,1):'UI26', (13,2):'UI26', (13,3):'UI26', (14,1):'UI08', (14,2):'UI08',
    (15,1):'UI10', (15,2):'UI12', (16,1):'UI13', (16,2):'UI13',
    (17,1):'UI09', (17,2):'UI09', (17,3):'UI14', (18,1):'UI36', (18,2):'UI36',
    (19,1):'UI28', (19,2):'UI28', (19,3):'UI28', (20,1):'UI37',
}


def slide_lines(slide):
    lines = []
    for sh in slide.shapes:
        if sh.has_text_frame:
            lines += [p.text.strip() for p in sh.text_frame.paragraphs if p.text.strip()]
    return lines


def parse(lines, states, title):
    """슬라이드 문구를 구분·요약·설명·참고로 나눈다(마지막 줄들은 이미지 이름표다).

    제목은 이미지 설명의 화면 이름을 쓴다. 슬라이드 제목 글상자는 이름표와 같을 때가 있다."""
    lines = list(lines)
    while lines and lines[-1] in states:
        lines.pop()
    note = next((l[2:].strip() for l in lines if l.startswith('참고')), '')
    lines = [l for l in lines if not l.startswith('참고')]
    lead_at = next((i for i, l in enumerate(lines) if l.endswith('다.')), None)
    if lead_at is None:
        return dict(section='', title=title, lead='', bullets=lines, note=note)
    head = [l for l in lines[:lead_at] if l not in states and l != title]
    return dict(section=head[0] if head else '', title=title,
                lead=lines[lead_at], bullets=lines[lead_at+1:], note=note)


def safe(text):
    return re.sub(r'[^0-9A-Za-z가-힣]+', '_', text).strip('_')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pptx', required=True)
    ap.add_argument('--commit', required=True)
    args = ap.parse_args()
    src = Path(args.pptx)
    blob = src.read_bytes()
    prs = Presentation(src)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('P*.png'):
        old.unlink()
    slides, images = [], []
    for no, slide in enumerate(prs.slides, 1):
        pics = [sh for sh in slide.shapes if sh.shape_type == MSO_SHAPE_TYPE.PICTURE]
        states = []
        for n, pic in enumerate(pics, 1):
            screen, _, state = pic._element.xpath('./p:nvPicPr/p:cNvPr/@descr')[0].partition(' - ')
            states.append(state)
            name = f'P{no:02}-{n}_{safe(screen)}_{safe(state)}.png'
            (OUT/name).write_bytes(pic.image.blob)
            images.append(dict(id=f'P{no:02}-{n}', slide=no, screen=screen, state=state,
                               ui=UI_MAP[(no, n)], image=name,
                               sha256=hashlib.sha256(pic.image.blob).hexdigest()))
        lines = slide_lines(slide)
        entry = dict(slide=no, lines=lines, images=[i['id'] for i in images if i['slide'] == no])
        if pics:
            entry.update(parse(lines, set(states), images[-1]['screen']))
        for sh in slide.shapes:
            if sh.has_table:
                entry['table'] = [[c.text for c in r.cells] for r in sh.table.rows]
        slides.append(entry)
    missing = set(UI_MAP) - {(i['slide'], int(i['id'].split('-')[1])) for i in images}
    if missing:
        raise SystemExit(f'PPTX 구성이 바뀌었습니다. UI_MAP을 확인하세요: {sorted(missing)}')
    manifest = dict(
        title='AT THAT PLACE 전체 화면 정리', priority='UI 설계 최우선 기준',
        branch='feature/ui-prototype', commit=args.commit,
        file='docs/AT_THAT_PLACE_전체화면정리.pptx', sha256=hashlib.sha256(blob).hexdigest(),
        bytes=len(blob), extracted_at=datetime.datetime.now().astimezone().isoformat(timespec='seconds'),
        scope='UI 담당이 정리한 프로토타입 화면 예시와 기능 설명. 실제 로그인·서버 저장·업로드는 PPTX 22번 슬라이드의 미연결 목록을 따른다.',
        slides=slides, images=images)
    (OUT/'출처.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    (OUT/'슬라이드 문구.txt').write_text(
        '\n\n'.join(f'## 슬라이드 {s["slide"]}\n'+'\n'.join(s['lines']) for s in slides)+'\n')
    print(json.dumps({'slides': len(slides), 'images': len(images),
                      'screens': sorted({i['ui'] for i in images})}, ensure_ascii=False))


if __name__ == '__main__':
    main()
