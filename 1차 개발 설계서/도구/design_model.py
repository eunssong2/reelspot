"""편집 가능한 설계 데이터. 문서와 도형은 build_design.py로 다시 생성한다."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATE='2026-10-30'
# rows: 유형, 표시 문자열. 상세 동작은 notes에 번호 순서로 연결한다.
SCREENS=[]
def screen(id,title,features,role,rows,notes,states,api,reference=None):
    SCREENS.append(dict(id=id,title=title,features=features.split(),role=role,rows=rows,
        notes=notes,states=states,api=api.split(),reference=reference))
screen('UI01','시작과 로그인','F01','로그인 전',[
 ('brand','At that place'),('lead','함께한 순간을\n한곳에 모아요'),('hint','모임의 일정별로 사진과 영상을 함께 보관해요.'),
 ('yellow','① 카카오로 시작하기'),('button','② Google로 시작하기'),('link','이용약관  ·  개인정보처리방침')],
 ['① 카카오톡 이용 불가 시 카카오계정 웹 인증으로 전환한다.','② 공급자 식별값으로 로그인하며 이메일로 계정을 합치지 않는다.','초대 진입 경로와 미완료 작업을 보존한다. 신규 가입이면 UI02, 기존이면 UI03 또는 UI24로 이동한다.'],
 '세션 복원 중에는 스플래시 유지 / 인증 취소는 이전 상태 / 오프라인·인증 실패·서비스 장애를 구분', 'authExchange sessionRefresh')
screen('UI02','가입 동의와 표시명','F02','최초 가입자',[
 ('lead','처음 오셨네요'),('hint','문서를 읽고 필요한 항목에 동의해 주세요.'),('row','① [ ] 이용약관 동의   필수  >'),('row','① [ ] 개인정보 안내   필수  >'),('row','① [ ] 선택 항목 동의  >'),('field','② 표시명  |  지민'),('hint','중복 표시명도 사용할 수 있어요. 최대 20자'),('button','동의하고 시작하기')],
 ['① 항목별 문서와 버전을 열람한다. 실제 동의 항목·문구는 운영 문서 확정 후 적용한다.','② NFC 정규화와 앞뒤 공백 제거 후 사용자 인식 문자 1~20자. 소셜 이름은 제안값이다.','필수 미동의 시 제출 비활성, 선택 거부로 가입을 막지 않는다. 사진 프로필 입력은 제공하지 않는다.'],
 '필수 미선택 / 표시명 공백·21자 / 문서 로딩 실패 / 검사 중·거부 / 초대 복귀', 'onboard consentDocs')
screen('UI03','내 모임','F03 F21 F28','로그인한 사용자',[
 ('lead','함께하는 모임'),('hint','① 최근 공동 활동순'),('card','② 주말 산책 모임\n6/10명 · 진행 중: 우리의 서울 여행'),('banner','보관 안내  ·  만료 7일 전 기록이 있어요'),('card','대학 동기 모임\n4/10명 · 다음 일정: 성수 당일치기'),('button','③ 모임 만들기'),('outline','④ 초대 코드로 참여'),('nav','모임  |  내 기록  |  마이페이지')],
 ['① 열람은 활동 시각을 갱신하지 않는다. 동률은 생성시각·ID 역순이다.','② 카드 → UI05 모임 달력. 일정 요약은 진행 중→가까운 미래→최근 과거이며 취소는 제외한다.','③ 첫 일정을 포함해 UI04에서 생성. ④ UI24 코드 입력. 종료한 모임은 공동 상세로 열지 않는다.'],
 '로딩 / 모임 없음과 조회 실패 구분 / 30개 커서 / 활성 100개·방장 생성 20개 한도', 'groupsList groupCreate', '01-entry')
screen('UI04','모임과 첫 일정 생성','F03 F07','로그인한 사용자',[
 ('field','① 모임 이름  |  주말 산책 모임'),('field','② 첫 일정 제목  |  우리의 서울 여행'),('field','③ 시작 날짜  2026.10.17'),('field','③ 종료 날짜  2026.10.19'),('hint','④ 시간은 장소를 추가할 때 입력해요.\n반복 설정은 없어요. 필요하면 일정을 더 추가해요.'),('hint','한국 시간 · 최대 10명 · 정원 변경 없음'),('button','⑤ 모임과 첫 일정 만들기')],
 ['① 모임 이름 1~50자, ② 일정 제목 1~100자. 공개 전 텍스트 검사를 수행한다.','③ 날짜만 입력한다(종일/시간 지정 없음). 종료 날짜 포함 366일 이내, 과거 날짜 허용. ④ 예정 시각은 UI10/UI11에서 방문별로 입력하고 UI08에 표시한다.','⑤ 모임·방장 참여·첫 일정은 하나의 트랜잭션으로 생성한다. 재시도에는 같은 요청 키를 사용한다.'],
 '필수 누락 / 날짜 역전·367일 / 검사 대기 / 결과 확인 필요', 'groupCreate')
screen('UI05','모임 달력','F06 F07 F08 F11','현재 참여자',[
 ('lead','주말 산책 모임'),('row','① <   2026년 10월   >    오늘'),('calendar','2026년 10월'),('row','② 10월 17일 일정'),('card','우리의 서울 여행\n10.17–10.19 · 장소 3곳'),('row','③ 달력 / 일정 목록  ·  초대·관리 >'),('button','④ 일정 추가')],
 ['① 월~일 시작. 날짜 셀 최대 3개와 +N을 표시하고 날짜 탭으로 전체 일정을 연다.','② 일정 탭 → UI08로 바로 이동. 날짜를 별도 공간으로 생성하지 않는다. 취소 일정은 표시를 유지한다.','③ 초대·관리에서 모든 현재 참여자가 UI23에 진입한다. 보기 방식은 기기에 보관한다. ④ 현재 방장만 UI06에서 일정을 수동 추가한다. 반복 생성은 없다. 뒤로 오면 월·선택·스크롤을 복원한다.'],
 '달력 로딩 / 일정 없음 / 월 조회 실패 / 같은 날 4개 이상 / 여러 날 일정의 모든 셀 표시 / 날짜 요청 범위 366일', 'calendar scheduleDelete')
screen('UI06','일정 추가와 변경','F07 F08 F11','현재 방장',[
 ('field','① 제목  |  우리의 서울 여행'),('field','② 시작 2026.10.17  /  종료 2026.10.19'),('hint','시간은 각 장소에서 입력해요 · 반복 없음'),('banner','최초 기록 완료 후 보관 기한은 바뀌지 않아요'),('card','③ 기간을 줄이면 기간 밖이 되는 기록 2개 · 방문 1개\n삭제되지 않고 기간 밖 구역에 남아요'),('button','저장'),('link','④ 일정 취소(기록 보존)  ·  빈 일정 삭제')],
 ['① 제목 100자. ② 날짜만 입력하며 시작 ≤ 종료, 포함 366일. 겹치는 일정은 안내 후 허용한다.','③ 변경 저장 전에 기간 밖이 될 방문·기록 수를 서버가 계산해 확인받는다. 기록은 삭제되지 않고 기간 밖 구역에 유지된다.','④ 기록·업로드가 있으면 삭제 불가이며 취소로 전환한다. 취소 후 신규 촬영·접수는 금지한다. 빈 일정만 완전 삭제한다.'],
 '기간 밖 기록 확인 / 버전 충돌과 입력 보존 / 기록 있는 삭제 거부 / 취소 재활성 거부 / 미저장 이탈 확인', 'scheduleCreate scheduleUpdate scheduleCancel scheduleDelete')
screen('UI08','일정 전체 계획과 기록','F06 F09 F16 F21','현재 참여자',[
 ('lead','우리의 서울 여행'),('hint','10.17–10.19 · 한국 시간'),('banner','① 보관 마지막 날 2027.01.19'),('row','② 전체  |  10.17  |  10.18  |  10.19'),('row','③ 장소 계획  |  공동 기록'),('card','10.17 서울에서 만나는 날 · 장소 3/15\n10:00 성수 카페 · 사진 6 / 영상 2'),('card','④ 장소 미지정 기록  ·  사진 3'),('outline','⑤ 장소 추가'),('button','⑥ 사진·영상 올리기')],
 ['① 완료 전 예상, 첫 완료 후 고정 기한으로 표시한다. 기한 예시는 2026.10.19 종료에 대응한다.','② 전체가 기본이며 날짜는 필터다. ③ 장소 계획은 방문일별 순서·예정 시각(미입력은 시간 미정)·장소별 개수를 표시한다. 일정에는 시각이 없다.','④ 미지정도 업로드 가능. ⑤ UI10, 날짜별 15개 도달 시 비활성과 사유 표시. ⑥ UI14. 취소·만료 시 새 업로드를 막고 이유를 표시한다.'],
 '빈 일정 / 전체·날짜 필터 / 기간 밖 기록 구역 / 장소 15개 도달 / 취소 / 만료 / 권한 상실', 'scheduleDetail mediaList', '02-schedule')
screen('UI09','공동 기록과 보기 방식','F16 F17 F19','현재 참여자',[
 ('row','① 전체 날짜  >  ·  전체 장소  >'),('row','② 시간순 ✓  ·  사람별 묶음     오래된순 ↕'),('photo','③ 지민 · 사진\n촬영 10.17 11:08 · 성수 로스터리 카페'),('row','함께 마신 커피'),('photo','수현 · 영상 00:03\n업로드 10.17 12:40 · 장소 미지정'),('hint','④ 길게 누르면 여러 장을 골라 저장할 수 있어요'),('button','사진·영상 올리기')],
 ['① 날짜·방문·장소 미지정 필터. 목록 60개 커서. 카드 하나는 파일 하나다. 기간 밖 기록도 전체 목록에 표시한다.','② 시간순은 촬영 시각 기준(없으면 업로드 완료 시각, 카드에 표시), 오름차순 기본. 사람별 묶음은 작성자 구역으로 묶고 구역 안은 시간순이다. 보기 방식은 기기에 기억한다.','③ 카드 → UI18. ④ 길게 누르기 또는 선택 버튼 → UI16 선택 모드(저장·본인 수정·본인 삭제). 차단한 작성자는 목록·구역에서 제외한다.'],
 '로딩·빈 필터 / 페이지 오류 / 촬영 시각 없음 / 차단·운영제한 집계 반영 / 후속 파일 부분 완료', 'mediaList', '04-place')
screen('UI10','장소 검색과 지도','F09','현재 참여자',[
 ('field','① 장소명 또는 주소  |  성수 카페'),('row','전체 · 관광지 · 맛집 · 카페✓ · 숙소'),('map','② 이 영역에서 검색'),('row','③ 관련도순  /  거리순  ·  현재 위치'),('card','④ 성수 로스터리 카페\n서울 성동구 … · 지도 중심에서 350m'),('row','방문일 2026.10.17  ·  예정 시각 10:00 (미정 가능)'),('hint','이 날짜 장소 3/15'),('button','⑤ 이 장소 추가'),('link','검색에 없나요? 직접 등록')],
 ['① 국내 카카오맵 데이터 사용. 늦은 이전 응답은 버린다. 검색어 100자.','② 지도 이동 후 명시적 재검색. 기본은 일정 첫 좌표 방문→기기 마지막 영역→서울시청이다.','③ 현재 위치 버튼 때만 권한 요청. ⑤ 예정 시각은 5분 단위 또는 미정. 같은 일정·방문일·동일 공급자 장소 중복 금지, 날짜별 15개 초과 거부. 저장 뒤 UI08로 돌아간다.'],
 '검색 전 / 결과 없음 / 공급자 오류 / 위치 거절·실패 / 중복 방문 / 장소 15개 도달 / 저장 충돌', 'placesSearch visitCreate', '07-place-search')
screen('UI11','장소 직접 등록','F09','현재 참여자',[
 ('field','① 장소 이름  |  우리만의 피크닉 자리'),('field','주소 (선택)  |  입력하지 않음'),('map','② 지도에서 핀 지정 (선택)'),('row','방문일  |  2026.10.17  ·  예정 시각  |  미정'),('hint','등록한 장소는 이 모임 안에서만 사용해요. 이 날짜 장소 3/15'),('button','③ 장소 등록')],
 ['① 이름 1~100자, 주소 200자. 좌표 없는 등록을 허용하며 지도 마커·거리를 만들지 않는다.','② 좌표 비교는 소수점 6자리. 이름·주소 앞뒤·연속 공백 정리 후 세 값이 같으면 중복이다.','③ 방문일 마지막 순서에 추가한다. 예정 시각은 선택 입력(미정 허용)이며 날짜별 15개를 넘으면 거부한다. 공급자 원장에 게시하지 않는다.'],
 '이름 없음 / 좌표 없음 / 동일 수기 정보 중복 / 장소 15개 도달 / 검사 거부 / 재전송 중복 방지', 'visitCreate')
screen('UI12','방문 계획 편집','F10 F11','현재 참여자',[
 ('field','① 날짜 제목  |  서울에서 만나는 날'),('hint','10월 17일 · ② 끌어서 순서 변경'),('card','≡  성수 로스터리 카페\n③ 예정 시각 10:00  >'),('card','≡  서울숲\n③ 예정 시각 미입력  >'),('card','≡  한강공원\n③ 예정 시각 15:00  >'),('outline','④ 빈 방문 삭제'),('button','⑤ 계획 저장')],
 ['① 날짜 제목 30자, 비우면 날짜 표시. 날짜 전체 메모는 없다.','② 드래그 외에 위/아래 이동 버튼도 제공한다. 시각 변경으로 자동 재정렬하지 않는다.','③ 5분 단위/미입력 허용, 시각순 정렬 버튼은 눌렀을 때만 재정렬. 편집으로 방문을 추가하지 않으므로 15개 한도는 UI10/11에서 검사. ④ 숨긴 파일·업로드도 서버에서 검사한다. ⑤ 순서·시각·제목과 버전을 함께 저장한다.'],
 '순서 중복·누락 / 타 날짜 혼입 / 버전 충돌 / 미저장 이탈: 저장·버리기·계속', 'planUpdate visitDelete', '09-plan')
screen('UI13','방문별 기록','F09 F14 F16','현재 참여자',[
 ('lead','성수 로스터리 카페'),('hint','10.17 · 예정 10:00 · 서울 성동구 …'),('row','① 사진 6  ·  영상 2   /   시간순  ·  사람별 묶음 ✓'),('card','지민  ·  사진 3 · 영상 1   ▾'),('photo','지민 · 사진\n촬영 10.17 11:08 · 커피와 함께 시작한 하루'),('card','수현  ·  사진 3 · 영상 1   ▸'),('hint','② 내가 올릴 수 있는 수  사진 2/5 · 영상 1/2'),('button','이 장소에 기록 올리기')],
 ['① 현재 사용자가 볼 수 있는 완료 파일만 집계한다. 차단·운영 제한·삭제·만료를 제외한다. 사람별 묶음은 작성자 구역(먼저 완료한 작성자부터)·접기/펼치기, 시간순은 촬영 시각 기준이다.','② 작성자별 이 방문의 한도(사진 5·영상 2)에서 완료+진행 중 작업을 뺀 남은 수. 0이면 올리기 버튼에 사유를 표시한다.','올리기 → UI14. UI16에서 방문일을 제안하고 사용자가 확인한다. 다른 날짜로 바꾸면 방문을 해제·재선택한다.'],
 '기록 없음 / 파일 검사 중 / 장소 좌표 없음 / 남은 개수 0 / 방문 삭제 충돌', 'mediaList', '04-place')
screen('UI14','기록 추가 방식','F12 F13 F14','현재 참여자',[
 ('lead','어떤 순간을 남길까요?'),('hint','우리의 서울 여행 · 10.17'),('card','① 기기 사진·영상 가져오기\n시스템 선택기로 필요한 파일만'),('card','② 사진 찍기\n촬영 후 확인하고 사용해요'),('card','③ 짧은 영상 찍기\n기본 3초 · 최대 5초'),('hint','촬영·가져오기 합계 최대 120개 · 장소마다 사진 5·영상 2'),('outline','닫기')],
 ['① Photo Picker 우선, 불가 시 문서 선택기. 전체 앨범 권한을 강제하지 않는다.','②·③ 카메라 권한을 필요한 시점에 요청한다. 취소 일정이면 진입 전 신규 작업을 막는다.','촬영·기기 파일 혼합 후보를 같은 제출에 넣고 최초 선택 순서를 유지한다.'],
 '선택 취소 / 121번째 후보 / 권한 거절 / 파일 접근 소실 / 클라우드 다운로드 실패', 'uploadPrepare', '06-media-source')
screen('UI15','사진과 짧은 영상 촬영','F12','현재 참여자',[
 ('camera','① 카메라 미리보기'),('row','사진  /  영상✓     전후면 전환'),('row','② 1초  2초  3초✓  4초  5초'),('hint','③ 마이크 꺼짐 · 무음 영상'),('button','④ 녹화 시작'),('outline','취소')],
 ['① 후면 기본. 영상 최대1080p/30fps, 미지원720p. 촬영 전만 전후면 전환 가능하다.','② 기본3초, 기기 마지막 정수1~5초 기억. 자동 종료 ±0.25초, 조기 종료는 0.5초 이상.','③ 마이크 거절이어도 무음 촬영 허용. ④ 녹화 중 정지 버튼. 결과 확인·재촬영·사용, 앱 전환/전화 뒤 유효성 확인.'],
 '카메라 거절 / 녹화 중 / 결과 확인 / 0.5초 미만 / 저장공간 부족 / 권한 회수', 'uploadPrepare')
screen('UI16','파일 선택과 업로드 확인','F13 F14 F17 F18 F19','현재 참여자 또는 본인 기록 경로',[
 ('lead','① 3개 선택됨 / 120'),('row','② 불러온 항목 모두 선택  ·  해제  ·  + 추가'),('photo','✓ 1번 사진      ✓ 2번 영상 00:03\n✓ 3번 사진      □ 4번 사진'),('field','③ 기록일  |  2026.10.17'),('row','④ 방문  |  성수 로스터리 카페 >   사진 2/5 · 영상 1/2'),('field','⑤ 설명  |  함께 마신 커피'),('hint','위치 태그를 제거하고 검사 후 공개해요.'),('button','⑥ 3개 업로드   /   저장 · 수정 · 삭제')],
 ['① 업로드 전 후보 선택과 기존 기록의 다중 선택이 같은 화면이다(이전 UI19 통합). 길게 누르기 또는 선택 버튼으로 진입하며 최대120개, 불러오지 않은 파일은 자동 선택하지 않는다. 묶음 전체 선택을 지원한다.','③~⑤ 업로드 맥락: 파일별 기록일(일정 범위 안, 단일일 자동·다일은 오늘/시작일 제안)·방문(방문일=기록일, 미지정 허용)·설명 1000자. 선택한 파일에 기록일·방문을 일괄 지정할 수 있다. 방문별 남은 개수를 보여 주고 초과 파일은 제출 전에 표시하며 서버가 파일별로 거부한다.','⑥ 기존 기록 맥락: 저장은 조회 가능한 타인 파일도 가능, 수정은 같은 일정 본인 파일만(UI20), 삭제는 본인만. 타인 혼합이면 수정/삭제 비활성 이유를 표시하고 서버도 거부한다. 본인 보존 경로(UI22)는 삭제만 제공한다.'],
 '사진50MB·100MP / 영상200MB·60초 / 0개·121개 / 방문일 불일치 / 사진5·영상2 초과 / 타인 혼합 / 선택 중 파일 삭제·만료 / 기한 경과', 'uploadPrepare metadataPatch mediaDelete exportCreate', '05-upload')
screen('UI17','파일 전송 상태','F15 F20 F26','업로드 작성자',[
 ('lead','순간을 모으는 중이에요'),('card','① 1번 사진  ·  완료 ✓'),('card','② 2번 영상  ·  서버 확인 중\n전송 100% · 위치 제거·검사 진행'),('card','③ 3번 사진  ·  실패\n네트워크 연결 확인  /  재시도'),('card','④ 4번 영상  ·  검토 대기\n아직 공개되지 않았어요  /  문의'),('outline','실패 파일만 다시 시도'),('link','미완료 작업 취소  ·  닫기')],
 ['① 완료 파일만 공동 목록 반영. ② 전송100%는 완료가 아니다. 검토 대기는 비공개다.','③ 파일별1·2·4초 최대3회 자동 재시도. 오프라인 대기는 횟수 미소모, 동시3개.','취소 이전 서버 접수한 같은 파일은 일정 취소 후에도 재시도 가능. 권한 소멸·종료·만료·사용자 취소가 우선한다.'],
 '준비·대기 / 전송 / 서버 확인 / 검토 / 완료 / 실패 / 취소 / 결과 확인 필요', 'uploadGet uploadRetry uploadCancel uploadCommit')
screen('UI18','사진 감상과 영상 재생','F16 F17 F18 F19 F25','현재 참여자 또는 본인 보존 경로',[
 ('photo','① 사진 확대 / 영상 재생·탐색'),('row','② 지민  ·  촬영 10.17 11:08'),('row','기록일 10.17 · 성수 로스터리 카페'),('hint','함께 마신 커피 · 업로드 10.17 12:40'),('banner','보관 마지막 날 2027.01.19'),('outline','③ 휴대폰에 저장'),('row','④ 정보 수정  ·  삭제  ·  신고')],
 ['① 닫으면 영상·소리를 중단하고 목록 위치를 복원한다. ② 촬영 시각이 없으면 업로드 시각만 표시한다.','③ 현재 참여 중이며 조회 가능한 파일만 저장. 다른 앱 공유 버튼은 없다. 나간 뒤 본인 경로는 열람·삭제만 허용한다.','④ 수정은 현재 참여 중 본인 파일만, 삭제는 본인만. 방장도 타인 파일 수정·삭제 불가. 타인 신고·차단은 UI31로 연결한다.'],
 '재생 통신·형식 오류 / 만료 / 삭제 / 퇴장 / 운영 제한 / 보존 경로에서는 저장 숨김', 'mediaStream metadataPatch mediaDelete reportCreate exportCreate', '04-place')
screen('UI20','본인 기록 일괄 수정','F17','현재 참여 중인 작성자',[
 ('lead','① 내 기록 3개 수정'),('row','② [✓] 설명 적용   /   [ ] 유지'),('field','설명 | 함께한 산책  [설명 비우기]'),('row','[✓] 기록일 적용   2026.10.18 >'),('row','[✓] 방문 적용  |  장소 미지정 >'),('banner','③ 변경할 필드와 3개 대상을 확인해요'),('outline','변경 내용 확인'),('button','④ 3개에 함께 적용')],
 ['② 필드별 적용/유지, 빈 문자열·방문 해제는 명시적 동작이다. 날짜 변경으로 기존 방문이 안 맞으면 해제·재선택한다.','③ 본인·같은 모임/일정·120개·버전·대상 방문의 사진5/영상2 한도 검증. 설명 검사 중에는 기존 공개 내용을 유지한다.','④ 검사를 통과한 뒤 재검증하여 전체 원자 적용. 하나라도 오류면 전체 미적용과 대상별 이유·입력을 유지한다.'],
 '필드 미선택 / 다른 일정 혼입 / 대상 방문 한도 초과 / 검사 중·거부 / 버전 충돌 / 일부 적용 금지', 'metadataPatch')
screen('UI21','휴대폰 저장','F19 F20','현재 참여자',[
 ('lead','선택한 기록 3개'),('card','① 사진 2개  ·  영상 1개\n위치 정보를 제거한 파일로 준비해요'),('row','② 파일 준비 중  2/3'),('button','③ 휴대폰에 저장'),('hint','Pictures/At that place\nMovies/At that place'),('hint','④ 다른 앱으로 보내는 기능은 제공하지 않아요.\n기기의 원본을 덮어쓰지 않아요.')],
 ['① 원래 해상도의 위치 제거 저장본 우선. 지원 불가 시 호환본과 변환 여부 안내. UI16 선택 모드 또는 UI18에서 진입한다.','③ 내려받기와 기기 쓰기를 구분하고 성공 뒤 경로 표시. 부분 성공이면 실패만 재시도한다. 임시 파일은 기기 쓰기 후 정리한다.','④ OS 공유창·외부 앱 전달은 1차 범위에서 제거했다(2026-10-20 회의). 저장 요청은 purpose=save만 허용한다.'],
 '준비 / 다운로드 / 기기 쓰기 / 부분 실패 / 공간 부족 / 권한 변경', 'exportCreate exportGet exportFile')
screen('UI22','내가 올린 기록','F18 F21','로그인한 작성자',[
 ('row','① 전체 모임 >  ·  기한순 >  ·  선택'),('card','주말 산책 · 우리의 서울 여행\n참여 중 · 2027.01.19까지'),('photo','지민 · 사진  /  영상 00:03'),('card','② 이전 모임 · 바다 여행\n참여 종료 · 본인 조회·삭제 가능'),('photo','지민 · 사진'),('hint','③ 참여 종료 후 새 저장은 할 수 없어요.'),('outline','선택한 내 서버 기록 삭제')],
 ['① 활성 참여·빈자리·초대를 요구하지 않는다. 종료 모임의 본인 보존 파일도 최소 정보와 함께 표시한다.','② 타인 파일·공동 계획·참여자 목록을 노출하지 않는다. 본인 확대/재생/삭제만 가능하다.','삭제는 최대120개·다른 모임 혼합 허용. 사전 권한 오류는 전체 거부, 실행 결과는 파일별 성공·실패·이미삭제로 표시한다.'],
 '참여 중·종료 / 만료 상태30일·설명 숨김 / 파일별 삭제 실패 / 이미 삭제 멱등 성공', 'mineList mediaDelete')
screen('UI23','초대 발급과 관리','F05','모든 현재 참여자(방장 포함)',[
 ('lead','모임에 초대하기'),('hint','현재 6/10명 · 초대는 7일 · 확인 50회까지'),('card','① 초대 코드  Q7KM2P8R\n10.17 12:00 발급 → 10.24 12:00 만료 · 확인 12/50'),('outline','② 링크 복사   /   OS 공유'),('row','③ 이 초대 취소'),('card','이전 초대  H5TW8C2N\n10.16 발급 · 소진 50/50  ·  취소'),('hint','받은 사람이 다른 사람에게 전달하면 그 사람도 참여할 수 있어요.'),('button','④ 새 초대 발급')],
 ['모든 현재 참여자가 같은 모임의 초대를 조회·발급·공유·복사·취소한다. 발급자 본인 여부는 관리 권한의 기준이 아니다. 참여 종료·모임 종료·이용 제한은 서버가 재검증한다.','코드 길이8자는 기술 설계안이며 기능명세의 고정 정책이 아니다. 만료는 서버 발급시각+168시간, 확인 횟수는 서버가 그 초대로 미리보기를 응답한 수이며 50회에 소진된다.','② 모임명·요약·링크·코드만 공유. 공유 취소는 초대 취소가 아니다. 상태는 사용 가능·소진·만료·취소로 구분한다.','④ 새 발급은 기존 초대를 유지하고 횟수는 0부터 시작한다. 같은 요청 재시도는 동일 초대. 참여 확정은 횟수를 소모하지 않으며 소진·취소는 기존 참여자에게 영향이 없다.'],
 '발급 실패·결과 불명 / 취소·만료·소진 / 정원10명 / 일반 참여자 동일 권한 / 비참여·탈퇴·퇴장·이용 제한 거부', 'invitesList inviteCreate inviteRevoke')
screen('UI24','초대 확인과 참여','F01 F05','초대받은 사용자',[
 ('field','① 초대 코드  |  Q7KM2P8R'),('card','② 주말 산책 모임\n우리의 서울 여행 · 10.17–10.19'),('hint','참여 후에 장소와 기록을 볼 수 있어요.'),('button','③ 로그인하고 참여 계속하기'),('outline','④ 참여하기'),('hint','확인한 내용은 로그인 뒤에도 유지돼요. 초대는 7일 · 확인 50회까지')],
 ['② 비로그인 미리보기는 모임명·일정 요약만 공개한다. 대표 사진·참여자·기록·장소 목록은 공개하지 않는다.','③ 인증/가입 뒤 같은 초대 확인으로 복귀한다. 로그인 성공만으로 자동 참여시키지 않는다. 복귀 시 앱이 보관한 확인 결과를 쓰고 확인 횟수를 추가하지 않는다.','④ 확정 시 유효성·정원·차단·활성100모임·이용제한을 재검증한다. 이미 참여했으면 인원 증가 없이 UI05로 이동한다.'],
 '잘못된 코드 / 로그인 전·후 / 만료 / 소진(50회) / 취소 / 정원 초과 / 차단 / 종료 모임 / 이미 참여', 'invitePreview inviteJoin')
screen('UI25','모임 정보 변경','F04','현재 방장',[
 ('photo','① 대표 사진  ·  16:9'),('outline','사진 선택  /  기본 이미지로 복원'),('field','② 모임 이름  |  주말 산책 모임'),('hint','대표 사진 긴 변 1600px 이하 · 저장본 5MB 이하'),('hint','③ 위치 태그 제거·콘텐츠 검사 후 반영해요.'),('button','변경 저장')],
 ['① 사진 한 장 선택·미리보기·교체. 일반 기록 파일에 대표사진 한도를 적용하지 않는다.','② 공백만 금지·50자. 최신 버전과 현재 방장 확인. 새 초대 정보에 변경 이름을 반영한다.','③ 취소·변환·전송·검사 실패·동시 충돌 시 기존 공개 정보와 입력을 유지한다.'],
 '기본 이미지 / 사진 선택·검사 중 / 검사 거부 / 버전 충돌 / 일반 참여자 거부', 'groupUpdate coverPrepare')
screen('UI26','참여자와 역할 관리','F22 F25','현재 참여자·방장',[
 ('lead','함께하는 사람 6/10'),('row','지민  ·  방장   (나)'),('row','① 수현  ·  참여자     더보기 >'),('row','민서  ·  참여자        더보기 >'),('outline','② 방장 이전'),('outline','③ 재참여 차단 목록'),('link','신고 · 개인 차단  /  모임 나가기')],
 ['목록에는 표시명·방장 표시만 제공한다. 소셜 식별값·연락처는 표시하지 않는다.','① 방장은 타인 퇴장과 모임별 재참여 차단을 함께 처리한다. 완료 파일과 본인 조회/삭제 권한은 유지한다.','② 즉시 이전이며 수락 대기 없음. ③ 방장만 차단 해제, 해제는 자동 재가입이 아니다. 개인 차단은 별도 UI31이다.'],
 '일반 참여자는 이전·퇴장 버튼 없음 / 대상이 나감 / 이전 충돌 / 오래된 퇴장 재시도', 'membersList ownerTransfer memberRemove reentryUnblock')
screen('UI27','모임 나가기와 종료','F22 F23','현재 참여자·방장',[
 ('lead','① 모임을 나가시겠어요?'),('card','올린 기록은 표시된 기한까지 유지돼요.\n본인 기록은 나간 뒤에도 조회·삭제 가능해요.'),('hint','나간 뒤 새 저장·정보 수정은 불가해요.'),('row','② 방장인 경우 후임 선택 >'),('banner','③ 혼자 남은 방장은 모임 종료와\n본인 서버 기록 삭제를 확인해 주세요.'),('button','④ 확인하고 나가기'),('outline','돌아가기')],
 ['② 다른 참여자가 있으면 방장 이전 성공을 먼저 확인한다. 방장인 채 나가기는 거부한다.','③ 마지막1명일 때만 종료. 타인 유효 파일은 기한까지 본인 조회/삭제용 보존한다. 모임은 재개 불가다.','④ 새 참여·역할 이전과 직렬화하여 종료 가능 여부를 재검증한다. 파일·계정 삭제 우선 규칙을 적용한다.'],
 '일반 나가기 / 방장 후임 필요 / 마지막 방장 / 동시 참여로 종료 거부 / 정리 실패 추적', 'groupLeave groupClose')
screen('UI28','설정과 문의','F02 F18 F24 F28','로그인한 본인',[
 ('row','① 표시명  지민  >'),('row','내가 올린 기록  >'),('row','로그인 수단 관리  >'),('row','② 약관·개인정보·동의 내역  >'),('row','③ 저장 공간과 캐시  >'),('row','차단 목록 · 신고 결과 · 문의  >'),('outline','④ 로그아웃'),('link','계정 삭제')],
 ['① 표시명 변경은 작성자 표시에도 반영하되 소유ID는 유지한다. 사진 프로필 설정은 없다.','② 문서버전·선택시각·변경·철회를 조회한다. 선택 동의는 변경 가능, 필수 철회는 계정 삭제로 연결한다.','④ 진행 업로드가 있으면 작업확인/중단 후 로그아웃/돌아가기. 실제 공개 문의 연락처는 배포 전에 설정한다.'],
 '문의 식별값 / 세션 만료 / 업로드 중 로그아웃 / 다른 계정 캐시 분리 / 필수 재동의', 'profilePatch consentDocs consentUpdate logout inquiryCreate')
screen('UI29','로그인 수단 연결','F01','재인증한 본인',[
 ('lead','로그인 수단'),('card','① 카카오  ·  연결됨'),('card','② Google  ·  연결하기 >'),('hint','같은 이메일이어도 자동 연결하지 않아요.'),('outline','③ 본인 재인증'),('link','연결 해제')],
 ['② 본인 재인증과 새 공급자 인증 둘 다 필요. 공급자 subject가 다른 앱 계정 소유이면 거부한다.','③ 세션 소유자와 최근 재인증을 확인하고 명시적 연결만 수행한다. 기존 두 계정 데이터 병합은 없다.','마지막 로그인 수단 해제는 거부한다. 공급자 토큰·비밀값을 화면과 로그에 노출하지 않는다.'],
 '연결 성공 / 다른 계정 사용 중 / 마지막 수단 해제 거부 / 재인증 만료 / 사용자 취소', 'identityLink identityUnlink')
screen('UI30','계정 삭제','F24 F02','재인증한 본인',[
 ('lead','계정을 삭제하기 전에'),('card','① 방장 역할 정리 필요 2개\n산책 모임: 방장 이전 >\n혼자 있는 모임: 종료와 본인 기록 삭제 >'),('hint','② 모든 모임의 내 서버 기록이 삭제돼요.\n나간 모임·종료 모임도 포함해요.'),('hint','타인 기록·기기 원본·외부 사본은 유지돼요.'),('row','[ ] 삭제 결과를 확인했어요'),('button','③ 본인 확인 후 계정 삭제')],
 ['① 방장 역할 정리가 하나라도 남으면 서버에서 거부한다. 자동 후임 선임은 하지 않는다.','② 조회 목록이 아닌 작성자ID로 전체 파일을 찾고 계정 접근·업로드·완료부터 차단한다.','③ 삭제 직전 역할 수신/신규 모임을 다시 검증한다. 조회 차단과 물리정리 진행 상태를 분리한다.'],
 '역할 정리 필요 / 재인증 / 동시 역할 수신 / 삭제 접수·정리 중 / 결과 불명', 'accountDelete')
screen('UI31','신고와 개인 차단','F25 F26','현재 참여자',[
 ('row','① 신고 대상  |  수현의 사진'),('field','사유  |  내용을 입력해 주세요'),('button','② 신고 접수'),('outline','③ 이 사용자의 기록 숨기기'),('card','내 신고 결과\n검토 중 · 문의용 번호 RPT-2026-…'),('link','차단 목록  /  조치 이의 문의')],
 ['① 파일·대표 사진·참여자를 신고하며 사유2000자와 최소 증거를 연결한다.','② 신고만으로 자동 삭제하지 않는다. 최초24시간, 이의3영업일 검토 기준을 적용한다.','③ 개인 차단은 내 공동 목록·집계·저장/공유·직접경로에만 적용한다. 방장 역할·타인 화면·기한을 바꾸지 않는다.'],
 '신고 중복 / 검토·조치·미조치 / 차단·해제 / 서비스 제한 중 문의·삭제 경로', 'reportCreate reportsMine blockCreate blockDelete inquiryCreate')
screen('UI32','방장 부재 복구 문의','F27','현재 참여자',[
 ('lead','방장 부재 복구 요청'),('field','① 부재 사유와 최소 확인 자료'),('row','② 후임 후보  |  수현 >'),('hint','후임의 별도 동의와 본인 확인이 필요해요.'),('banner','③ 기존 방장에게 통지하고 7일간\n응답을 기다린 뒤 담당자가 검토해요.'),('button','④ 복구 검토 요청'),('card','처리 상태  접수 → 확인 → 통지 → 검토')],
 ['④ 접수만으로 역할 변경하지 않는다. 요청자 재인증·참여이력·후임 의사·부재 근거를 확인한다.','③ 앱 내 계정 알림과 동의한 보조 연락수단에 통지한다. 7일 경과만으로 자동 승인하지 않는다.','운영자가 실행 직전 현재 방장·후임·모임상태·버전을 확인한다. 종료 모임 재개 불가, 분쟁/증거부족은 보류한다.'],
 '자료 부족 / 통지·응답 대기 / 이의·보류 / 직접 이전으로 오래된 승인 무효 / 승인·거절', 'recoveryCreate recoveryGet')
screen('UI33','저장 공간과 캐시','F28','로그인한 본인·모임 참여자',[
 ('lead','저장 공간'),('card','① 모임 원본  1.2GB / 5GB\n전송 예약 0.1GB · 남은 용량 3.7GB'),('card','② 기기 재생 캐시 210MB / 최대500MB'),('card','③ 미완료 업로드 임시 파일 80MB\n업로드가 끝날 때까지 별도로 보관해요.'),('outline','④ 재생 캐시만 정리'),('hint','삭제한 원본은 실제 정리 완료 후 용량이 돌아와요.')],
 ['① 완료 원본 바이트+예약으로 접수 검증. 5GB=5,000,000,000바이트, 파생본 사용량은 운영용 별도다.','② LRU500MB. ③ 유일 업로드 원본·설명·보류 작업은 캐시 정리에서 제외한다.','④ 캐시 삭제는 서버 기록 삭제가 아니다. 저장용 임시 파일은 기기 쓰기 완료 후 정리한다.'],
 '공간 조회 실패 / 한도 도달 / 정리 중·실패 / 원본 정리 대기 / 로그아웃 계정별 분리', 'storageUsage')
screen('UI34','운영 검토와 복구 관리','F25 F26 F27','별도 인증 운영자',[
 ('lead','운영 검토 큐'),('row','① 검사 대기 12  /  신고 3  /  복구 1'),('card','② 비공개 영상 · 판정 불가\n대상·근거·최소 증거·처리 이력'),('outline','③ 제한 / 삭제 / 해제 / 이용 제한'),('field','처리 사유  |  필수 입력'),('row','④ 이의·결과 안내  /  복구 요청 상세'),('button','⑤ 검증 후 조치 확정')],
 ['운영 전용 웹 화면의 모바일 폭 축약 와이어프레임이다. 실제 운영 화면은 목록+상세 2열로 구현한다.','③ 일반 방장과 분리한 운영 권한·사유·처리자·시각 감사이력을 남긴다. 검사 장애는 비공개 수동 검토로 보낸다.','⑤ 복구는 통지·7일 대기·후임 동의·수동 결정 후 버전을 재검증한다. 증거 암호화·종료 후90일 이내 정리.'],
 '운영 로그인 실패 / 권한 부족 / 동시 조치 / SLA 초과 / 복구 이견·종료 / 감사 저장 실패', 'opsQueue opsAction opsRecovery')
screen('UI35','오류와 변경 결과 확인','F01 F08 F15 F28','작업 중 사용자',[
 ('lead','① 저장 결과를 확인 중이에요'),('hint','요청은 접수됐을 수 있어요.\n내용을 다시 만들지 않고 확인할게요.'),('outline','② 같은 요청 결과 확인'),('card','③ 다른 사람이 먼저 수정했어요.\n내 입력을 유지했어요. 최신 내용 확인 >'),('outline','최신 내용에 다시 적용'),('hint','④ 문의용 번호 REQ-2026-…'),('link','문의하기')],
 ['① 응답 유실과 확정 실패를 구분한다. 업무 요청ID/멱등키로 기존 결과를 확인한다.','③ 버전 충돌 시 자동 덮어쓰지 않고 내 입력·최신 값·재적용·취소를 제공한다.','오프라인은 신규 조회/쓰기 제한과 재시도, 권한상실은 공동화면 종료 후 본인 기록 경로 유지. 내부 경로·토큰은 노출하지 않는다.'],
 '로딩 / 실제 빈 결과 / 조회 실패 / 오프라인 / 충돌 / 결과 불명 / 권한 상실', 'operationGet')

# API 목록: 구현 계약안. auth는 public/authenticated/member/owner/self/ops로 구분.
# 2026-10-30 UI 통합: 신규 화면은 기존 API를 연결한다.
screen('UI36','마이페이지','F02 F18 F28','로그인한 본인',[
 ('lead','마이페이지'),('card','기본 프로필 · 지민'),('row','현재 참여 중인 모임  ·  서버 총계'),('button','닉네임 변경'),('row','내가 올린 기록  >'),('row','설정  >'),('link','고객센터')],
 ['기본 아이콘·표시명을 사용한다. 프로필 사진 편집과 누적 모임 수는 회의 A05/A08 합의 전 보류한다.', 'groupsList 전체 커서 조회 완료 뒤 모임 ID 중복을 제거해 건수를 표시한다. 조회 중·실패는 미확정, 첫 페이지 길이로 대체하지 않는다. 실패는 0이 아닌 재시도로 안내한다.', '설정 UI28·본인 기록 UI22·계정 UI37로 연결한다. 닉네임은 F02의 검사와 길이 규칙을 적용한다.'],
 '정보 로딩 / 조회 실패 / 표시명 검사·저장 실패 / 문의 경로', 'profileGet profilePatch groupsList inquiryCreate')
screen('UI37','프로필 및 계정','F01 F02 F28','로그인한 본인',[
 ('lead','프로필 및 계정'),('card','기본 프로필 · 지민'),('button','닉네임 수정'),('row','실제 연결된 로그인 방식'),('link','로그인 수단 관리')],
 ['표시명과 기본 아이콘을 사용하며 사진 편집/복원 버튼은 보류한다.', '로그인 수단은 identitiesList의 본인 연결 목록이다. 예시 카카오 값을 사용하지 않는다.', '닉네임 수정은 F02를 따르고 실패 시 입력 보존. 소유ID·파일 소유권은 바뀌지 않는다.'],
 '조회 실패 / 표시명 검사 중·거부 / 저장 결과 불명 / 세션 만료', 'profileGet profilePatch identitiesList')
for ui in SCREENS:
 if ui['id']=='UI08':
  ui['notes'].append('v2.2: 요약 배너·날짜 카드·날짜별 타임라인 반영. 전체 기본·미지정·기간 밖 경로 유지. 참여자 묶음→UI26. 일정별 커버·비연속 날짜는 A01/A04 결정 전 보류.')
 if ui['id'] in ['UI09','UI13']:
  ui['notes'].append('v2.2: 보기 아이콘·선택 체크·개수·하단 사진/영상 저장, 사람별 메뉴는 UI16 선택으로 연결. 길게 누르기·120개·F16 정렬·기기 기억 유지.')
 if ui['id']=='UI26':
  ui['notes'].append('v2.2: 일정에서 참여자 묶음 탭으로 진입. 초대 버튼은 모든 현재 참여자에게 UI23을 열며 방장 역할 관리는 별도다.')
  ui['api']+=['invitesList']
 if ui['id']=='UI28':
  ui['notes'].append('v2.2: 마이페이지→설정→UI37 계정, 초대코드→UI24, OS 위치 설정 이동. 내 기록·신고/차단·캐시·문의·동의 내역 유지. 약관13과 F02/F24 차이는 출시 전 안건 A13.')
  ui['rows'][0]=('row','① 프로필 및 계정  >')

APIS=[]
def api(id,method,path,features,auth,req,res,errors):
    APIS.append(dict(id=id,method=method,path=path,features=features.split(),auth=auth,request=req,response=res,errors=errors))
api('authExchange','POST','/auth/exchange','F01','public','provider:kakao|google, credential, nonce, loginAttemptId','session, user, onboardingRequired','AUTH_CANCELLED AUTH_INVALID PROVIDER_UNAVAILABLE')
api('sessionRefresh','POST','/auth/refresh','F01','refresh-session','refreshToken','session','AUTH_EXPIRED')
api('consentDocs','GET','/consent-documents','F02','public','locale=ko','documents[{id,version,required,url}]','DOCUMENT_UNAVAILABLE')
api('onboard','POST','/onboarding','F02','authenticated','displayName, consents[{documentId,version,agreed}]','user, consentReceipts','CONSENT_REQUIRED TEXT_REJECTED')
api('profilePatch','PATCH','/me/profile','F02','self','displayName, expectedVersion','profile or operation','VALIDATION_ERROR TEXT_REJECTED VERSION_CONFLICT')
api('consentUpdate','PATCH','/me/consents','F02','self','items[{documentId,version,agreed}]','consentReceipts','REQUIRED_WITHDRAWAL_REQUIRES_DELETION')
api('identityLink','POST','/me/identities','F01','self-recent-auth','provider, credential, reauthProof','identities','IDENTITY_IN_USE REAUTH_REQUIRED')
api('identityUnlink','DELETE','/me/identities/{identityId}','F01','self-recent-auth','expectedVersion','identities','LAST_IDENTITY REAUTH_REQUIRED')
api('groupsList','GET','/groups','F03 F21','authenticated','cursor?, limit<=30','items[], nextCursor','AUTH_EXPIRED')
api('groupCreate','POST','/groups','F03 F07','authenticated','name, firstSchedule:ScheduleInput','group, membership, firstSchedule or operation','GROUP_LIMIT OWNER_CREATE_LIMIT VALIDATION_ERROR TEXT_REJECTED')
api('groupUpdate','PATCH','/groups/{groupId}','F04','owner','name?, coverAssetId?, restoreDefault?, expectedVersion','group or operation','FORBIDDEN VERSION_CONFLICT TEXT_REJECTED')
api('coverPrepare','POST','/groups/{groupId}/cover-uploads','F04 F20 F26','owner','file:FileInput','taskId, uploadEndpoint, state','FILE_INVALID FORBIDDEN')
api('calendar','GET','/groups/{groupId}/calendar','F06','member','from:date, to:date (inclusive <=366 days)','schedules[], dateCounts','RANGE_TOO_LARGE FORBIDDEN')
api('scheduleDetail','GET','/schedules/{scheduleId}','F06 F21','member','none','schedule, retention, plan[{date,title,visits[{...,plannedTime}],visitLimit:15}], version','FORBIDDEN EXPIRED')
api('scheduleCreate','POST','/groups/{groupId}/schedules','F07','owner','ScheduleInput{title,startDate,endDate,timezone} (반복·시각 없음)','schedule or operation','VALIDATION_ERROR TEXT_REJECTED FORBIDDEN')
api('scheduleUpdate','PATCH','/schedules/{scheduleId}','F08','owner','title?, startDate?, endDate?, expectedVersion, confirmOutsideRange?','schedule or operation; 미확인 기간 밖 영향은 409 OUTSIDE_RANGE_CONFIRMATION_REQUIRED + details{visits,media}','VERSION_CONFLICT VALIDATION_ERROR OUTSIDE_RANGE_CONFIRMATION_REQUIRED TEXT_REJECTED FORBIDDEN SCHEDULE_CANCELLED')
api('scheduleCancel','POST','/schedules/{scheduleId}/cancellation','F08','owner','expectedVersion','schedule(status=cancelled)','VERSION_CONFLICT ALREADY_CANCELLED FORBIDDEN')
api('scheduleDelete','POST','/schedules/{scheduleId}/deletion','F11','owner','expectedVersion','deletedId, deletedVisitIds','NOT_EMPTY VERSION_CONFLICT FORBIDDEN')
api('placesSearch','GET','/places','F09','member-context','groupId, query, category, bounds?, sort, center?','places[], provider, searchContext','PROVIDER_UNAVAILABLE VALIDATION_ERROR')
api('visitCreate','POST','/schedules/{scheduleId}/visits','F09','member','visitDate, plannedTime?(HH:MM 5분 단위|null), providerPlaceId? or manual{name,address?,lat?,lng?}','visit','DUPLICATE_VISIT VISIT_LIMIT VALIDATION_ERROR TEXT_REJECTED SCHEDULE_CANCELLED')
api('planUpdate','PUT','/schedules/{scheduleId}/plans/{date}','F10','member','title, visits[{id,order,plannedTime?}], expectedVersion','plan or operation','VERSION_CONFLICT INVALID_VISIT_SET TEXT_REJECTED')
api('visitDelete','DELETE','/visits/{visitId}','F11','member','expectedVersion','deletedId','NOT_EMPTY VERSION_CONFLICT')
api('uploadPrepare','POST','/schedules/{scheduleId}/submissions','F13 F14 F15','member','files[1..120]:FileInput+recordDate+visitId?+description+selectionIndex','submissionId, tasks[{id,state,uploadEndpoint}], fileErrors[{code:MEDIA_LIMIT|FILE_INVALID|...}], remaining[{visitId|null,recordDate,photos,videos}]','SCHEDULE_CANCELLED EXPIRED QUOTA_EXCEEDED FILE_INVALID MEDIA_LIMIT')
api('uploadGet','GET','/upload-tasks/{taskId}','F15','self','none','task, transferredBytes, state, retryable, reason','FORBIDDEN')
api('uploadCommit','POST','/upload-tasks/{taskId}/commit','F15 F20 F21 F26','self','checksum, actualBytes','task, operationId','FILE_INVALID ACCESS_REVOKED EXPIRED CANCELLED')
api('uploadRetry','POST','/upload-tasks/{taskId}/retries','F15','self','sameFileFingerprint','task, resumeOffset, uploadEndpoint','FILE_CHANGED ACCESS_REVOKED EXPIRED')
api('uploadCancel','POST','/upload-tasks/{taskId}/cancellation','F15','self','expectedVersion','task','ALREADY_COMPLETE VERSION_CONFLICT')
api('mediaList','GET','/schedules/{scheduleId}/media','F16','member','recordDate?, visitId?, unassigned?, outsideRange?, view:by_time|by_author, order:asc|desc, cursor?, limit<=60','items[{...,sortAt,sortBasis}], groups[] (by_author 작성자 구역), visibleCounts, nextCursor','FORBIDDEN EXPIRED INVALID_CURSOR')
api('mediaStream','GET','/media/{mediaId}/content','F16 F18 F20','visible-member-or-author-read','variant:thumbnail|view, context:shared|mine, Range? header','authenticated binary stream, contentType, contentLength','FORBIDDEN DELETED EXPIRED MODERATION_RESTRICTED')
api('metadataPatch','POST','/media/metadata-changes','F17','member-author','targets[{id,expectedVersion}](1..120), fields{description?:{apply,value},recordDate?:{apply,value},visitId?:{apply,value}}','operationId, state, appliedIds[] or itemErrors[]','FORBIDDEN MIXED_SCHEDULE VERSION_CONFLICT VALIDATION_ERROR MEDIA_LIMIT TEXT_REJECTED')
api('mediaDelete','POST','/media/deletions','F18','author','mediaIds[1..120]','operationId, results[{id,status:deleted|already_deleted|failed,reason?}]','FORBIDDEN VALIDATION_ERROR')
api('mineList','GET','/me/media','F18','self','groupId?, status?, cursor?, limit<=60','items[], minimalGroupSchedule, nextCursor','AUTH_EXPIRED')
api('exportCreate','POST','/exports','F19 F20','member-visible','mediaIds[1..120], purpose:save (share 폐지)','exportId, state, results[]','FORBIDDEN EXPIRED BLOCKED MODERATION_RESTRICTED')
api('exportGet','GET','/exports/{exportId}','F19','self','none','export, results[{mediaId,state,converted,variant}]','FORBIDDEN')
api('exportFile','GET','/exports/{exportId}/files/{mediaId}','F19','member-visible','Range? header','authenticated sanitized binary stream','FORBIDDEN EXPIRED DELETED')
api('invitesList','GET','/groups/{groupId}/invites','F05','member','cursor?','invites[]','FORBIDDEN')
api('inviteCreate','POST','/groups/{groupId}/invites','F05','member','none','invite{id,link,code,issuedAt,expiresAt,useCount:0,maxUses:50,state}','GROUP_CLOSED FORBIDDEN')
api('inviteRevoke','POST','/invites/{inviteId}/revocation','F05','member','expectedVersion','invite','FORBIDDEN VERSION_CONFLICT')
api('invitePreview','GET','/invite-preview','F05','public','tokenOrCode (성공 응답마다 useCount+1, 50회 소진)','groupName, scheduleSummary, inviteState, usesRemaining','INVITE_INVALID INVITE_EXPIRED INVITE_EXHAUSTED INVITE_REVOKED GROUP_CLOSED')
api('inviteJoin','POST','/invitations/join','F05','authenticated','tokenOrCode (횟수 미소모)','groupId, membershipId, alreadyMember','INVITE_EXPIRED INVITE_EXHAUSTED INVITE_REVOKED CAPACITY_FULL REENTRY_BLOCKED GROUP_CLOSED GROUP_LIMIT')
api('membersList','GET','/groups/{groupId}/members','F22','member','none','members[{id,displayName,isOwner}], reentryBlocks(owner only)','FORBIDDEN')
api('ownerTransfer','POST','/groups/{groupId}/owner-transfers','F22','owner','targetMembershipId, expectedVersion','ownerUserId, groupVersion','TARGET_INACTIVE VERSION_CONFLICT')
api('memberRemove','POST','/groups/{groupId}/member-removals','F22','owner','targetMembershipId, expectedVersion','membership, reentryBlock','SELF_TARGET TARGET_INACTIVE VERSION_CONFLICT')
api('reentryUnblock','DELETE','/groups/{groupId}/reentry-blocks/{userId}','F22','owner','expectedVersion','unblocked:true','VERSION_CONFLICT FORBIDDEN')
api('groupLeave','POST','/groups/{groupId}/leaving','F23','member','membershipId, expectedVersion','left:true','OWNER_TRANSFER_REQUIRED VERSION_CONFLICT')
api('groupClose','POST','/groups/{groupId}/closure','F23','sole-owner','confirmOwnMediaDeletion:true, expectedVersion','closed:true, deletionOperationId','MEMBERS_REMAIN VERSION_CONFLICT')
api('accountDelete','POST','/me/deletion','F24','self-recent-auth','reauthProof, confirmAllOwnMediaDeletion:true','deletionOperationId, accessRevoked:true','OWNER_ROLES_REMAIN REAUTH_REQUIRED')
api('reportCreate','POST','/reports','F25','member','targetType, targetId, reason','reportId, state, reviewDueAt','FORBIDDEN VALIDATION_ERROR')
api('reportsMine','GET','/me/reports','F25','self','cursor?','reports[], nextCursor','AUTH_EXPIRED')
api('blockCreate','POST','/me/blocks','F25','self','targetUserId','block','SELF_TARGET')
api('blockDelete','DELETE','/me/blocks/{targetUserId}','F25','self','none','unblocked:true','AUTH_EXPIRED')
api('recoveryCreate','POST','/groups/{groupId}/recovery-requests','F27','member-recent-auth','candidateMembershipId, reason, evidenceRefs[], reauthProof','requestId, state','FORBIDDEN VALIDATION_ERROR')
api('recoveryGet','GET','/recovery-requests/{requestId}','F27','requester-related','none','state, noticeAt?, responseDueAt?, decisionSummary?','FORBIDDEN')
api('storageUsage','GET','/groups/{groupId}/storage','F28','member','none','completedOriginalBytes, reservedBytes, limitBytes, availableBytes','FORBIDDEN')
api('logout','POST','/auth/logout','F28','authenticated','deviceId, pendingAction:cancel|none','sessionRevoked:true','PENDING_UPLOADS')
api('inquiryCreate','POST','/inquiries','F25 F26 F27 F28','self-or-restricted-self','category, reason, referenceId?','inquiryId, state','VALIDATION_ERROR')
api('operationGet','GET','/operations/{operationId}','F08 F15 F17 F18 F24 F28','request-owner-or-ops','none','state:pending|review|succeeded|failed, result?, itemErrors?','FORBIDDEN NOT_FOUND')
api('opsQueue','GET','/ops/cases','F26 F27','ops','type, status, cursor?','cases[], nextCursor','OPS_FORBIDDEN')
api('opsAction','POST','/ops/cases/{caseId}/actions','F26','ops','action, reason, expectedVersion','decision, auditId','OPS_FORBIDDEN VERSION_CONFLICT')
api('opsRecovery','POST','/ops/recovery-requests/{requestId}/decision','F27','ops','decision, reason, evidenceChecklist, expectedGroupVersion','decision, auditId','WAIT_PERIOD_REQUIRED DISPUTED GROUP_CLOSED VERSION_CONFLICT')
api('reauthenticate','POST','/auth/reauthentication','F01 F24 F27','self','provider, credential, nonce','reauthProof, expiresAt','AUTH_INVALID REAUTH_REQUIRED')
api('profileGet','GET','/me/profile','F02','self','none','profile','AUTH_EXPIRED')
api('identitiesList','GET','/me/identities','F01','self','none','identities','AUTH_EXPIRED')
api('consentsMine','GET','/me/consents','F02','self','none','consentReceipts','AUTH_EXPIRED')
api('blocksList','GET','/me/blocks','F25','self','cursor?','blocks[], nextCursor','AUTH_EXPIRED')
api('notificationsList','GET','/me/notifications','F25 F26 F27','self','cursor?','notifications[], nextCursor','AUTH_EXPIRED')
api('notificationRead','POST','/me/notifications/{notificationId}/reading','F25 F27','self','none','readAt','FORBIDDEN')
api('recoveryConsent','POST','/recovery-requests/{requestId}/candidate-consent','F27','candidate-recent-auth','agreed, reauthProof','state, candidateConsentAt','FORBIDDEN TARGET_INACTIVE')
api('recoveryResponse','POST','/recovery-requests/{requestId}/owner-response','F27','current-owner','response, reason','state, receivedAt','FORBIDDEN VERSION_CONFLICT')
api('opsCaseGet','GET','/ops/cases/{caseId}','F26 F27','ops','none','case, evidenceRefs, history','OPS_FORBIDDEN')
api('uploadHead','HEAD','/upload-tasks/{taskId}/content','F15','self-current-membership-or-cover-owner','Upload-Generation, Authorization','204; Upload-Offset/Length/Generation/Expires','OFFSET_MISMATCH GENERATION_MISMATCH TRANSPORT_EXPIRED ACCESS_REVOKED')
api('uploadChunk','PATCH','/upload-tasks/{taskId}/content','F15','self-current-membership-or-cover-owner','binary + Upload-Offset/Generation/Checksum, Content-Length','204; 확정 Upload-Offset/Generation','OFFSET_MISMATCH CHUNK_CHECKSUM_INVALID TRANSPORT_EXPIRED ACCESS_REVOKED')
api('deletionPreconditions','GET','/me/deletion-preconditions','F24','self-or-restricted-self','none','ownedGroups[{groupId,name,groupVersion,activeCount,candidates[],allowedAction}],reauthRequired','AUTH_EXPIRED')
for _screen in SCREENS:
    if _screen['id'] in ['UI17','UI25']:_screen['api']+=['uploadHead','uploadChunk']
    if _screen['id']=='UI30':_screen['api']+=['deletionPreconditions']
# 화면의 부속 조회·재인증·복구 응답 API도 추적에 포함한다.
for s in SCREENS:
    for key,ids in {'UI28':['profileGet','consentsMine','notificationsList','notificationRead'], 'UI29':['identitiesList','reauthenticate'], 'UI30':['reauthenticate'], 'UI31':['blocksList'], 'UI32':['reauthenticate','recoveryConsent','recoveryResponse'], 'UI34':['opsCaseGet']}.items():
        if s['id']==key:s['api']+=ids

# 별도 정책 충돌표. 현재 기준을 재작성하는 곳이 아니라 설계 반영 근거를 보여 준다.
CONFLICTS=[
 ('날짜 공통 메모','이번 APK 순서 편집 화면','장소 메모 최대100자','날짜 제목만 제공·공통 메모 제외','F10','UI12 메모 입력 제거'),
 ('한번에 선택 개수','이번 APK 업로드 시트','사진·동영상 최대10개','촬영·가져오기 혼합 최대120개','F13·F14','UI16 후보수·서버 검증 변경'),
 ('대상 OS','XLSX 문서정보·비기능요건','iOS15+/Android10+·iPhone 기준','Android12(API31)+만 1차','F01·개발범위','UI01~35와 Android QA 기준'),
 ('서비스 계층','PDF p3~6·APK','여행→Day→장소 경유','모임→일정→장소 계획/기록, 날짜는 필터','F03·F06','일정 선택 즉시 전체 상세'),
 ('로그인','XLSX 화면목록·선택근거','카카오 우선·Apple/Google 예정','카카오·Google 두 수단','F01','Apple 제거, 두 수단 필수'),
 ('정원','XLSX 화면설계·PDF p4','1~5 선택·기본3','방장 포함10명 고정','F03·F05','정원 입력·변경 제거'),
 ('초대 권한','2026-10-24 사용자 요청','방장만 조회·발급·공유·취소','모든 현재 참여자가 같은 모임의 초대 조회·발급·공유·복사·개별 취소','F05','UI05·UI23·권한표·3개 API member 권한·참여 종료 재검증'),
 ('초대 관리','XLSX API·초대관리','단일 코드 교체·기간 선택','초대별168시간·기존 발급 유지·개별취소','F05','invite 독립 테이블·UI23'),
 ('비로그인 미리보기','XLSX 화면흐름·권한','대표사진·일부 일정 둘러보기','모임명·일정요약만','권한절·F05','비공개 최소 DTO·UI24'),
 ('참여 확정','XLSX 화면흐름 F29','로그인 뒤 자동 참여','로그인/가입 후 참여하기로 확정','F05','pendingInvite 보존 후 재확인'),
 ('프로필','PDF p10·XLSX 프로필','사진·닉네임·합류율','표시명만·사진편집 없음','F02','UI28에서 표시명만'),
 ('과거 날짜','XLSX 선택근거 T11','minDate=오늘','과거 일정 허용·기한 지난 업로드 불가','F07·F21','생성 검증 분리'),
 ('촬영 길이','PDF p8~9','모임별5·10·15초','개인 촬영1~5초·기본3초','F12','UI15 정수 선택'),
 ('가져오기 길이','PDF p9','선택구간 자르기','가져오기60초·200MB, 자르기 없음','F13','초과 영상 재선택 안내'),
 ('장소별 개수','PDF p7·APK','슬롯/업로드 현황 중심','v1은 제한 없음 → 2026-10-20 회의로 작성자별 방문당 사진5·영상2','F14·P11','남은 개수 표시·서버 파일별 거부'),
 ('소통 기능','PDF p7','실시간 댓글','댓글·좋아요·친구·공개피드 제외','개발범위','UI와 API에서 제거'),
 ('삭제와 종료','XLSX 데이터정책·화면흐름','방장 여행 삭제·연쇄 삭제','빈 일정만 삭제, 마지막 방장만 모임종료·타인파일보존','F11·F23','FK cascade 금지·UI27'),
 ('로그아웃','XLSX 화면흐름 F05','즉시 세션 해제','미완료 업로드 확인·중단 선택','F28','UI28 확인 흐름'),
 ('지도·기록 범위','XLSX 문서정보','지도·업로드는 다음 단계','장소 검색·촬영·업로드·공동감상 1차 포함','F09~F20','1차에 설계 추가'),
 ('영상 제작·결제','PDF p11~12·APK 실험','영상합성·분할·AI 아이디어','영상 제작/편집·결제·보관연장 후속','7절','개발/검수 범위 제외'),
 ('보관','PDF 검토문제·구자료','보관 미정/여행 삭제 종속','첫 완료 때 종료일+3개월 고정','F21','서버 만료와 정리 분리'),
 ('반복 일정','2026-10-20 회의','v1: 일/주/월/년·간격·730회 맞춤 반복','반복 폐지, 기간(시작~종료 날짜) 일정을 방장이 수동 추가','F07·F08·F11','UI07 제거·recurrence 테이블/API 제거·scheduleUpdate/Cancel'),
 ('일정 시각','2026-10-20 회의','v1: 종일/시간 지정(UI04 종일 토글)','일정은 날짜만, 시각은 장소 추가 시 방문별 입력·UI08 표시','F07·F09·F10','UI04/06 종일 제거·visitCreate.plannedTime·schedules 시각 컬럼 제거'),
 ('초대 횟수','2026-10-20 회의','v1: 7일·횟수 무제한','7일 + 초대 확인 50회 소진','F05','invitations.use_count/max_uses·INVITE_EXHAUSTED·UI23/24'),
 ('외부 공유','2026-10-20 회의','v1: 휴대폰 저장 + OS 공유창','휴대폰 저장만. 초대 메시지 공유는 유지','F19·F20·F23','UI21 공유 제거·export purpose=save'),
 ('장소별 업로드 수','2026-10-20 회의','v1: 제한 없음','작성자별 방문당 사진5·영상2, 미지정은 작성자×일정×기록일','F14·F17·P11','upload_tasks/media 트리거 MEDIA_LIMIT·UI13/16 남은 개수'),
 ('일차별 장소 수','2026-10-20 회의','v1: 제한 없음','일정×방문일 방문 최대 15개','F09·P12','visits 트리거 VISIT_LIMIT·UI08/10/11'),
 ('선택 화면','2026-10-20 회의','v1: UI16 업로드 확인 + UI19 다중 선택','하나의 선택 화면으로 통합','F14·F17·F18·F19','UI16 통합·UI19 번호 폐지'),
 ('기록 보기 방식','2026-10-20 회의','v1: 제출 묶음 완료순 고정','시간순(촬영 시각)·사람별 묶음','F16','mediaList view/order·UI09/13'),
 ('길게 눌러 저장','2026-10-20 회의','v1: 선택 버튼 중심','길게 누르기 → 다중 선택 → 휴대폰 저장','F16·F19','UI09/13/16 선택 모드')]

# 기능별 QA 입력. 정상, 권한, 경계/경쟁, 복구를 실제 시나리오로 지정한다.
QA={
 'F01': [('카카오톡 미설치→웹 인증 성공','동일 공급자 subject의 기존 작성자ID 유지'),('같은 이메일의 다른 공급자로 최초 로그인','자동 병합 없이 독립 계정'),('초대 진입 중 인증 실패→재로그인','초대와 미완료 작업 보존'),('본인 재인증 후 로그인 수단 연결/마지막 수단 해제','명시적 연결 성공, 마지막 수단 해제 거부')],
 'F02': [('필수동의·표시명 입력 후 가입','버전과 동의시각 저장'),('선택 동의 거부·철회','핵심 이용 유지, 변경 이력 기록'),('공백 이름·NFC 결합문자·20/21자·중복 이름','공백/21자 거부,20자·중복 허용'),('필수 동의 철회→역할 미정리 계정','계정삭제 선행조건 안내, 미완료를 완료로 표시하지 않음')],
 'F03': [('모임+첫일정 생성 응답 유실 후 같은 키로 재시도','모임·방장·첫일정 한 세트만 생성'),('첫일정 없이 생성·100개 활성·방장20개 상태 생성','각 요청 거부, 일부 객체 미생성'),('최근활동 동률·진행/미래/과거/취소 일정 혼합','정해진 정렬과 요약 우선순위 일치'),('단순 열람·나간 모임 직접 진입','열람은 활동시각 불변, 공동진입 거부')],
 'F04': [('방장이 이름/대표사진 교체·기본 복원','전체 참여자 화면 갱신'),('일반 참여자가 직접 PATCH','403과 기존 정보 유지'),('1600px/5MB 경계·변환실패·GPS포함 사진','저장본 규격·위치제거 확인, 실패 시 기존 유지'),('두 방장 세션 같은 버전 동시 수정','하나 성공·하나409, 후속 입력 유지')],
 'F05': [('방장·일반 참여자의 조회·새 발급·공유·복사·타인 발급 초대 취소','모든 현재 참여자에게 동일 권한·발급자 이력 유지'),('비참여자·탈퇴·퇴장·이용 제한 계정의 직접 요청·이전 요청 재시도','조회·발급·취소 모두 거부·입력/결과 경로로 권한 우회 불가'),('발급자 탈퇴 후 남은 참여자의 초대 관리','기존 초대의 기한·횟수·상태 유지·남은 참여자는 조회·취소 가능'),('초대 발급/취소와 참여 종료 동시 처리','사용자·모임 잠금과 현재 참여 재검증·참여 종료 뒤 늦은 새 발급/취소 거부'),(
'새 초대2개·재공유·여러계정 참여','기존 초대 유지·만료 연장 없음·참여로 횟수 미소모'),('발급시각-1ms·만료-1ms·만료시각','발급 전/만료는 거부, 유효 구간만 허용'),('49회에서 두 요청 동시 확인·51번째 확인·로그인 복귀 재확인','50회까지 응답·소진 구분 안내·복귀는 횟수 미증가·기존 참여자 영향 없음'),('9명에서2계정 동시참여·차단·종료·취소·소진·이미참여 구분','최대10명·활성참여 하나·구분된 안내·이미참여는 인원 불변')],
 'F06': [('다일 일정 선택·전체/날짜필터·뒤로 복귀','단일 일정 전체 상세·월/필터/스크롤 복원'),('월요일 시작·같은날4일정·여러 날 일정의 셀 표시','최대3개+나머지수·기간 모든 날짜 셀·날짜선택 전체목록'),('기간 변경으로 선택필터 범위 이탈','전체로 복귀하고 안내'),('방문별 예정 시각·시간 미정·장소 개수 표시','방문일 순서·시각 표시, 일정 자체에는 시각 없음')],
 'F07': [('당일·19~21일 기간 일정 수동 추가','하나의 일정·달력 표시 일치'),('날짜 역전·367일·제목 101자·공백 제목','거부·입력 유지'),('겹치는 기간 일정 추가·응답 유실 후 같은 키 재시도','겹침 안내 후 허용·중복 생성 없음'),('일반 참여자 생성·allDay/startAt/recurrence 필드 전송','서버 거부·알 수 없는 필드 거부')],
 'F08': [('제목·기간 변경 시 기간 밖 방문/기록 영향 확인','개수 표시·확인 후 전체/기간밖 영역 유지·confirm 없으면 409'),('기간 축소 후 신규 범위밖 지정·기간 안 재지정','신규 거부·기간 안 재지정 허용'),('기록 있는 일정 취소 후 신규 접수·취소 전 접수 재시도','신규 거부·기존 동일 파일만 완료'),('동시 변경·취소 재시도·취소 일정 재활성 시도','충돌 입력 유지·멱등·재활성 거부')],
 'F09': [('검색→지도이동→영역검색→예정시각 입력→방문추가','목록마커 연동·방문일 마지막순서·시각 저장'),('위치 거절·좌표없는 수기장소·시각 미입력','검색/등록 가능, 가짜 거리/마커 없음·시간 미정 저장'),('동일 공급자 장소 같은날/다른날·수기6자리좌표','같은날 중복 거부·다른날 허용·정규화 비교'),('14개에서 두 사람 동시 추가·16번째 추가·빈 방문 삭제 후 추가','15개까지만 확정·VISIT_LIMIT 안내·자리 복귀')],
 'F10': [('순서·동일시각·미입력·날짜제목 동시 저장','사용자 순서 유지·비운 제목은 날짜'),('방문 누락·중복·다른 날짜 혼입','전체 저장 거부'),('시각23:55/24:00·제목30/31자·시각순 정렬 버튼','23:55/30자만 허용·버튼 눌렀을 때만 재정렬'),('동시계획 수정·미저장 이탈','먼저 저장 유지·입력 보존·저장/버리기/계속')],
 'F11': [('빈방문·마지막빈일정 삭제','관련 빈 계획만 제거·모임/초대 유지·15개 자리 복귀'),('숨김/보존파일·진행업로드 있는 일정 삭제','거부·취소로 안내'),('업로드접수와삭제 순서 양방향 경쟁','먼저 확정한 상태 기준·늦은 접수/삭제 거부'),('삭제 재시도·삭제된 일정 상세 진입','멱등 결과·재생성 없음·삭제 안내')],
 'F12': [('1~5초 자동종료·3초최초·다음실행값','선택값±0.25초·기기 마지막값 기억'),('녹화 조기종료0.49/0.50초','0.49거부·0.50초 유효파일 허용'),('마이크거절·카메라거절·녹화중전후면','무음허용·카메라거절안내·녹화중전환불가'),('앱전환·전화·공간부족·취소','유효결과만 후보·기존업로드/기기원본 유지')],
 'F13': [('사진/영상/촬영 혼합120개·여러번선택','최초선택순서 유지·후보 합산120개'),('0/120/121개·영상60/60.1초·200MB+1바이트','상한 초과만 거부·자동자르기 없음'),('손상·RAW·애니메이션·접근소실 혼합','파일별 오류·나머지 후보 유지'),('방문 남은 개수 사진3/5·영상0/2 표시 후 초과 선택','남은 개수 표시·초과분은 확인 단계에서 파일별 표시')],
 'F14': [('단일일/오늘포함다일/범위밖오늘·방문진입','기본 기록일 제안 규칙 일치'),('같은 방문에 사진6·영상3 제출·미지정 묶음 한도','사진5·영상2만 접수·초과 파일별 MEDIA_LIMIT·작성자×일정×기록일 적용'),('두 기기 동시 접수·실패/취소 자리 즉시 반환·삭제 후 반환','합산 한도 유지·반환 시점 일치·중복 반환 없음'),('설명1000/1001자·취소일정·기한경과·방문일불일치','초과/신규접수 거부·설명 일반텍스트·불일치 거부')],
 'F15': [('일부완료·일부실패·100%서버검사중','완료만공개·실패만재시도·100%≠완료'),('전송실패 자동재시도·오프라인대기','1/2/4초3회·오프라인횟수미소모·동시3개'),('프로세스종료/강제종료 후 재실행','서버확인 후 복구·새계정제출 없음'),('완료/취소·취소일정기존작업/퇴장/모임종료 경쟁','서버최종상태 일치·권한/종료/만료 우선')],
 'F16': [('시간순 오름/내림·촬영시각 없는 파일','촬영시각 기준·없는 파일은 완료시각 사용+표시·동일시각 ID 고정'),('사람별 묶음·작성자 구역 순서·접기·60개 페이지 경계','먼저 완료 작성자부터·구역 내부 시간순·중복없는 커서·집합 동일'),('차단·운영제한·삭제·만료 혼합·장소/작성자별 집계','목록과 집계 일치·차단 작성자 구역 없음'),('길게 눌러 선택 모드·영상종료/확대닫기·업로더기기꺼짐','UI16 선택 진입·소리중단·보기방식/스크롤 복원·서버열람 가능')],
 'F17': [('필드별 적용/유지·설명비우기·방문해제','선택한 필드만 전체 대상 반영'),('다른일정/타인/121개·기간밖기록 재지정','혼합요청거부·기간안 재지정허용'),('방문 변경으로 대상 방문 사진5 초과·검사중 버전 변경','해당 파일 MEDIA_LIMIT·전체 미적용·입력 유지'),('설명검사거부·응답유실 재시도','전체미적용 또는 동일요청결과·집계중복없음')],
 'F18': [('나간/퇴장/종료 모임 본인파일 열람·삭제','참여/빈자리 불필요·타인공동자료 비노출'),('여러모임 본인120개 삭제·타인1개혼합','본인혼합허용·권한오류는 요청전체거부'),('유효요청 중 일부정리실패·이미삭제 재요청','파일별결과·실패만재시도·중복차감없음'),('참여종료 본인 저장/정보수정 직접요청','거부·열람/삭제만 허용')],
 'F19': [('길게 눌러 본인/타인120개 선택 저장','참여자 동일권한·UI16 공통 선택 화면·앨범 경로 표시'),('기기공간부족·부분다운로드실패','실패개수·재시도/선택축소'),('내려받기100%·기기쓰기 전 이탈','쓰기 전 완료로 표시하지 않음'),('파일준비 뒤 퇴장·만료·개인차단·purpose=share 요청','파일스트림 재검증으로 거부·share는 400 거부')],
 'F20': [('GPS있는/없는 사진·영상·대표사진 타인제공','썸네일/열람/저장 모두위치태그없음'),('회전·촬영시각·음성·HDR 입력','정보보존·호환본SDR·전체구간 유지'),('제거검증실패·알수없는메타데이터','공개/준비완료 금지·재시도/안내'),('기기원본과 앱별도방문 위치 비교','기기원본불변·사용자지정방문 유지')],
 'F21': [('2027.01.31종료 첫완료','04.30까지·05.01 00:00 KST 만료'),('첫완료와종료일변경 동시·모든파일삭제후재업로드','서버확정기준 단일기한·고정해제없음'),('취소전접수 첫파일 취소후완료·예상기한경과','취소직전종료일 기준·지난기한완료거부'),('만료경계·7일/1일전·만료후30일카드','즉시접근차단·앱내안내·카드는설명없이기한만')],
 'F22': [('방장이활성참여자에게이전','즉시이전·수락대기없음·방장한명'),('본인지정·탈퇴대상·일반참여자이전요청','거부·기존방장유지'),('퇴장→차단해제→새참여→오래된퇴장재시도','새membershipId보존·차단재생성없음'),('강제퇴장과자발나가기 비교','강제만재참여차단·완료파일기한/소유유지')],
 'F23': [('일반나가기 후 본인조회/삭제','공동접근종료·유효파일유지·새저장불가'),('2인이상방장나가기/전체종료','이전전나가기/전체종료 거부'),('마지막방장종료·과거타인파일포함','본인만삭제·타인본인경로보존·재개불가'),('동시새참여와종료 양방향 순서','새참여먼저면종료거부·종료먼저면참여거부')],
 'F24': [('방장역할미정리·역할정리완료','미정리거부·정리후전체본인파일삭제'),('나간/퇴장/종료모임의본인파일 포함','작성자ID전체탐색·타인파일유지'),('삭제직전모임생성/방장수신 경쟁','계정잠금으로선행조건재검증'),('삭제재시도·재가입·정리실패','즉시접근차단·중복집계없음·기록자동복구없음')],
 'F25': [('파일/대표사진/참여자신고·중복요청','최소증거연결·중복없음·자동삭제없음'),('개인차단 뒤공동목록/집계/직접저장공유','내경로만숨김·집계일치'),('방장개인차단·모임재참여차단비교','방장역할유지·두차단독립'),('신고결과/이의·타인신고자정보요청','본인결과조회·타인신원/증거비공개')],
 'F26': [('사진/영상/이름/제목/주소/설명 공개전검사','통과전비공개·수정은기존공개값유지'),('엔진장애·판정불가·의심콘텐츠','비공개수동검토·자동공개없음'),('운영자제한/삭제/해제·일반방장같은요청','운영권한/감사이력·방장거부'),('서비스제한계정·종료모임보존파일 조치','열람등정책적용·본인삭제/동의철회/문의유지')],
 'F27': [('요청자재인증·후임별도동의·기존방장통지','자료/통지이력·7일응답대기'),('7일경과·이견/증거부족','자동승인없음·수동검토/보류'),('승인직전직접이전/후임나감/모임종료','버전검증거부·오래된승인미덮어씀'),('복구승인과파일기한/작성자 비교','방장역할만변경·기한/소유불변·종료재개불가')],
 'F28': [('완료원본+예약=5GB경계·동시접수','동시초과없음·파생본사용량별도'),('캐시500MB LRU정리·미완료원본포함','재생캐시만삭제·유일원본/설명/작업유지'),('로그아웃중업로드→다른계정로그인','작업확인·중단선택·이전계정보호자료비노출'),('실패문의·공개연락처·저장임시파일','문의식별값·실채널연결·기기쓰기후정리')]
}

# 최신 UI의 미결 정책은 기존 정책을 덮어쓰지 않는다.
CONFLICTS.extend([
 ('A01 날짜 추가','c19f34c DatePickSheet/demoStore','비연속 날짜 다중 선택·30개','방장만 연속366일·버전/영향 확인','F07 F08 F21','회의 10/30 A01 결정 전 기존 유지'),
 ('A02 진입','c19f34c S01/S02/S04','날짜·방문을 순차 경유','전체 기본·미지정/기간 밖 직접 경로','F06 F16','UI08 날짜 카드를 필터로 연결'),
 ('A03 정렬','c19f34c PlaceRecords','업로드 최신순·보기 초기화','촬영 시각 오름차순·기기 기억','F16','아이콘/선택 UI만 반영'),
 ('A04 대표 사진','c19f34c covers[itinerary.id]','일정별 커버','모임별 커버·방장만','F04','UI25 연결·일정별 데이터 보류'),
 ('A05 프로필','c19f34c MyPage/Account','사진 편집·복원','표시명·기본 아이콘','F02 F28','UI36/37 구성 반영·사진 보류'),
 ('A09 저장','c19f34c downloadBridge','handled 응답·연결 안내','120개·파일별 결과·실패 재시도','F16 F19','UI16→UI21 계약 유지'),
 ('A13 출시 정합성','약관13 개정안 vs 종전 명세','동의·GPS·계정 삭제 규칙 차이','별도 개정 확정 필요','F02 F20 F24','일반 사용자 출시 전 해결·이번 UI 검증으로 대체 불가')
])
