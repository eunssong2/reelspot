"""9f64b5e 피드백 재현. reproduced=true는 결함 재현이며 기능 검수 통과가 아니다."""
import argparse,asyncio,hashlib,json,subprocess,os,signal,socket,time,urllib.request,tempfile
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'UI/브이로그/피드백검토'
async def observe(source_path, url, commit):
 OUT.mkdir(exist_ok=True); results=[]
 async with async_playwright() as pw:
  browser=await pw.chromium.launch()
  async def setup():
   p=await browser.new_page(viewport={'width':390,'height':844},locale='ko-KR',timezone_id='Asia/Seoul')
   await p.goto(url+'/prototype/group-calendar?groupId=g-walk',wait_until='networkidle')
   await click(p,'브이로그 만들기')
   await p.get_by_role('checkbox',name='10월 17일 토요일',exact=False).click()
   await click(p,'1일의 장소 선택'); await click(p,'1곳의 사진·동영상 선택')
   await p.get_by_role('checkbox').nth(0).click(); await p.get_by_role('checkbox').nth(1).click()
   await click(p,'2개로 템플릿 선택');return p
  async def click(p,label):await p.get_by_role('button',name=label,exact=True).click()
  async def evidence(p,id,stage):
   path=OUT/(id+'-'+stage+'.png');await p.screenshot(path=str(path));return dict(image=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),text=await p.locator('body').inner_text())
  p=await setup();await click(p,'선택한 방식으로 다음');await click(p,'이 장소 완료');await click(p,'전체 미리보기')
  await click(p,'자막·장면 수정')
  await p.get_by_role('button',name='오후의 커피 완료 수정',exact=True).click()
  await p.get_by_role('textbox',name='이 장면 자막',exact=True).fill('피드백 재현')
  await click(p,'뒤로가기');await click(p,'전체 미리보기')
  await p.get_by_text('아직 편집하지 않은 장소 1곳이 있어요',exact=True).wait_for()
  blocked=await evidence(p,'VB01','compose-blocked')
  await click(p,'뒤로가기');assert await p.get_by_role('button',name='영상 생성',exact=True).is_enabled()
  preview=await evidence(p,'VB01','preview-bypass');await click(p,'영상 생성')
  await p.get_by_text('영상 생성 기능이 아직 연결되지 않았어요',exact=True).wait_for()
  results.append(dict(id='VB01',reproduced=True,summary='자막 수정으로 done=false인 상태에서 이전 미리보기의 생성 버튼으로 UI48 진입',evidence=[blocked,preview,await evidence(p,'VB01','generate')]))
  await p.close()
  p=await setup();await p.get_by_role('radio').nth(1).click();await click(p,'선택한 방식으로 다음')
  for _ in range(6):await click(p,'1초 줄이기')
  await p.get_by_role('button',name='구간 이동 ›',exact=True).first.click()
  for _ in range(13):await click(p,'1초 뒤로')
  await click(p,'2초 구간 적용')
  for _ in range(6):await click(p,'1초 늘리기')
  assert '원본 15초   사용 0:13~0:21' in await p.locator('body').inner_text()
  results.append(dict(id='VB02',reproduced=True,summary='분할 공통 길이 2초에서 시작13초 지정 후 공통 길이8초로 증가: 원본15초에 사용13~21초 표시',evidence=[await evidence(p,'VB02','out-of-range')]))
  await browser.close()
 verified_source(source_path)
 data=dict(date=datetime.now(ZoneInfo('Asia/Seoul')).isoformat(timespec='seconds'),commit=commit,source=source_path.name,url=url,server='검증한 checkout에서 도구가 직접 시작한 Expo 프로세스',environment='Expo 일반 모드·예시 데이터·Chromium·390×844·ko-KR·Asia/Seoul',scope='UI 조작으로 결함 재현. 실제 영상 생성·저장·제품 수정 검수 아님.',results=results)
 (OUT/'재현결과.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({r['id']:r['reproduced'] for r in results}))
def verified_source(source):
 source=source.resolve()
 git=lambda *args:subprocess.check_output(['git','-C',str(source),*args],text=True).strip()
 expected=json.loads((ROOT/'UI/브이로그/출처.json').read_text())
 commit=git('rev-parse','HEAD')
 if commit!=expected['commit']:raise RuntimeError('근거 커밋과 소스가 다름: '+commit)
 if git('status','--porcelain','--untracked-files=no'):raise RuntimeError('추적 소스에 미커밋 변경이 있음')
 for item in expected['sources']:
  if hashlib.sha256((source/item['path']).read_bytes()).hexdigest()!=item['sha256']:
   raise RuntimeError('근거 소스 해시 불일치: '+item['path'])
 return source,commit

def run(source,port):
 source,commit=verified_source(source)
 # 이미 실행 중인 서버에 연결하지 않는다. 확인한 소스에서 시작한 프로세스만 사용한다.
 with socket.socket() as sock: sock.bind(('127.0.0.1',port))
 OUT.mkdir(exist_ok=True)
 url='http://127.0.0.1:'+str(port)
 env={**os.environ,'CI':'1','EXPO_NO_DOTENV':'1','EXPO_OFFLINE':'1'}
 with tempfile.NamedTemporaryFile(mode='w',prefix='vlog-repro-',suffix='.log',delete=False) as log:
  proc=subprocess.Popen(['npx','expo','start','--web','--port',str(port),'--localhost'],cwd=source,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  try:
   deadline=time.monotonic()+60
   while True:
    if proc.poll() is not None:raise RuntimeError('Expo 시작 실패: '+log.name)
    try:
     with urllib.request.urlopen(url+'/status',timeout=1) as response:
      if b'packager-status:running' in response.read():break
    except (OSError,TimeoutError):pass
    if time.monotonic()>deadline:raise RuntimeError('Expo 시작 시간 초과')
    time.sleep(.3)
   asyncio.run(observe(source,url,commit))
   verified_source(source)  # 실행 도중 소스 변경도 허용하지 않는다.
  finally:
   if proc.poll() is None:
    os.killpg(proc.pid,signal.SIGTERM)
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
     os.killpg(proc.pid,signal.SIGKILL);proc.wait()
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--source',type=Path,required=True,help='9f64b5e 원본 checkout; 도구가 이 위치에서 Expo를 시작함')
 parser.add_argument('--port',type=int,default=18085,help='사용하지 않는 로컬 포트 (기본18085)')
 args=parser.parse_args()
 run(args.source,args.port)
