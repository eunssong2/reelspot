"""ff5a5d0 UI45 변경 관찰. 기존 브이로그/결함 캡처는 덮어쓰지 않는다."""
import argparse, asyncio, hashlib, json, re, subprocess
from pathlib import Path
from playwright.async_api import async_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'UI/브이로그/편집설정'
COMMIT = 'ff5a5d0ecf477ee9e7d652e9d2a4f4748ab271c5'
SOURCE = 'src/prototype/vlog/EditStep.tsx'

def verify(source):
    assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip() == COMMIT
    assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=source,text=True).strip()
    expected = subprocess.check_output(['git','show',COMMIT+':'+SOURCE],cwd=source)
    assert (source/SOURCE).read_bytes() == expected
    return expected

async def capture(source, url):
    original = verify(source)
    OUT.mkdir(parents=True,exist_ok=True)
    copied = OUT/'소스'/SOURCE
    copied.parent.mkdir(parents=True,exist_ok=True); copied.write_bytes(original)
    digest = lambda b: hashlib.sha256(b).hexdigest()
    (OUT/'출처.json').write_text(json.dumps(dict(date='2026-11-05',branch='feature/ui-prototype',commit=COMMIT,previous_commit='9f64b5e88d7d3e663726975f2408b181f13a0413',scope='UI45 변경 파일 정적 대조. 실행 관찰은 실행결과.json',sources=[dict(path=SOURCE,sha256=digest(original))]),ensure_ascii=False,indent=2)+'\n')
    shots=[]; checks=[]
    async with async_playwright() as pw:
        browser=await pw.chromium.launch()
        p=await browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,locale='ko-KR',timezone_id='Asia/Seoul')
        async def click(name): await p.get_by_role('button',name=name,exact=True).click()
        def acc(name): return p.get_by_role('button',name=re.compile('^'+re.escape(name)))
        def check(name,ok,detail=None):
            checks.append(dict(check=name,passed=bool(ok),detail=detail)); assert ok,name
        async def shot(id,title,actions,notes,primary=False):
            await p.evaluate('document.fonts.ready')
            await p.evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')
            path=OUT/(id+'.png'); await p.screenshot(path=str(path),animations='disabled')
            shots.append(dict(id=id,title=title,ui='UI45' if primary else None,related_ui='UI45',image='../브이로그/편집설정/'+path.name,source=SOURCE,route=p.url.removeprefix(url),actions=actions,notes=notes,text=await p.locator('body').inner_text(),captured_at='2026-11-05',commit=COMMIT,sha256=digest(path.read_bytes())))
        async def stored():
            await p.wait_for_timeout(250)
            return await p.evaluate("localStorage.getItem('reelspot.vlog.drafts.v1')")
        async def setup(split=False):
            await p.goto(url+'/prototype/group-calendar?groupId=g-walk',wait_until='networkidle')
            await p.evaluate('localStorage.clear()'); await p.reload(wait_until='networkidle')
            await click('브이로그 만들기')
            await p.get_by_role('checkbox',name='10월 17일 토요일',exact=False).click()
            await click('1일의 장소 선택'); await click('1곳의 사진·동영상 선택')
            await p.get_by_role('checkbox').nth(0).click(); await p.get_by_role('checkbox').nth(1).click()
            await click('2개로 템플릿 선택')
            if split: await p.get_by_role('radio').nth(1).click()
            await click('선택한 방식으로 다음')
            if split: await click('구간 확인')
            await acc('색감 효과').wait_for()
        await setup()
        check('최초 다섯 설정 모두 접힘',sum(['▼' in await acc(n).inner_text() for n in ['색감 효과','화면 맞춤','날짜·장소명 표시','이 장면 자막','장면 전환']])==5 and await p.get_by_role('button',name=re.compile('▲$')).count()==0)
        await shot('VLOG-EDIT-ACCORDION','장면 편집 · 접힌 설정','일반 모임 달력 → 날짜/장소 → 영상2개 → 이어 재생 → 편집',['ff5a5d0: 상단 미리보기와 하단 완료 고정, 설정만 스크롤.','다섯 설정은 처음 모두 접힘. 선택값 요약·글씨체 별도 행.'],True)
        check('웹 접근성 관찰: expanded DOM 속성 누락(제품 검수 통과 아님)',await acc('색감 효과').get_attribute('aria-expanded') is None,'소스는 accessibilityState.expanded 선언. 현재 웹 DOM에는 없음. 웹 관찰의 한계. Android 결함으로 판정하지 않고 TalkBack으로 별도 검수')
        before=await stored(); assert before
        for name in ['색감 효과','화면 맞춤','날짜·장소명 표시','이 장면 자막','장면 전환']:
            await acc(name).click()
            check(name+'만 펼침',await p.get_by_role('button',name=re.compile('▲$')).count()==1 and '▲' in await acc(name).inner_text())
            await acc(name).click()
            check(name+' 재탭 닫힘',await p.get_by_role('button',name=re.compile('▲$')).count()==0)
        await acc('색감 효과').click(); await acc('화면 맞춤').click()
        check('다른 항목을 열면 기존 항목 닫힘','▼' in await acc('색감 효과').inner_text() and await p.get_by_role('button',name=re.compile('▲$')).count()==1)
        await acc('화면 맞춤').click()
        check('열기/접기만으로 저장된 초안 불변',before==await stored())
        await acc('색감 효과').click(); await p.get_by_role('radio',name='흑백',exact=True).click(); await acc('색감 효과').click()
        check('색감 접힘 요약','흑백' in await acc('색감 효과').inner_text())
        await acc('화면 맞춤').click(); await p.get_by_role('radio',name='맞춤',exact=True).click(); await acc('화면 맞춤').click()
        check('화면 맞춤 접힘 요약','맞춤' in (await acc('화면 맞춤').inner_text()).split('\n')[1:])
        await acc('날짜·장소명 표시').click(); await p.get_by_role('switch',name='날짜 표시',exact=True).click(); await acc('날짜·장소명 표시').click()
        check('표시 접힘 요약','날짜 끔 · 장소명 켬' in await acc('날짜·장소명 표시').inner_text())
        await acc('이 장면 자막').click(); await p.get_by_role('textbox',name='이 장면 자막',exact=True).fill('고정 미리보기에서 자막 확인'); await acc('이 장면 자막').click()
        check('자막 접힘 요약','고정 미리보기에서 자막 확인' in await acc('이 장면 자막').inner_text())
        await click('다음 ›')
        check('이어 재생 대상별 요약 재계산','원본' in await acc('색감 효과').inner_text() and '없음' in await acc('이 장면 자막').inner_text())
        await click('‹ 이전')
        # Locate settings scroller by its actual overflow; observe fixed preview/nav/footer bounds.
        scroller=await acc('장면 전환').evaluate_handle("el=>{for(let x=el.parentElement;x;x=x.parentElement){if(['auto','scroll'].includes(getComputedStyle(x).overflowY)&&x.scrollHeight>x.clientHeight)return x}throw Error('settings scroller missing')}")
        await scroller.evaluate('(el)=>el.scrollTop=0')
        anchors=[p.get_by_role('button',name='이어 재생 · 순서 편집 ›',exact=True),p.get_by_role('button',name='다음 ›',exact=True),p.get_by_role('button',name='이 장소 완료',exact=True),p.get_by_text('고정 미리보기에서 자막 확인',exact=True).first]
        boxes=[await a.bounding_box() for a in anchors]
        await acc('장면 전환').click(); await p.get_by_role('radio',name=re.compile('^페이드 ')).click()
        await p.wait_for_timeout(700)
        await scroller.evaluate('(el)=>el.scrollTop=el.scrollHeight'); await p.wait_for_timeout(150)
        scroll=await scroller.evaluate('(el)=>({top:el.scrollTop,height:el.clientHeight,content:el.scrollHeight})')
        after=[await a.bounding_box() for a in anchors]
        check('설정 실제 스크롤·상단 미리보기/이동·하단 완료 좌표 고정',scroll['top']>0 and all(a and b and abs(a['y']-b['y'])<1 for a,b in zip(boxes,after)),dict(scroll=scroll,before=boxes,after=after))
        await shot('VLOG-EDIT-TRANSITION','장면 편집 · 설정 스크롤','전환 펼치기 → 페이드 → 설정 맨 아래',['설정을 아래로 내려도 미리보기·이전/다음·완료 위치 유지.','선택한 전환의 예시 재생 제공. 첫 장소의 실제 진입 전환 없음 안내 유지.'])
        await acc('장면 전환').click()
        check('전환 접힘 요약','페이드' in await acc('장면 전환').inner_text())
        await acc('이 장면 자막').click()
        await shot('VLOG-EDIT-CAPTION','장면 편집 · 자막 펼침','자막 펼치기',['자막만 펼쳐지고 다른 설정은 접힘. 입력한 자막은 상단 커버에 표시.','웹 예시 관찰이며 Android 키보드·최종 영상 검수 아님.'])
        values=await stored(); await click('뒤로가기'); await click('선택한 방식으로 다음')
        check('재마운트 시 모두 접힘·편집값 보존',await p.get_by_role('button',name=re.compile('▲$')).count()==0 and json.loads(values)['g-walk']['settings']==json.loads(await stored())['g-walk']['settings'])
        await setup(True)
        await acc('화면 맞춤').click(); await p.get_by_role('radio',name='맞춤',exact=True).click(); await acc('화면 맞춤').click()
        check('분할 1번 칸 맞춤 요약','맞춤' in (await acc('화면 맞춤').inner_text()).split('\n')[1:])
        await click('2번 칸 선택')
        check('분할 2번 칸 요약 독립','채우기' in await acc('화면 맞춤').inner_text())
        await click('1번 칸 선택'); await acc('화면 맞춤').click()
        await shot('VLOG-EDIT-SPLIT','장면 편집 · 분할 칸별 맞춤','2분할 → 공통길이 → 편집 → 1번 칸 맞춤',['분할은 선택 칸에 화면 맞춤을 적용하며 다른 칸은 보존.','색감·자막은 분할 장면 전체. 설정 열림은 초안에 저장하지 않음.'])
        await browser.close()
    assert verify(source)==original
    result=dict(commit=COMMIT,environment='Expo 일반 모드·예시 데이터·Chromium·390×844·DPR2·ko-KR·Asia/Seoul',scope='UI45 웹 조작 관찰. Android·실제 렌더/저장·기존 결함 수정 검수 아님',screens=shots,checks=checks)
    (OUT/'실행결과.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(captures=len(shots),checks=len(checks),passed=all(c['passed'] for c in checks)),ensure_ascii=False))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--url',default='http://localhost:18086');args=parser.parse_args()
    asyncio.run(capture(args.source,args.url))
