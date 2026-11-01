"""비데모 Expo 프로토타입의 로그인·달력·초대 화면을 기존 캡처 manifest에 추가한다."""
import argparse, asyncio, hashlib, json, subprocess
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'UI/프로토타입'
async def capture(source, url):
    git=lambda *args:subprocess.check_output(['git','-C',str(source),*args],text=True).strip()
    if git('status','--porcelain','--untracked-files=no'): raise RuntimeError('원본 추적 파일 변경됨')
    manifest=json.loads((OUT/'출처.json').read_text())
    if manifest['commit']!=git('rev-parse','HEAD'): raise RuntimeError('기존 캡처와 소스 커밋 다름')
    shots=[]
    async with async_playwright() as pw:
        browser=await pw.chromium.launch()
        page=await browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,locale='ko-KR',timezone_id='Asia/Seoul')
        async def goto(route):
            await page.goto(url+'/prototype'+route,wait_until='networkidle')
            await page.wait_for_timeout(1200)
        async def shot(id,title,ui,src,actions,notes):
            await page.evaluate('document.fonts.ready')
            await page.evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')
            failed=await page.evaluate('[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)')
            if failed:raise RuntimeError(f'{id}: 이미지 로딩 실패')
            p=OUT/(id+'.png');await page.screenshot(path=str(p),animations='disabled')
            shots.append(dict(id=id,title=title,ui=ui,image=p.name,source='src/prototype/'+src,route=page.url.removeprefix(url),actions=actions,notes=notes,text=await page.locator('body').inner_text(),captured_at=datetime.now(ZoneInfo('Asia/Seoul')).isoformat(timespec='seconds'),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
        await goto('');await page.get_by_text('카카오로 시작하기',exact=True).wait_for()
        await shot('LOGIN','시작과 로그인','UI01','screens/LoginScreen.tsx','비데모 /prototype 첫 진입',['고객 UI 원본: Google 버튼 포함. 제품은 사용자 확정에 따라 카카오만 표시(A16). 실제 OAuth 검수 아님.'])
        await page.get_by_text('카카오로 시작하기',exact=True).click();await page.get_by_label('표시명',exact=True).wait_for();await page.wait_for_timeout(400)
        await shot('ONBOARD','가입 동의와 표시명','UI02','screens/OnboardingScreen.tsx','카카오 예시 로그인 → 신규 가입',['원본에는 전체동의·개인정보 필수·마케팅/위치 선택이 있다. 제품은 이용약관 체크1개+개인정보 고지로 수정(A17). 캡처의 약관 본문은 게시하지 않는다.'])
        await page.get_by_role('checkbox',name='서비스 이용약관 필수',exact=True).click()
        await page.get_by_role('checkbox',name='개인정보 수집 및 이용 동의 필수',exact=True).click()
        await page.get_by_role('button',name='동의하고 시작하기',exact=False).click();await page.get_by_text('함께하는 모임',exact=True).wait_for();await page.wait_for_timeout(600)
        await shot('GROUPS','내 모임','UI03','screens/GroupsScreen.tsx','예시 가입 완료 → 내 모임',['카드·정렬·보관 안내·생성/초대 진입을 반영. 제품 탭은 모임/내 기록/마이페이지. 예시 모임 수나 보관값을 실제 값으로 사용하지 않는다.'])
        await goto('/group-new');await page.get_by_text('새 모임 만들기',exact=True).wait_for()
        await shot('GROUP-NEW','모임과 첫 일정 생성','UI04','screens/GroupCreateScreen.tsx','내 모임 → 모임 만들기',['모임·방장 참여·첫 일정을 서버에서 원자 생성. 기간 시트·입력 보존·결과 불명 복구 반영.'])
        await page.get_by_text('날짜 선택',exact=True).first.click();await page.wait_for_timeout(300)
        await shot('PERIOD','연속 기간 선택',None,'components/PeriodSheet.tsx','모임 만들기 → 기간 선택',['월요일 시작·과거 허용·양끝 포함366일·취소 시 폼 미반영. 기존 비연속 날짜 시트 DATES와 혼동하지 않는다.'])
        await goto('/group-calendar?groupId=g-walk&focusDate=2026-10-17')
        await page.get_by_text('주말 산책 모임',exact=True).first.wait_for()
        await shot('CALENDAR','모임 달력','UI05','screens/GroupCalendarScreen.tsx','주말 산책 모임 → 2026-10-17',['6주 달력·3개+N·선택일 전체 목록·방장 메뉴·초대 진입. 서버 범위 조회와 늦은 응답 처리는 별도 검수.'])
        await goto('/schedule-edit?groupId=g-walk&scheduleId=sc-seoul')
        await page.get_by_text('일정 변경',exact=True).first.wait_for()
        await shot('SCHEDULE-EDIT','일정 추가와 변경','UI06','screens/ScheduleEditScreen.tsx','방장 일정 메뉴 → 일정 변경',['기간 밖 영향·취소/빈 일정 삭제·충돌 복구를 반영. 실제 기록/진행 작업 수와 groupId/scheduleId 소속은 서버 검사(A19/A22).'])
        await goto('/invites?groupId=g-walk')
        await page.get_by_text('모임에 초대하기',exact=True).first.wait_for()
        await shot('INVITES','초대 발급과 관리','UI23','screens/InviteManageScreen.tsx','모임 달력 → 초대·관리',['모든 현재 참여자 권한, 사용 가능/이전 목록·개별 복사·공유·취소. OS 공유창과 실제 외부 전송 검수 아님.'])
        await goto('/invite?code=Q7KM2P8R');await page.get_by_text('주말 산책 모임',exact=True).first.wait_for()
        await shot('INVITE-JOIN','초대 확인과 참여','UI24','screens/InviteJoinScreen.tsx','예시 초대 코드로 진입',['미리보기 후 명시적 참여·기존 참여자 이동. 코드8자는 기술안(A18). 실제 앱 링크·정원 경쟁·확인 횟수 검수 아님.'])
        await browser.close()
    ids={s['id'] for s in shots};manifest['screens']=[s for s in manifest['screens'] if s['id'] not in ids]+shots
    paths={x['path'] for x in manifest['sources']}|{s['source'] for s in shots}|{'src/prototype/state/GroupsProvider.tsx','src/prototype/mock/groupData.ts','docs/login-calendar-ui-spec.md','docs/stitch/README.md','app/prototype/schedule-edit.tsx'}
    manifest['sources']=[dict(path=p,sha256=hashlib.sha256((source/p).read_bytes()).hexdigest()) for p in sorted(paths)]
    manifest['environment']='Expo 데모 모드(장소·기록) + 비데모 프로토타입(로그인·달력·초대 예시) · Playwright Chromium · 390×844 CSS px · DPR2 · ko-KR · Asia/Seoul'
    manifest['captured_at']=datetime.now(ZoneInfo('Asia/Seoul')).isoformat(timespec='seconds')
    (OUT/'출처.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (OUT/'login-calendar-ui-spec.txt').write_bytes((source/'docs/login-calendar-ui-spec.md').read_bytes())
    (OUT/'stitch-README.txt').write_bytes((source/'docs/stitch/README.md').read_bytes())
    print(json.dumps({'captures':len(manifest['screens']),'added':len(shots),'commit':manifest['commit']},ensure_ascii=False))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--url',default='http://localhost:18082');a=p.parse_args();asyncio.run(capture(a.source.resolve(),a.url.rstrip('/')))
