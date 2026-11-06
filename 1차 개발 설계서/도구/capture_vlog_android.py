"""Android15 예시 프로토타입 관찰 캡처. UI 조작은 사용법/실행결과의 순서를 따른다.
실기기 검수나 TalkBack 낭독 통과를 자동 판정하지 않는다.
"""
import argparse,hashlib,json,subprocess,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'UI/브이로그/편집설정/Android15'
COMMIT='ff5a5d0ecf477ee9e7d652e9d2a4f4748ab271c5'
def main():
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--serial',default='emulator-5554');p.add_argument('--name',required=True);a=p.parse_args()
 assert a.name.replace('-','').replace('_','').isalnum()
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=a.source,text=True).strip()==COMMIT
 assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=a.source,text=True).strip()
 adb=['adb','-s',a.serial]
 def shell(*args):return subprocess.check_output(adb+['shell',*args],text=True)
 OUT.mkdir(parents=True,exist_ok=True)
 shell('uiautomator','dump','/sdcard/samsun-review.xml')
 xml=shell('cat','/sdcard/samsun-review.xml');root=ET.fromstring(xml)
 (OUT/(a.name+'.xml')).write_text(xml)
 (OUT/(a.name+'.png')).write_bytes(subprocess.check_output(adb+['exec-out','screencap','-p']))
 ime=[x.strip() for x in shell('dumpsys','input_method').splitlines() if any(k in x for k in ['mInputShown','mIsInputViewShown','mShowRequested','mCurMethodId'])]
 nodes=[dict(text=n.get('text'),desc=n.get('content-desc'),cls=n.get('class'),bounds=n.get('bounds'),focused=n.get('focused')) for n in root.iter('node') if n.get('class') in ['android.widget.EditText','android.widget.ScrollView'] or n.get('content-desc','').startswith('이 장면 자막')]
 result=dict(name=a.name,commit=COMMIT,android=shell('getprop','ro.build.version.release').strip(),sdk=shell('getprop','ro.build.version.sdk').strip(),display=shell('wm','size').strip(),density=shell('wm','density').strip(),ime=ime,nodes=nodes)
 (OUT/(a.name+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
