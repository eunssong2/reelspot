"""실행 중인 ReelSpot APK의 원본 PNG와 UI XML을 함께 보관한다."""
import subprocess, sys, json, hashlib, time
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ADB = ['adb', '-s', 'emulator-5554']
def cmd(*args):
    return subprocess.check_output(ADB + list(args))
def snapshot(name, action=''):
    dest = ROOT / '근거/APK'
    dest.mkdir(parents=True, exist_ok=True)
    time.sleep(1.2)
    for attempt in range(4):
        cmd('shell','rm','-f','/sdcard/reelspot-design.xml')
        result=cmd('shell', 'uiautomator', 'dump', '/sdcard/reelspot-design.xml')
        if b'dumped to' in result:
            break
        time.sleep(1)
    else:
        raise RuntimeError('UI XML capture failed; stale XML was not saved')
    xml = cmd('exec-out', 'cat', '/sdcard/reelspot-design.xml')
    png = cmd('exec-out', 'screencap', '-p')
    (dest / (name+'.xml')).write_bytes(xml)
    (dest / (name+'.png')).write_bytes(png)
    nodes = [{'text':n.get('text'), 'description':n.get('content-desc'), 'bounds':n.get('bounds')}
             for n in ET.fromstring(xml).iter('node') if n.get('text') or n.get('content-desc')]
    meta={'id':name, 'captured_at':datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
          'action':action,'sha256':hashlib.sha256(png).hexdigest(),'nodes':nodes}
    (dest / (name+'.json')).write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    print(json.dumps(meta, ensure_ascii=False, indent=2))
if __name__ == '__main__':
    snapshot(sys.argv[1], ' '.join(sys.argv[2:]))
