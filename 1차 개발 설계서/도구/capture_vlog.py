"""브이로그 웹 예시 관찰·캡처. 실제 렌더/저장 검수 아님."""
import argparse, asyncio, hashlib, json, subprocess
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'UI/브이로그'
async def capture(source,url):
 commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip(); shots=[]; checks=[]
 assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=source,text=True).strip(), '추적 소스 변경됨'
 assert commit==json.loads((OUT/'출처.json').read_text())['commit'], '검토 근거와 캡처 커밋 다름'
 async with async_playwright() as pw:
  browser=await pw.chromium.launch()
  page=await browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,locale='ko-KR',timezone_id='Asia/Seoul')
  async def shot(id,title,ui,src,actions,notes):
   await page.wait_for_timeout(300)
   await page.evaluate('document.fonts.ready')
   await page.evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')
   path=OUT/(id+'.png'); await page.screenshot(path=str(path),animations='disabled')
   shots.append(dict(id=id,title=title,ui=ui,image='../브이로그/'+path.name,source='src/prototype/'+src,route=page.url.removeprefix(url),actions=actions,notes=notes,text=await page.locator('body').inner_text(),captured_at='2026-11-04',commit=commit,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
   (OUT/'실행결과.json').write_text(json.dumps(dict(commit=commit,environment='Expo 일반 모드·예시 데이터·Chromium·390×844·DPR2·ko-KR·Asia/Seoul',scope='웹 UI 관찰, 실제 영상 생성·기기 저장·서버 권한 검수 아님',screens=shots,checks=checks),ensure_ascii=False,indent=2)+'\n')
  async def click(name): await page.get_by_role('button',name=name,exact=True).click()
  await page.goto(url+'/prototype/group-calendar?groupId=g-walk',wait_until='networkidle')
  await shot('VLOG-ENTRY','모임 달력과 브이로그 진입','UI05','screens/GroupCalendarScreen.tsx','모임 달력 하단',['9f64b5e: 브이로그 버튼 추가. 방장에게 일정 추가도 표시.'])
  await click('브이로그 만들기'); await page.get_by_text('어느 날을 담을까요?',exact=True).wait_for()
  assert await page.get_by_role('checkbox').filter(has_text='기록 없음').first.is_disabled()
  checks.append({'check':'기록 없는 날짜 선택 차단','passed':True})
  await shot('VLOG-DATES','브이로그 날짜 선택','UI39','vlog/DatePlaceSteps.tsx','달력 → 브이로그',['기록 없는 날짜 비활성. 예시 기록 날짜만 선택한다.'])
  await page.get_by_role('checkbox',name='10월 17일 토요일',exact=False).click(); await click('1일의 장소 선택')
  await shot('VLOG-PLACES','날짜별 장소 선택','UI40','vlog/DatePlaceSteps.tsx','날짜 → 장소',['기록 있는 장소 기본 선택. 세로/가로 비율 선택.'])
  await click('1곳의 사진·동영상 선택')
  await shot('VLOG-MEDIA','브이로그 사진·동영상 선택','UI41','vlog/MediaStep.tsx','장소 → 미디어',['오래된순 기본. 선택 순서가 재생 순서다.'])
  await page.get_by_role('checkbox').nth(0).click(); await page.get_by_role('checkbox').nth(1).click(); await click('2개로 템플릿 선택')
  await shot('VLOG-TEMPLATE','브이로그 템플릿 선택','UI42','vlog/TemplateSteps.tsx','미디어2개 → 템플릿',['이어 재생/2분할 선택. 실제 합성은 미연결.'])
  await page.get_by_role('radio').nth(1).click()
  await click('선택한 방식으로 다음')
  await page.get_by_text('장면 길이 맞춤',exact=True).wait_for()
  checks.append({'check':'15초/8초 분할 공통길이8초','passed':'장면 길이 8초' in await page.locator('body').inner_text()})
  await shot('VLOG-LENGTH','분할 영상 길이 맞추기','UI43','vlog/TemplateSteps.tsx','2분할 → 공통길이',['15초/8초 예시 영상 → 최단8초. 더 긴 영상 구간을 선택할 수 있다.'])
  await click('구간 이동 ›')
  await shot('VLOG-TRIM','브이로그 동영상 구간','UI44','vlog/TemplateSteps.tsx','분할 길이 → 구간 이동',['원본15초에서8초 사용. 편집본의 시작 위치만 바꾼다.'])
  await click('8초 구간 적용'); await click('뒤로가기')
  await page.get_by_role('radio').nth(0).click(); await click('선택한 방식으로 다음')
  await shot('VLOG-EDIT','장면 순서·자막','UI45','vlog/EditStep.tsx','이어 재생 → 편집',['자막·글씨체·효과·화면 맞춤. 커버 기반 미리보기.'])
  await click('이 장소 완료')
  await shot('VLOG-COMPOSE','브이로그 전체 구성','UI46','vlog/OutputSteps.tsx','장면 완료 → 구성',['제목·날짜 제목·제목 화면·순서 편집. 원본 일정 불변.'])
  await click('전체 미리보기')
  await shot('VLOG-PREVIEW','브이로그 전체 미리보기','UI47','vlog/OutputSteps.tsx','전체 구성 → 미리보기',['영상 커버로 배치·자막·순서를 확인. 실제 영상/소리 검수 아님.'])
  await click('영상 생성'); await page.get_by_text('영상 생성 기능이 아직 연결되지 않았어요',exact=True).wait_for()
  checks.append({'check':'생성 미연결 안내·가짜 성공 없음','passed':True})
  await shot('VLOG-NOT-CONNECTED','브이로그 생성 미연결','UI48','vlog/OutputSteps.tsx','미리보기 → 생성',['handler 없음: 미연결 안내. 초안 유지, 다시 생성/편집으로.'])
  await click('닫기'); await click('브이로그 만들기'); await page.get_by_text('작성 중인 브이로그가 있어요',exact=True).wait_for()
  checks.append({'check':'닫기 후 재진입 초안 이어서/새로','passed':True})
  await shot('VLOG-RESUME','브이로그 초안 복원',None,'vlog/VlogFlowScreen.tsx','닫기 → 재진입',['이어서/새로 선택. 마지막 화면 대신 미완료 단계로 복원.'])
  await browser.close()
 print(json.dumps({'captures':len(shots),'checks':checks},ensure_ascii=False))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--url',default='http://localhost:18084');a=p.parse_args();asyncio.run(capture(a.source,a.url))
