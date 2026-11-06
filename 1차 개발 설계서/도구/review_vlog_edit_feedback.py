"""ff5a5d0 웹 입력공간/VB01/Q22 관찰. Android 결과와 분리한다."""
import asyncio,json,re,subprocess,hashlib,argparse
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'UI/브이로그/편집설정/피드백검토'
COMMIT='ff5a5d0ecf477ee9e7d652e9d2a4f4748ab271c5'
async def main(source,url):
 commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()
 assert commit==COMMIT
 assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=source,text=True).strip()
 OUT.mkdir(parents=True,exist_ok=True)
 results=dict(commit=commit,date='2026-11-05',environment='Chromium 웹·예시 데이터·ko-KR·Asia/Seoul',scope='VB05는 화면 높이 축소 모사이며 Android 키보드 실측 아님. VB01은 결함 재현, Q22는 의도 확인 전 관찰.')
 async with async_playwright() as pw:
  b=await pw.chromium.launch()
  p=await b.new_page(viewport={'width':390,'height':844},locale='ko-KR',timezone_id='Asia/Seoul')
  async def click(name):await p.get_by_role('button',name=name,exact=True).click()
  def acc(name):return p.get_by_role('button',name=re.compile('^'+re.escape(name)))
  async def setup(split=False):
   await p.set_viewport_size({'width':390,'height':844})
   await p.goto(url+'/prototype/group-calendar?groupId=g-walk',wait_until='networkidle')
   await p.evaluate('localStorage.clear()'); await p.reload(wait_until='networkidle')
   await click('브이로그 만들기');await p.get_by_role('checkbox',name='10월 17일 토요일',exact=False).click()
   await click('1일의 장소 선택');await click('1곳의 사진·동영상 선택')
   await p.get_by_role('checkbox').nth(0).click();await p.get_by_role('checkbox').nth(1).click();await click('2개로 템플릿 선택')
   if split:await p.get_by_role('radio').nth(1).click()
   await click('선택한 방식으로 다음')
   if split:await click('구간 확인')
   await acc('이 장면 자막').wait_for()
  await setup()
  await acc('이 장면 자막').click()
  tb=p.get_by_role('textbox',name='이 장면 자막',exact=True)
  await tb.fill('키보드 공간 검토')
  results['sizes']=[]
  for w,h in [(390,844),(360,640),(390,544),(360,500)]:
   await p.set_viewport_size({'width':w,'height':h});await p.wait_for_timeout(150)
   metrics=await tb.evaluate('''el=>{let s=el.parentElement;while(s&&!['auto','scroll'].includes(getComputedStyle(s).overflowY))s=s.parentElement;if(!s)throw Error('no scroll');s.scrollTop+=el.getBoundingClientRect().top-s.getBoundingClientRect().top-(s.clientHeight-el.clientHeight)/2;const a=s.getBoundingClientRect(),t=el.getBoundingClientRect();return {settingsHeight:s.clientHeight,settingsY:a.y,inputHeight:t.height,visibleInputHeight:Math.max(0,Math.min(t.bottom,a.bottom)-Math.max(t.top,a.top)),scrollTop:s.scrollTop}}''')
   results['sizes'].append(dict(width=w,viewportHeight=h,originalHeight={544:844,500:800}.get(h,h),assumedKeyboardHeight=300 if h in (544,500) else 0,**metrics));await p.screenshot(path=str(OUT/f'{w}x{h}.png'))
  await p.set_viewport_size({'width':390,'height':844})
  await click('다음 ›')
  results['next_keeps_open']='▲' in await acc('이 장면 자막').inner_text()
  await tb.fill('   ');await acc('이 장면 자막').click()
  results['whitespace_summary']=await acc('이 장면 자막').inner_text()
  await acc('이 장면 자막').click(); await click('구간 이동 ›');await click('5초 구간 적용')
  results['trim_return']=dict(openCount=await p.get_by_role('button',name=re.compile('▲$')).count(),sceneOne=await p.get_by_text(re.compile('장면 1 / 2')).count()>0)
  await acc('색감 효과').click()
  results['accessibility']=dict(expanded=await acc('색감 효과').get_attribute('aria-expanded'),radios=await p.get_by_role('radio').evaluate_all('(es)=>es.map(e=>({text:e.innerText,checked:e.getAttribute("aria-checked"),selected:e.getAttribute("aria-selected")}))'))
  await click('이 장소 완료');await click('전체 미리보기');await click('자막·장면 수정')
  await p.get_by_role('button',name='오후의 커피 완료 수정',exact=True).click()
  await acc('이 장면 자막').click();await tb.fill('VB01 최신 커밋 검토')
  await click('뒤로가기');await click('뒤로가기');await click('영상 생성')
  await p.get_by_text('영상 생성 기능이 아직 연결되지 않았어요',exact=True).wait_for()
  results['VB01']=dict(reproduced=True,body=await p.locator('body').inner_text())
  await p.screenshot(path=str(OUT/'VB01-current.png'))
  await setup(True)
  results['split_video_length']=dict(lengthRow=await p.get_by_text('동영상 길이',exact=True).count(),fixedLink=await p.get_by_role('button',name=re.compile('길이 변경')).count())
  await b.close()
 (OUT/'실행결과.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
 print(json.dumps({'commit':commit,'VB01':results['VB01']['reproduced'],'sizes':results['sizes']},ensure_ascii=False))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--url',default='http://localhost:18087');a=parser.parse_args();asyncio.run(main(a.source,a.url))
