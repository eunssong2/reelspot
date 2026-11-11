"""11월 10일 QA 재검토에서 확인한 모순의 회귀 검사. 전체 의미 검토·앱 검수 아님."""
import json
import openpyxl
from openapi_spec_validator import validate


def check_review(root, check):
    screens = {s['id']: s for s in json.loads((root/'UI/화면데이터.json').read_text())}
    def notes(ui): return '\n'.join(screens[ui]['notes'])
    def rows(ui): return '\n'.join(t for _, t in screens[ui]['rows'])
    qa = openpyxl.load_workbook(root/'06 검수 및 추적.xlsx', data_only=True)
    cases = {r[0]: ' '.join(str(x or '') for x in r) for r in qa['기능검수'].iter_rows(min_row=2, values_only=True)}
    decisions = openpyxl.load_workbook(root/'07 결정 및 자료 차이.xlsx', data_only=True)
    questions = {r[0]: ' '.join(str(x or '') for x in r) for r in decisions['확인대기'].iter_rows(min_row=2, values_only=True)}
    policy = (root/'기준/기능명세서.md').read_text().split('<!-- 문서에 포함된 그림 데이터')[0]
    check('QA 재검토: 기록 메뉴 충돌과 수정 진입 제거',
          'N03' in questions['Q27'] and 'QA-04/05' in questions['Q27'] and
          '기존 메뉴 진입 임시 유지' in notes('UI18') and 'Q27' in rows('UI18') and
          all('정보 수정(UI20)·삭제' not in notes(ui) and '정보 수정 별도 진입은 Q24' in notes(ui) for ui in ['UI13','UI16']) and
          '본인 정보 수정(UI20)·삭제' not in notes('UI18'),
          'N03/QA-05 → Q27, UI13/16/18 정보 수정은 Q24 확인 대기')
    check('QA 재검토: 촬영 확인은 후보 담기·즉시 전송 미확정',
          all('Q28' in text and '후보' in text and '업로드하기' in text
              for text in [notes('UI15'),cases['TC-F12-01'],cases['TC-F14-07']]) and
          '확인 즉시 업로드' not in policy and 'N01' in questions['Q28'],
          'UI15·TC-F12-01·TC-F14-07 → Q28/N01; 사진/영상 같은 임시 흐름')
    check('QA 재검토: 설정 도식과 주석의 기존 진입 유지',
          all(term in rows('UI28') and term in notes('UI28') for term in ['동의 내역','신고 결과','저장 공간과 캐시']) and
          '철회' in notes('UI28') and 'TC-F28-05' in cases and 'TC-F25-04' in cases,
          'UI28/F28 기존 기능 유지, 구조 결정 Q26')
    check('QA 재검토: 휴대폰 저장 성공 문구 통일',
          '사진이 휴대폰에 저장되었습니다.' in notes('UI21') and
          '사진 2장·동영상 1개를 휴대폰에 저장했습니다.' in cases['TC-F19-01'] and
          all('{n}개를 저장했어요' not in t for t in [notes('UI21'),cases['TC-F19-01']]),
          '단일 사진과 혼합 성공 수의 메시지, 기기 쓰기 완료 기준')
    check('QA 재검토: 사진 선택 방식과 권한 질문 추적',
          all(x in questions['Q25'] for x in ['자체 갤러리','시스템 선택','권한','TC-F13-05']) and
          'Q25 임시안' in rows('UI14') and 'Q25' in cases['TC-F13-05'],
          '시스템 선택기 내부 UI 변경으로 확정하지 않음')
    check('QA 재검토: 장소 수정 헤더 방향·라벨 질문 추적',
          screens['UI50'].get('header_action') == '검색' and all('다른 장소로' not in t for k,t in screens['UI50']['rows'] if k=='link') and
          '검색 모드 헤더 다른 장소로→입력 폼' in notes('UI50') and
          '+ 스팟에 추가' in notes('UI50') and 'TC-F10-07' in questions['Q29'],
          'UI50 헤더 검색→검색 모드 / 다른 장소로→입력 폼, Q29 확인 대기')
    guide=' '.join(str(c.value or '') for row in decisions['읽기안내'] for c in row)
    arch=(root/'부록/열람용HTML/01 시스템 설계.html').read_text()
    contract=(root/'부록/열람용HTML/09 구현 계약 보완.html').read_text()
    check('QA 재검토: 현행 기준과 질문 범위',
          set(questions)=={f'Q{i}' for i in range(1,30)} and 'Q29' in guide and
          'D01~D35·Q1~Q29' in arch and '기준/기능명세서.md(v3.4, 2026-11-11' in contract and
          '기준/기능명세서.md(v3.3, 2026-11-05' not in contract,
          '현행 v3.4·D01~35·Q1~29; 날짜가 붙은 이전 개정 이력은 보존')
    observed=json.loads((root/'부록/브이로그서버계약_59aca32.json').read_text())
    validate(observed)
    operations={v['operationId'] for p in observed['paths'].values() for v in p.values()}
    main=json.loads((root/'부록/openapi.json').read_text())
    check('QA 재검토: 서버 브이로그 관찰 계약과 설계 미통합 구분',
          operations=={'vlogCreate','vlogGet','vlogCancel','vlogContent'} and
          observed['x-source']['commit'].startswith('59aca32') and
          observed['x-source']['execution']=='미실행' and
          '브이로그서버계약_59aca32.json' in main['info']['description'],
          '관찰 계약 OpenAPI 검증, 4개 operation; 서버 실행 결과 아님')
