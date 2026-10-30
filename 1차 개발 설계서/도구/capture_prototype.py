"""실행 중인 feature/ui-prototype 데모 웹을 캡처한다. 원본 앱 코드는 수정하지 않는다."""
import argparse, asyncio, hashlib, json, subprocess
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'UI/프로토타입'

async def capture(source, base_url):
    def git(*args):
        return subprocess.check_output(['git', '-C', str(source), *args], text=True).strip()
    if git('status', '--porcelain', '--untracked-files=no'):
        raise RuntimeError('추적 파일이 변경된 소스에서는 캡처하지 않습니다.')
    commit = git('rev-parse', 'HEAD')
    OUT.mkdir(parents=True, exist_ok=True)
    entries = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width':390,'height':844}, device_scale_factor=2,
                                      locale='ko-KR', timezone_id='Asia/Seoul')
        async def goto(route, day='day-1', place=None, oneday=False):
            query = f'?tripId=trip1&itineraryId={"itin-seoul-oneday" if oneday else "itin-seoul-1"}&dayId={day}'
            if place: query += '&placeId=' + place
            await page.goto(base_url + '/prototype/' + route + query, wait_until='networkidle')
            await page.get_by_text('예시 데이터로 체험 중이에요', exact=True).wait_for()
            await page.evaluate('document.fonts.ready')
            await page.wait_for_timeout(350)
        async def shot(id, title, ui, source_path, actions, notes):
            await page.wait_for_timeout(400)
            # 이미지가 디코딩된 뒤에만 저장한다. 실패한 이미지는 검수에서 잡는다.
            await page.evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')
            failed = await page.evaluate('[...document.images].filter(i=>!i.complete || !i.naturalWidth).map(i=>i.src)')
            if failed: raise RuntimeError(f'{id}: 이미지 로딩 실패 {failed}')
            path = OUT / (id + '.png')
            await page.screenshot(path=str(path), animations='disabled')
            entries.append(dict(id=id,title=title,ui=ui,image=path.name,source=source_path,
                                route=page.url.removeprefix(base_url),actions=actions,notes=notes,
                                text=await page.locator('body').inner_text(),
                                captured_at=datetime.now(ZoneInfo('Asia/Seoul')).isoformat(timespec='seconds'),
                                sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
        screens = 'src/prototype/screens/'
        await goto('')
        await shot('S0','데모 일정 선택',None,'src/demo/DemoHome.tsx','/prototype 진입',
                   ['데모 전용 진입 화면. 서비스의 내 모임(UI03)과 구분한다.'])
        await goto('my-page')
        await shot('MY','마이페이지','UI36',screens+'MyPageScreen.tsx','데모 첫 화면 → 마이페이지',[
            '표시명·모임 수·설정·고객센터 배치를 참고한다. 사진 편집·누적 참여 통계는 A05/A08 결정 전 보류.',
            '제품에서는 기본 아이콘·서버 현재 참여 총계·본인 기록 진입을 제공한다. 예시 값은 사용하지 않는다.'])
        await page.get_by_role('button',name='닉네임 변경',exact=True).click()
        await shot('MY-name','닉네임 변경',None,'src/prototype/components/NicknameEditModal.tsx','마이페이지 → 닉네임 변경',[
            '데모는 최대12자. 제품은 F02의20자·NFC·검사·서버 저장에 연결한다. 로컬 저장은 실제 변경 완료가 아니다.'])
        await goto('settings')
        await shot('SET','설정','UI28',screens+'SettingsScreen.tsx','마이페이지 → 설정',[
            '프로필·초대코드·OS 위치 설정·문서·로그아웃·탈퇴 배치를 참고한다.',
            '제품에서는 내 기록·동의 내역·신고/차단·캐시·문의 경로도 유지. 준비 중 안내는 실제 기능 완료가 아니다.',
            '약관13과 F02/F24의 차이는 출시 전 회의 안건 A13이다.'])
        await page.get_by_role('button',name='초대코드 입력',exact=True).click()
        await shot('SET-invite','초대코드 입력',None,screens+'SettingsScreen.tsx','설정 → 초대코드 입력',[
            '제품에서는 UI24 초대 확인 후 명시적 참여로 연결. 코드만 입력하고 참여 완료로 처리하지 않는다.'])
        await goto('account')
        await shot('ACCOUNT','프로필 및 계정','UI37',screens+'AccountScreen.tsx','설정 → 프로필 및 계정',[
            '표시명 변경·실제 로그인 방식 조회를 기존 API로 연결한다.',
            '사진 편집/복원은 미합의. 제품은 기본 아이콘, 로그인 공급자는 서버의 실제 연결 목록을 쓴다.'])
        await goto('members')
        await shot('MEMBERS','함께하는 친구','UI26',screens+'MembersScreen.tsx','일정 요약 → 참여자 묶음',[
            '모임 참여자 명단과 초대 버튼. 모든 현재 참여자가 UI23 초대 관리로 연결된다.',
            '방장 표시·이전·퇴장·신고/차단·나가기 기존 경로 유지. 데모 초대 버튼은 안내만 수행한다.'])
        await goto('itinerary')
        await shot('S01','일정 요약','UI08',screens+'ItinerarySummaryScreen.tsx','서울 여행 일정 열기',[
            '헤더는 뒤로가기와 브랜드. 16:9 대표 배너는 화면 가로 끝까지 표시한다.',
            '날짜 카드에 날짜·제목·장소/미디어 수를 표시한다. DAY 배지·썸네일·카드 안 추가 버튼은 없다.',
            '일정 추가는 비연속 날짜 다중 선택 데모다. 제품의 연속 기간 변경(UI06)과 달라 A01에서 결정한다.'])
        await page.get_by_role('button', name='배경 사진 변경', exact=True).click()
        await shot('M4','배경 사진 시트',None,'src/prototype/components/CoverEditSheet.tsx','S01 → 배경 사진 변경',[
            '앨범에서 사진 고르기·취소. 직접 선택한 사진이 있으면 기본 이미지로 되돌리기 표시.'])
        await goto('itinerary-day')
        await shot('S02','날짜별 장소',None,screens+'ItineraryScreen.tsx','S01 → 날짜 카드',[
            '날짜 탭은 최대 4개씩 가로 스크롤. 선택 날짜의 장소를 순서·방문 시간과 함께 표시한다.',
            '장소 이미지는 생략하고 장소명·사진/영상 수·기록 진입 링크를 표시한다.',
            '편집은 빈 날짜에도 제공한다. 장소 추가는 S03, 장소 카드는 S04로 이동한다.'])
        await page.get_by_role('button',name='오후의 커피 방문 시간 수정',exact=True).click()
        await shot('M1','방문 시간 수정',None,'src/prototype/components/TimeEditModal.tsx','S02 → 방문 시간 수정',[
            '오전/오후·시·분 휠. 분은 1분 단위이며 시간 미정·취소·확인 제공.',
            '기존 설계의 5분 단위 입력과 차이가 있다. 저장 형식은 HH:mm이다.'])
        await goto('itinerary-day',day='day-3')
        await shot('S02-empty','빈 날짜의 장소',None,screens+'ItineraryScreen.tsx','장소가 없는 10월 19일 선택',[
            '빈 상태에서도 편집과 장소 추가를 제공한다.'])
        await page.get_by_role('button', name='방문 순서 편집',exact=True).click()
        await shot('S05-empty','빈 날짜 편집',None,screens+'PlaceOrderEditScreen.tsx','빈 날짜 → 편집',[
            '장소 행 없이 날짜 제목을 수정할 수 있다. 최신 UI에서 메모 입력이 제거됐다.'])
        await goto('itinerary-day',oneday=True)
        await shot('S02-oneday','하루 일정',None,screens+'ItineraryScreen.tsx','성수 당일치기 → 날짜별 장소',[
            '날짜가 하나인 일정에는 날짜 탭을 표시하지 않는다.'])
        await goto('itinerary')
        await page.get_by_role('button',name='일정 추가',exact=True).click()
        await shot('DATES','날짜 추가 달력',None,'src/prototype/components/DatePickSheet.tsx','S01 → 일정 추가',[
            '비연속 날짜 선택·최대30개·일요일 시작. 담당 명세의 하루 연장 설명과도 다르다.',
            '제품은 방장만 연속 기간366일·월요일 시작·버전/영향 확인. 데모 동작 채택은 A01 결정 전 보류.'])
        await page.get_by_label(' 화요일 20 10월 2026 ',exact=True).click()
        await page.get_by_label(' 수요일 21 10월 2026 ',exact=True).click()
        await page.get_by_role('button',name='2일 추가',exact=True).click()
        await goto('itinerary-day',day='day-5')
        await shot('S02-tabs','5일 일정의 날짜 탭',None,screens+'ItineraryScreen.tsx','S01에서 날짜 2개 추가 → 마지막 날짜 열기',[
            '추가한 날짜로 기간이 늘어나며 선택 탭이 온전히 보이도록 자동 스크롤한다.',
            '최대 4개 탭이 여백 안에 표시된다. 데모의 최대 30일은 제품 명세의 366일과 다르다.'])
        # 이후 캡처는 동일한 초기 예시 데이터로 돌아온다.
        await page.evaluate('localStorage.clear()')
        await goto('place-search')
        await page.get_by_role('button',name='카페',exact=True).click()
        await page.get_by_text('예시 장소 4곳',exact=True).wait_for()
        await shot('S03','장소 검색과 지도','UI10',screens+'PlaceSearchScreen.tsx','장소 추가 → 카페 카테고리',[
            '검색창·카테고리·예시 지도·결과 시트. 현재 캡처는 오프라인 예시 검색이다.',
            '검색 결과와 핀을 연동하고 관련도순/거리순을 제공한다.',
            '추가 성공 시 S02로 복귀하고 마지막 순서에 추가·추가됨 표시. 실제 카카오 연동은 별도 검수.'])
        # 결과 행의 이름을 선택해 상세 패널을 연다.
        await page.get_by_text('성수 로스터리 카페',exact=True).last.click()
        await shot('S03-detail','장소 상세와 추가',None,'src/prototype/components/PlaceDetailPanel.tsx','카페 결과 → 성수 로스터리 카페',[
            '선택 날짜·주소를 확인하고 이 날의 장소로 추가한다. 선택만으로는 저장하지 않는다.'])
        await goto('place-order')
        await shot('S05','방문 계획 편집','UI12',screens+'PlaceOrderEditScreen.tsx','S02 → 편집',[
            '날짜 제목 30자·위/아래 순서 이동·방문 시간·변경 저장.',
            '드래그 없이 ▲▼로 이동한다. 시간 변경으로 순서를 자동 정렬하지 않는다.',
            '날짜 공통 메모 입력은 최신 화면에서 제거됐다. 제품은 F10의 버전·입력 보존·5분 시각 규칙을 따른다.'])
        await goto('place-records',place='demo-cafe')
        await shot('S04','장소별 기록 · 사진별','UI13',screens+'PlaceRecordsScreen.tsx','S02 → 오후의 커피',[
            '장소 헤더·올리기·최신/오래된순·보기 아이콘·선택 버튼. 사진/영상 집계는 제품에서 유지한다.',
            '파일 하나당 4:3 카드 하나. 작성자·시각·설명·영상 길이를 표시한다.',
            '데모 최신순은 게시물 시각 기준이며 제품의 촬영 시각 기준 오름차순과 차이가 있다.'])
        await page.get_by_label('사람별 보기',exact=True).click()
        await shot('S04-people','장소별 기록 · 사람별','UI09',screens+'PlaceRecordsScreen.tsx','S04 → 사람별 보기',[
            '작성자별 카드와 사진 격자. 여러 장은 +N으로 펼치거나 접는다.',
            '이 캡처는 한 방문의 사람별 보기다. 일정 전체·기간 밖·장소 미지정 기록 조회는 기존 제품 계약으로 남는다.'])
        await page.get_by_label('사진별 보기',exact=True).click()
        await page.get_by_role('button',name='사진 선택',exact=True).click()
        await page.get_by_role('button',name='도윤이 올린 사진 크게 보기',exact=True).click()
        await shot('S04-select','기록 선택과 저장',None,screens+'PlaceRecordsScreen.tsx','S04 → 선택 → 사진 선택',[
            '체크 표시·전체 선택·선택 수·하단 저장 버튼. 제품은 길게 선택·최대120개·파일별 저장 결과도 제공한다.',
            '데모 다운로드 처리기는 미연결이다. 저장 완료 화면으로 해석하지 않는다.'])
        await page.get_by_role('button',name='선택 취소',exact=True).click()
        await page.get_by_role('button',name='도윤이 올린 사진 크게 보기',exact=True).click()
        await shot('V1-photo','사진 확대 보기','UI18','src/demo/MediaViewerModal.tsx','S04 → 도윤 사진',[
            '전체 화면 사진·확대/축소·닫기. 버튼과 두 번 탭 확대를 제공한다.',
            '저장·다중 선택·신고/차단 등 제품 기능은 이 데모 뷰어에 구현되어 있지 않다.'])
        await page.get_by_role('button',name='닫기',exact=True).click()
        await page.get_by_role('button',name='도윤이 올린 동영상 재생',exact=True).click()
        await page.wait_for_function('document.querySelector("video")?.readyState >= 2')
        await page.wait_for_function('document.querySelector("video")?.readyState >= 3')
        await page.evaluate('document.querySelector("video").play()')
        await page.wait_for_function('document.querySelector("video").currentTime > 1.2')
        await page.evaluate('document.querySelector("video").pause()')
        await shot('V1-video','동영상 재생 보기',None,'src/demo/MediaViewerModal.tsx','S04 → 도윤 동영상',[
            '번들 예시 동영상과 재생 컨트롤. 웹 렌더링 캡처이며 Android 재생 검수 결과와 구분한다.'])
        await page.get_by_role('button',name='닫기',exact=True).click()
        await page.get_by_role('button',name='사진·동영상 올리기',exact=True).click()
        await shot('M2','기록 추가 시트','UI14',screens+'PlaceRecordsScreen.tsx','S04 → 사진·동영상 올리기',[
            '빈 선택 목록·추가 타일·업로드하기. 선택 0개이면 제출 비활성.',
            '화면의 최대 10개는 데모 값이다. 제품 계약의 방문별 사진5/영상2·다중선택120과 구분한다.',
            '실제 업로드는 팀원 연결 지점이며 서버 저장 완료를 뜻하지 않는다.'])
        await page.get_by_role('button',name='사진·동영상 추가',exact=True).click()
        await shot('M3','촬영과 앨범 선택',None,'src/prototype/components/MediaPickerSheet.tsx','M2 → 추가 타일',[
            '사진 촬영·동영상 촬영·앨범 선택 연결. OS 선택기 자체는 이 캡처에 포함하지 않는다.'])
        await goto('place-records',place='demo-books')
        await shot('S04-empty','기록 없는 장소',None,screens+'PlaceRecordsScreen.tsx','S02 → 작은책방 하루',[
            '기록 없음 안내와 올리기 버튼을 표시한다.'])
        await browser.close()
    paths = sorted({e['source'] for e in entries} | {'docs/demo-app-spec.md','docs/feature-spec.md','src/theme/theme.ts','src/prototype/styles/tokens.ts','src/demo/demoStore.ts','src/demo/downloadBridge.ts','src/prototype/state/PrototypeProvider.tsx'})
    manifest = dict(branch='feature/ui-prototype',commit=commit,repository='https://github.com/eunssong2/reelspot',
                    captured_at=datetime.now(ZoneInfo('Asia/Seoul')).isoformat(timespec='seconds'),
                    environment='Expo 데모 모드 · Playwright Chromium 웹 · 390×844 CSS px · DPR 2 · ko-KR · Asia/Seoul',
                    scope='브랜치 화면의 웹 실행 캡처. Android APK 재실행·실제 로그인·서버·업로드·지도 검수 아님.',
                    sources=[dict(path=p,sha256=hashlib.sha256((source/p).read_bytes()).hexdigest()) for p in paths],screens=entries)
    (OUT/'출처.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    for name in ['demo-app-spec','feature-spec']:
        (OUT/(name+'.txt')).write_bytes((source/'docs'/(name+'.md')).read_bytes())
    print(json.dumps({'commit':commit,'captures':len(entries),'output':str(OUT)},ensure_ascii=False))

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,required=True)
    parser.add_argument('--url',default='http://localhost:18081')
    args=parser.parse_args()
    asyncio.run(capture(args.source.resolve(),args.url.rstrip('/')))
