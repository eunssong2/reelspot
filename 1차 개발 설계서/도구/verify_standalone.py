"""상위 기능명세/DayLog/APK 없이 패키지 복사본의 문서 재생성을 확인한다."""
from pathlib import Path
import tempfile,subprocess,shutil,json,os,hashlib,sys
ROOT=Path(__file__).resolve().parents[1]
def main():
    checks=[]
    with tempfile.TemporaryDirectory(prefix='atp-design-standalone-') as temp:
        isolated=Path(temp)/'package'
        shutil.copytree(ROOT,isolated,ignore=shutil.ignore_patterns('__pycache__','.venv'))
        assert not (isolated.parent/'기능 명세서').exists()
        assert not (isolated.parent/'1차 개발 코드').exists()
        digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
        before=digest(isolated/'근거/APK/실행검토.json')
        for tool in ['build_design.py','build_evidence.py']:
            result=subprocess.run([sys.executable,str(isolated/'도구'/tool)],cwd=isolated,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'},capture_output=True,text=True)
            checks.append({'check':tool+' 독립 실행','passed':result.returncode==0,'output':result.stdout[-800:],'error':result.stderr[-800:]})
        checks.append({'check':'실제 APK 관찰 이력 보존','passed':before==digest(isolated/'근거/APK/실행검토.json')})
        checks.append({'check':'기준 사본과 패키지 내부 참조','passed':(isolated/'기준/기능명세서.md').exists() and (isolated/'09 구현 계약 보완.docx').exists()})
    result={'scope':'상위 원본·DayLog·APK 없는 복사본에서 핵심 설계서와 기존 실행 근거 유지 확인. 앱 빌드/서버 실행 검수 아님.','passed':all(c['passed'] for c in checks),'checks':checks}
    (ROOT/'부록/독립 패키지 검증.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({'passed':result['passed'],'checks':len(checks)},ensure_ascii=False))
    assert result['passed'],checks
if __name__=='__main__':main()
