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
            await page.wait_for_timeout(500)
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
        await page.get_by_role('button',name='동의하고 시작하기',exact=False).click();await page.get_by_text('최근 공동 활동순',exact=True).wait_for();await page.wait_for_timeout(600)
        await shot('GROUPS','내 모임','UI03','screens/GroupsScreen.tsx','예시 가입 완료 → 내 모임',['카드·정렬·보관 안내·생성/초대 진입을 반영. 제품 탭은 모임/내 기록/마이페이지. 예시 모임 수나 보관값을 실제 값으로 사용하지 않는다.'])
        await goto('/group-new');await page.get_by_text('새 모임 만들기',exact=True).wait_for()
        await shot('GROUP-NEW','모임과 첫 일정 생성','UI04','screens/GroupCreateScreen.tsx','내 모임 → 모임 만들기',['모임·방장 참여·첫 일정을 서버에서 원자 생성. 기간 시트·입력 보존·결과 불명 복구 반영.'])
        await page.get_by_text('날짜 선택',exact=True).first.click();await page.wait_for_timeout(300)
        await shot('PERIOD','연속 기간 선택',None,'components/PeriodSheet.tsx','모임 만들기 → 기간 선택',['월요일 시작·과거 허용·양끝 포함366일·취소 시 폼 미반영. 기존 비연속 날짜 시트 DATES와 혼동하지 않는다.'])
        await goto('/group-calendar?groupId=g-walk&focusDate=2026-10-17')
        await page.get_by_text('주말 산책 모임',exact=True).first.wait_for()
        await shot('CALENDAR','모임 달력','UI05','screens/GroupCalendarScreen.tsx','주말 산책 모임 → 2026-10-17',['여러 날 일정을 하루씩 분해해 날짜 제목으로 표시. 카드는 요약을 거치지 않고 그날 장소로 이동한다.', '같은 모임의 날짜 중복을 금지한다(전체 화면 정리 21번 규칙). 명세 v2.3 F07의 겹침 허용과 다르다(P1).'])
        await page.get_by_text('일정 목록',exact=True).click()
        await page.wait_for_timeout(350)
        await shot('CALENDAR-LIST','하루 단위 일정 목록',None,'screens/GroupCalendarScreen.tsx','모임 달력 → 일정 목록',['날짜 제목·하루 날짜·장소 수·첫 장소를 표시. 방장 ⋯ 메뉴에서 하루 편집.'])
        await page.get_by_role('button',name='일정 메뉴',exact=True).first.click()
        await shot('DAY-MENU','하루 일정 메뉴',None,'screens/GroupCalendarScreen.tsx','일정 목록 → 첫 일정 ⋯',['변경 대상은 부모 일정 전체가 아니라 선택한 dayId(UI38). 명세 v2.3과의 차이는 P2.'])
        await page.get_by_role('button',name='일정 변경',exact=True).click()
        await page.get_by_label('일정 제목',exact=True).wait_for()
        await shot('DAY-EDIT','하루 일정 변경',None,'screens/DayEditScreen.tsx','하루 일정 메뉴 → 일정 변경',['제목100자·단일 날짜 변경·그날만 취소·장소 없는 날 삭제. UI38 하루 일정 변경이며 UI06의 기간 변경과 별도 화면.', '명세 v2.3의 날짜 제목30자·일정 전체 취소/삭제 계약과 다르다(P2).'])
        await page.get_by_role('button',name='날짜 ',exact=False).click()
        await shot('DAY-DATE','하루 날짜 변경 시트',None,'components/DatePickSheet.tsx','하루 일정 변경 → 날짜',['단일 선택. 다른 활성 일정/날짜는 선택 불가. 저장 전에는 폼 값만 변경.'])
        await page.get_by_role('button',name='취소',exact=True).click()
        await page.get_by_text('일정 취소(기록 보존)',exact=True).click()
        await shot('DAY-CANCEL','하루 일정 취소 확인',None,'screens/DayEditScreen.tsx','하루 일정 변경 → 일정 취소',['이 날만 취소·기록 보존·되돌리기 불가 안내. 실제 업로드 차단/보존 경로는 검수하지 않았다.'])
        await goto('/group-calendar?groupId=g-walk&focusDate=2026-10-17')
        await page.get_by_role('button',name='일정 메뉴',exact=True).first.wait_for()
        await page.get_by_role('button').filter(has_text='성수에서 느긋한 오후').first.click()
        await page.wait_for_timeout(600)
        await shot('GROUP-DAYS','모임 전체 날짜 탭',None,'screens/ItineraryScreen.tsx','모임 달력의 하루 카드 → 날짜별 장소',['모임 이름·모든 활성 일정 날짜순 탭. 선택한 일정/날짜 ID를 장소·편집·기록에 전달.', '취소 날짜가 탭에서 제외되므로 취소 기록·미지정·기간 밖 접근은 별도 유지해야 한다(P11).'])
        await goto('/members?groupId=g-walk')
        await shot('MEMBERS-GROUP','모임 참여자와 역할','UI26','screens/MembersScreen.tsx','모임 달력 → 함께하는 친구',['방장·나 표시, 방장에게 다른 참여자의 ⋯ 메뉴 제공. 이름 기준 mock은 제품 memberId로 대체.', '이 화면의 카카오톡 초대·링크 복사는 여전히 안내만 제공. 실제 예시 공유는 초대·관리에서 제공.'])
        await page.get_by_role('button',name=' 더보기 메뉴',exact=False).first.click()
        await shot('MEMBER-REMOVE','참여자 내보내기 확인',None,'screens/MembersScreen.tsx','참여자 ⋯ → 확인',['참여자 내보내기 기능이며 사진 내보내기가 아니다. 확인 후 예시 명단 갱신.', '같은 초대 재참여 불가라는 문구보다 F22의 모임 단위 재참여 차단 범위가 넓다. 서버 재검증 필요.'])
        await page.get_by_role('button',name='내보내기',exact=True).click()
        await page.wait_for_timeout(1000)
        await shot('MEMBER-REMOVED','참여자 내보내기 결과',None,'screens/MembersScreen.tsx','확인 → 예시 참여자 명단 갱신',['로컬 예시 명단에서 대상 제거 확인. 실제 서버 퇴장·기존 기록 권한·재참여 차단 검수 아님.'])
        await goto('/members?groupId=g-campus')
        await shot('MEMBERS-READER','일반 참여자 명단',None,'screens/MembersScreen.tsx','일반 참여자 역할의 모임 → 함께하는 친구',['일반 참여자에게 내보내기 메뉴를 제공하지 않는다.'])
        await goto('/schedule-edit?groupId=g-walk&scheduleId=sc-seoul')
        await page.get_by_text('일정 변경',exact=True).first.wait_for()
        await shot('SCHEDULE-EDIT','일정 추가와 변경','UI06','screens/ScheduleEditScreen.tsx','방장 일정 메뉴 → 일정 변경',['기간 밖 영향·취소/빈 일정 삭제·충돌 복구를 반영. 실제 기록/진행 작업 수와 groupId/scheduleId 소속은 서버 검사(A19/A22).'])
        await goto('/invites?groupId=g-walk')
        await page.get_by_text('모임에 초대하기',exact=True).first.wait_for()
        await shot('INVITES','초대 발급과 관리','UI23','screens/InviteManageScreen.tsx','모임 달력 → 초대·관리',['모든 현재 참여자가 초대 관리. 방장에게만 모임 사진 변경이 추가됐다.', '모임 사진은 4:3 선택 후 로컬 상태에 반영된다. 제품 UI25의 16:9·검사·업로드 완료 처리는 별도 계약이다(P9). OS 공유·실제 외부 전송 검수 아님.'])
        await goto('/invite?code=Q7KM2P8R');await page.get_by_text('주말 산책 모임',exact=True).first.wait_for()
        await shot('INVITE-JOIN','초대 확인과 참여','UI24','screens/InviteJoinScreen.tsx','예시 초대 코드로 진입',['미리보기 후 명시적 참여·기존 참여자 이동. 코드8자는 기술안(A18, P8). 실제 앱 링크·정원 경쟁·확인 횟수 검수 아님.'])
        await goto('/my-page')
        await shot('MY-LINK','마이페이지의 내 모임 연결',None,'screens/MyPageScreen.tsx','내 모임 하단 → 마이페이지',['참여한 모임 카드를 누르면 내 모임으로 돌아간다. groups.length가0이면 예시 총계로 대체하는 데모 동작은 제품에서 사용하지 않는다.'])
        await page.get_by_role('button',name='참여한 모임 ',exact=False).click()
        await page.get_by_text('최근 공동 활동순',exact=True).wait_for()
        await browser.close()
    # 구형 일정 경유 참여자 화면은 관련 상태로 보존하고 모임 경유 화면을 대표로 쓴다.
    for old in manifest['screens']:
        if old['id']=='MEMBERS': old['ui']=None
    ids={s['id'] for s in shots};manifest['screens']=[s for s in manifest['screens'] if s['id'] not in ids]+shots
    paths={x['path'] for x in manifest['sources']}|{s['source'] for s in shots}|{'src/prototype/state/GroupsProvider.tsx','src/prototype/mock/groupData.ts','docs/login-calendar-ui-spec.md','docs/stitch/README.md','app/prototype/schedule-edit.tsx','app/prototype/members.tsx','app/prototype/itinerary-day.tsx','src/prototype/utils/dayEntries.ts','src/prototype/utils/profilePhoto.ts','src/prototype/navigation/routes.ts','docs/AT_THAT_PLACE_전체화면정리.pptx'}
    manifest['sources']=[dict(path=p,sha256=hashlib.sha256((source/p).read_bytes()).hexdigest()) for p in sorted(paths)]
    manifest['environment']='Expo 데모 모드(장소·기록) + 비데모 프로토타입(로그인·달력·초대 예시) · Playwright Chromium · 390×844 CSS px · DPR2 · ko-KR · Asia/Seoul'
    manifest['captured_at']=datetime.now(ZoneInfo('Asia/Seoul')).isoformat(timespec='seconds')
    (OUT/'출처.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (OUT/'login-calendar-ui-spec.txt').write_bytes((source/'docs/login-calendar-ui-spec.md').read_bytes())
    (OUT/'stitch-README.txt').write_bytes((source/'docs/stitch/README.md').read_bytes())
    print(json.dumps({'captures':len(manifest['screens']),'added':len(shots),'commit':manifest['commit']},ensure_ascii=False))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--url',default='http://localhost:18082');a=p.parse_args();asyncio.run(capture(a.source.resolve(),a.url.rstrip('/')))
