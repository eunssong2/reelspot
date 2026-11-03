"""편집 가능한 설계 데이터. 문서와 도형은 build_design.py로 다시 생성한다."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATE='2026-11-04'
# v3(2026-11-03): feature/ui-prototype@870be87을 실행·분석해 화면을 다시 정했다. 프로토타입과 겹치면 프로토타입이 우선,
# 프로토타입에 없는 기존 기능은 '기존 유지'로 남긴다. 결정 목록은 아래 V3_DECISIONS, 확인 항목은 OPEN_QUESTIONS.
# rows: 유형, 표시 문자열. 상세 동작은 notes에 번호 순서로 연결한다.
SCREENS=[]
def screen(id,title,features,role,rows,notes,states,api,reference=None):
    SCREENS.append(dict(id=id,title=title,features=features.split(),role=role,rows=rows,
        notes=notes,states=states,api=api.split(),reference=reference))
screen('UI01','시작과 로그인','F01','로그인 전',[
 ('brand','AT THAT PLACE'),('hint','SHARED MEMORY SPACE'),('lead','함께한 순간을\n한곳에 모아요'),('hint','모임의 일정별로 사진과 영상을 함께 보관해요.'),
 ('yellow','① 카카오로 시작하기'),('outline','② Google로 시작하기'),('link','③ 이용약관  ·  개인정보처리방침')],
 ['①② 누르면 두 버튼을 모두 잠그고 누른 버튼에만 진행 표시. 카카오톡 미설치 시 카카오계정 웹 로그인. 공급자+공급자 사용자 ID로 계정을 구분하고 이메일로 병합하지 않는다.',
  '신규 → UI02, 기존+보류 초대 → UI24, 기존 → UI03으로 화면 교체. 보류 초대가 있으면 상단에 ‘✉️ 초대받은 모임에 참여하려면 로그인해 주세요.’',
  '③ 게시 문서를 로그인 전에도 연다. 실패 문구: 공급자 장애 ‘{카카오|Google} 로그인이 잠시 원활하지 않아요. 잠시 후 다시 시도하거나 다른 방법으로 시작해 주세요.’, 그 외 ‘로그인하지 못했어요. 다시 시도해 주세요.’ 인증 창 닫기는 안내 없음.',
  '스플래시: 저장 세션 복원 중 로고·로딩. 세션 없음 UI01 / 가입 미완료 UI02 / 보류 초대 UI24 / 그 외 UI03. 오프라인은 공통 문구+다시 시도, 세션 유지.'],
 '세션 복원 중 / 로그인 진행(두 버튼 잠금) / 인증 취소 / 오프라인·공급자 장애·인증 실패 / 보류 초대 안내', 'authExchange sessionRefresh consentDocs', '01-entry')
screen('UI02','가입 동의와 표시명','F02','최초 가입자',[
 ('lead','처음 오셨네요 👋'),('hint','문서를 읽고 필요한 항목에 동의해 주세요.'),('row','① [ ] 약관 전체 동의  ·  선택 동의 항목까지 한 번에 완료해요'),
 ('row','② [ ] 서비스 이용약관   필수  ›'),('row','[ ] 개인정보 수집 및 이용 동의   필수  ›'),('row','[ ] 마케팅 정보 수신 동의   선택  ›'),('row','[ ] 위치정보 이용약관   선택  ›'),
 ('field','③ 표시명 ●  추후 언제든 변경 가능  |  지민   2/20'),('hint','중복 표시명도 사용할 수 있어요. 최대 20자'),('button','④ 동의하고 시작하기  →')],
 ['① 전부 동의 상태면 전부 해제, 아니면 전부 동의. 문서 로딩 전 비활성. ② 행=체크 토글, ›=문서 보기(버전·시행일·본문·‘동의하고 닫기’). 서버 게시 문서 목록을 그대로 표시하며 모두 kind=consent.',
  '동의는 문서별 {문서ID, 버전, 동의 여부}로 저장한다. 선택 미동의도 false로 기록. 버전이 바뀌면 자동 미동의, 제출 중 바뀌면 ‘동의 문서가 바뀌었어요. 바뀐 항목을 다시 확인해 주세요.’',
  '③ NFC·trim 후 grapheme 1~20, 줄바꿈 제거, 중복 허용, 소셜 이름 제안. 21자 이상 보존+‘표시명은 20자까지 쓸 수 있어요’, 빈 값(입력을 벗어난 뒤) ‘표시명을 입력해 주세요’, 거부 ‘이 표시명은 사용할 수 없어요. 다른 이름을 입력해 주세요.’',
  '④ 필수 2개 현재 버전 동의+표시명 유효일 때 활성. 성공 → 보류 초대 UI24 / UI03 교체. 뒤로가기(화면·시스템): ‘가입을 그만둘까요?’/‘입력한 내용은 저장되지 않아요.’/그만두기·계속하기 → 로그아웃, 보류 초대 유지.'],
 '문서 불러오는 중 / 문서 실패 ‘동의 문서를 불러오지 못했어요’+다시 시도 / 필수 미동의 / 표시명 빈 값·21자·거부 / 문서 버전 변경 / 제출 중', 'consentDocs onboard')
screen('UI03','내 모임','F03 F21','로그인한 사용자',[
 ('lead','내 모임'),('hint','총 5개의 모임에 참여하고 있어요   ① 최근 공동 활동순'),('card','② [사진] 방장  주말 산책 모임\n6/10명 · 다음 일정: 북한산 둘레길  ›'),
 ('card','[사진] 참여자  보관 안내 모임\n2/10명 · 최근 일정: 가을 소풍'),('banner','③ ⏱ 보관 안내 · 만료 7일 전 기록이 있어요   확인'),
 ('outline','④ 🔑 초대 코드로 참여'),('button','⑤ ＋ 모임 만들기'),('nav','⑥ 모임  |  내 기록  |  마이페이지')],
 ['① 최근 공동 활동(생성·사진/이름 변경·참여·내보내기·나가기·일정·방문·기록 변경)순, 동률 생성시각·ID 역순. 열람은 활동이 아니다. 종료·참여 종료 모임 제외. 30개 커서(기존 유지).',
  '② 카드: 모임 사진(없으면 이름 첫 글자)·역할 배지·이름 1줄·{n}/10명·대표 일정(취소 제외 진행 중→가까운 미래→최근 과거: 진행 중/다음 일정/최근 일정, 없으면 아직 일정이 없어요). 누르면 UI05.',
  '③ 보관 마지막 날이 7일 이내면 띠, 1일 이하 ‘⏱ 내일 보관이 끝나는 기록이 있어요’, 당일 ‘오늘 보관이 끝나는 기록이 있어요’. ④ UI24 빈 코드. ⑤ UI04. ⑥ 내 기록 → UI22, 마이페이지 → UI36. 화면 복귀마다 재조회.'],
 '로딩(0개 단정 금지) / 실패 ‘모임 목록을 불러오지 못했어요’+다시 시도 / 빈 목록 ‘아직 함께하는 모임이 없어요’ / 보관 안내 / 다음 페이지', 'groupsList', '01-entry')
screen('UI04','모임과 첫 일정 생성','F03 F07','로그인한 사용자',[
 ('lead','새 모임 만들기'),('hint','🎉 함께할 순간을 시작해볼까요?\n모임을 열고 첫 일정을 가볍게 등록해보세요.'),('field','① 모임 이름 *  어떤 이름이든 좋아요  |  예: 주말 산책 모임   0/50'),
 ('field','② 첫 일정 제목 *  언제든 바꿀 수 있어요  |  예: 우리의 서울 여행   0/100'),('field','③ 일정 기간 *  시작 날짜  —  종료 날짜   📅 3일 동안'),
 ('hint','ℹ️ 시간은 장소를 추가할 때 입력해요. 반복 설정은 없어요. 필요하면 일정을 더 추가해요.'),('hint','👥 한국 시간 기준 · 최대 10명 고정 · 정원 변경 없음'),('button','④ 모임과 첫 일정 만들기  →')],
 ['① 1~50, ② 1~100 grapheme, 줄바꿈 제거, 초과 보존+‘모임 이름은 50자까지 쓸 수 있어요’/‘일정 제목은 100자까지 쓸 수 있어요’. 공개 전 검사.',
  '③ 기간 시트(월요일 시작, 첫 탭 시작·두 번째 탭 종료·같은 날 두 번 당일, 366일 초과 ‘일정은 366일까지 만들 수 있어요’, 과거 허용, 취소는 폼 불변). 배지 📅 당일/📅 n일 동안. 보관 기한이 지난 기간이면 ‘이 기간은 보관 기한이 지나 사진·영상을 올릴 수 없어요.’(생성은 허용).',
  '④ 모임·방장 참여·첫 일정(날짜 분해) 원자 생성. 요청 키: 진입 시 생성, 입력 변경 시 새 키. 성공 ‘모임을 만들었어요’ → UI05 교체(첫 일정 시작일 선택). 응답 유실은 결과 확인 카드(UI35).',
  '오류는 버튼 위: ‘사용할 수 없는 표현이 있어요. 모임 이름이나 일정 제목을 바꿔 주세요.’ / ‘참여 중인 모임이 100개라 더 만들 수 없어요.’ / ‘방장인 모임이 20개라 더 만들 수 없어요.’ 이탈: ‘만들기를 그만둘까요?’/나가기·계속 작성.'],
 '필수 누락 / 초과 입력 / 기간 시트 / 보관 기한 경과 경고 / 결과 확인 필요 / 한도·검사 거부', 'groupCreate operationGet')
screen('UI05','모임 달력','F06 F07 F08','현재 참여자',[
 ('lead','주말 산책 모임'),('row','① 6/10명 · 방장 지민 · 나는 참여자     (지)(수)+4'),('row','② ‹  2026년 10월  ›   오늘'),('row','③ [달력 | 일정 목록]     초대·관리 ›'),
 ('calendar','2026년 10월'),('row','④ 10월 17일 일정 1   토요일'),('card','⑤ 성수에서 느긋한 오후\n10.17 · 장소 3곳   오후의 커피 외 2   진행 예정   ⋯'),('button','⑥ ＋ 일정 추가')],
 ['① 인원 띠·아바타(앞 2명+N) → UI26. ② 월 이동·오늘·좌우 스와이프. 다른 달 날짜 탭 시 그 달로 이동. ③ 보기 방식은 기기에 기억. 초대·관리는 모든 참여자 → UI23.',
  '달력: 월요일 시작 6주, 여러 날 일정은 날짜마다 한 줄(그날 제목: 날짜 제목 또는 {n}일차 · {일정 이름}, 하루 일정은 일정 이름). 칸당 3줄+N, 같은 주 줄 배정 시작일→긴 기간→생성순, 취소된 날 회색·취소선. 같은 날짜에 활성 일정은 하나.',
  '④ 선택 날짜 목록 / 일정 목록 보기는 그 달 하루 항목을 날짜순(날짜 머리). ⑤ 카드: 제목 2줄·MM.DD·장소 n곳·칩(취소된 일정/첫 장소 외 n/진행 중/진행 예정). 카드 → UI08 그날. ⋯(방장·취소 아님) → 일정 변경(UI38)·닫기.',
  '⑥ 방장만, 선택 날짜를 기본값으로 UI06. 빈 상태: ‘아직 일정이 없어요’+방장 ‘일정 추가로 첫 일정을 만들어 보세요.’/참여자 ‘방장이 일정을 추가하면 여기에 보여요.’, 날짜 ‘이 날에는 일정이 없어요’, 달 ‘이 달에는 일정이 없어요’.'],
 '처음 조회 스피너 / 실패 ‘일정을 불러오지 못했어요’ / 재조회 실패 띠 ‘최신 정보를 불러오지 못했어요 · 다시 시도’ / 늦은 응답 무시 / 접근 불가 ‘이 모임을 확인할 수 없어요.’ / 빈 상태 3종', 'calendar membersList', '02-schedule')
screen('UI06','일정 추가','F07','현재 방장',[
 ('lead','일정 추가'),('hint','주말 산책 모임'),('row','👥 주말 산책 모임   ● 방장 지민'),('field','① 일정 제목 *  |  예: 북한산 둘레길   0/100'),
 ('field','② 일정 기간 *  2026.10.17  —  2026.10.19   📅 3일 동안'),('hint','🕘 시간은 각 장소에서 입력해요 · 반복 설정 없음'),('hint','🌏 한국 표준시(Asia/Seoul) 기준'),
 ('banner','③ 이미 다른 일정이 있는 날짜가 들어 있어요. 하루에는 일정을 하나만 만들 수 있어요.'),('button','④ 저장하기  ✓')],
 ['① 1~100 grapheme, 초과 보존. ② 기본값 = 달력 선택 날짜(당일). 기간 시트 규칙은 UI04와 같다(366일, 과거 허용).',
  '③ 하루에 일정 하나: 같은 모임의 활성 일정이 쓰는 날짜(취소된 날 제외)가 기간에 있으면 고르는 즉시 안내하고 저장 비활성. 서버는 SCHEDULE_DATE_TAKEN으로 최종 판정(같은 모임 잠금).',
  '④ 일정과 날짜(일차, 날짜순 1부터)를 함께 만든다. 요청 키로 중복 방지. 성공 ‘일정을 추가했어요’ → UI05. 거부 ‘사용할 수 없는 표현이 있어요. 일정 제목을 바꿔 주세요.’',
  '이탈(제목 입력 후): ‘저장하지 않은 변경이 있어요’/저장·변경 버리기·계속 편집. 일반 참여자는 진입 불가(‘방장만 일정을 바꿀 수 있어요.’).'],
 '필수 누락 / 사용 중인 날짜 포함 / 366일 초과 / 저장 중 / 검사 거부 / 미저장 이탈', 'scheduleCreate calendar')
screen('UI38','하루 일정 변경','F08 F11','현재 방장',[
 ('lead','일정 변경'),('hint','주말 산책 모임'),('field','① 일정 제목 *  |  성수에서 느긋한 오후   9/100'),('field','② 날짜 *  |  2026.10.17  📅'),
 ('hint','🕘 시간은 각 장소에서 입력해요'),('hint','🌏 한국 표준시(Asia/Seoul) 기준'),('button','저장하기  ✓'),('link','③ 📅 일정 취소(기록 보존)  ·  기록은 보관 기한까지 남아요'),('link','④ 🗑 이 날 일정 삭제  ·  장소가 없는 날만 지울 수 있어요')],
 ['달력·목록 카드의 ⋯ → 일정 변경으로 연다. 그날 하나의 제목과 날짜만 고친다(기간 칸 없음). ① 초기값은 날짜 제목 또는 기본 제목, 1~100. 하루·여러 날 모두 날짜 제목으로 저장하며 부모 일정명 유지(Q15).',
  '② 날짜 시트(‘날짜 변경’, 월요일 시작): 다른 일정이 쓰는 날짜와 같은 일정의 다른 날짜는 연하게·선택 불가. 옮기면 방문·기록·진행 업로드 날짜도 함께 옮기고 일차 재번호·시작/종료 재계산. 거부 ‘이미 다른 일정이 있는 날짜예요. 하루에는 일정을 하나만 만들 수 있어요.’',
  '③ ‘이 날 일정을 취소할까요?’/제목/‘기록은 보관 기한까지 남아요. 취소하면 누구도 새 사진·영상을 올릴 수 없고 되돌릴 수 없어요.’/일정 취소하기·돌아가기. 그날만 취소, 모든 날이 취소되면 일정 취소. 취소된 날짜는 다른 일정이 쓸 수 있다.',
  '④ 장소가 담긴 날은 🔒 ‘장소가 담긴 날은 삭제할 수 없어요’(누르면 ‘…장소를 먼저 비워 주세요.’). 장소 없으면 ‘이 날 일정을 삭제할까요?’/‘되돌릴 수 없어요.’. 마지막 날이면 일정 삭제(기록·진행 업로드가 있으면 거부, Q9). 이탈: ‘저장하지 않고 나갈까요?’/나가기·계속 편집.'],
 '사용 중인 날짜 선택 불가 / 변경 없음 비활성 / 장소 있는 날 삭제 잠금 / 취소 확인 / 마지막 날 삭제 / 버전 충돌 / 방장 아님 / 취소된 날 진입 불가', 'scheduleDetail dayUpdate dayCancel dayDelete')
screen('UI08','날짜별 장소','F06 F09 F10 F16','현재 참여자',[
 ('lead','주말 산책 모임'),('hint','2026.10.17 - 10.25'),('row','① 10월 17일 토요일 | 10월 18일 일요일 | 10월 24일 토요일 | 10월 25일 …'),('row','② 10월 17일  토요일                편집 ›'),
 ('hint','성수에서 느긋한 오후'),('card','③ 1  14:00 수정   오후의 커피\n사진 4 · 동영상 1  ›'),('card','2  15:10 수정   서울숲 산책길\n사진 3 · 동영상 1  ›'),('card','3  시간 미정 수정   작은책방 하루\n아직 기록 없음  ›'),('outline','④ 장소 추가')],
 ['① 제목 = 모임 이름. 탭 = 모임의 모든 활성 일정의 취소 안 된 날짜(날짜순, 한 화면 4칸, 가로 스크롤·스냅·선택 탭 자동 스크롤). 탭이 1개면 숨김. 취소된 날 카드로 들어오면 그날을 보기 전용으로 연다(Q10).',
  '② 날짜 머리+편집(→UI12). 날짜 제목 또는 기본 제목({n}일차 · {일정 이름}). 빈 날 ‘가고 싶은 곳을 담아 하루를 채워보세요.’',
  '③ 타임라인: 순번·세로선·시간(HH:mm/시간 미정)+수정(방문 시간 창, 확인 즉시 저장)·장소 카드(이름 2줄, 사진 a · 동영상 b 또는 아직 기록 없음) → UI13. 방금 추가한 장소는 ‘추가됨’ 강조.',
  '④ UI10. 15개 도달·취소된 날·만료 일정이면 비활성과 사유. 일정 전체·장소 미지정 기록 진입은 하단에 추가(기존 유지).'],
 '날짜 없음 ‘이 일정에는 날짜가 없어요.’ / 빈 날 / 15개 도달 / 취소된 날 보기 전용 / 만료 / 권한 상실', 'groupDays calendar scheduleDetail planUpdate mediaList', '02-schedule')
screen('UI09','사람별 보기','F16 F19 F25','현재 참여자',[
 ('lead','오후의 커피'),('hint','우리의 서울 여행 · 10.17 토'),('row','① 함께 남긴 순간  사진 4 · 동영상 1    [사진별 | 사람별✓]   최신순'),
 ('card','② (도) 도윤  사진 1 · 동영상 1 · 14:25         ⋯'),('photo','▶ 0:06  |  [사진]'),('card','(수) 수아  사진 3 · 14:12         ⋯'),('photo','[사진 2:1]\n[사진] [사진]'),('link','③ +2   ·   접기 ⌃')],
 ['① 사진별(UI13)과 같은 화면의 보기 전환(아이콘, 접근성 ‘사진별 보기’/‘사람별 보기’). 정렬 최신순(기본)/오래된순은 게시 묶음 업로드 완료 시각 기준. 화면을 떠나면 처음 상태.',
  '② 작성자 카드(정렬된 목록에서 처음 나온 순서): 아바타·이름·사진 a · 동영상 b · HH:mm·⋯. 격자 1개 전체 폭 4:3 / 2개 정사각 2칸 / 3개 위 1(2:1)+아래 2 / 4개 이상 앞 4칸, 5개 이상은 4번째 칸에 +{전체-3}.',
  '③ +N → 전체 펼침(정사각 2열)+‘접기 ⌃’. 칸 누름 → UI18. ⋯ → ‘사진 다운받기’(그 사람의 이 장소 파일 전체, 동영상 포함, UI21). 설명은 확대 보기에서. 차단한 작성자 카드는 없다.',
  '일정 전체 기록·장소 미지정 기록(기존 유지)도 같은 사진별/사람별·정렬 규칙으로 연다.'],
 '기록 없음 / 로딩·실패 / 펼침·접기 / 차단·운영 제한 반영 / 다운받기 진행', 'mediaList mediaStream avatarStream exportCreate', '04-place')
screen('UI10','장소 검색과 지도','F09','현재 참여자',[
 ('lead','장소 추가'),('hint','우리의 서울 여행 · 2026년 10월 17일 토요일'),('field','① 🔍 장소를 검색하세요 (예: 성수 카페)'),('row','② 전체 · 관광지 · 맛집 · 카페✓ · 숙소'),
 ('map','③ ⟳ 이 지역 다시 검색      ⦿'),('row','④ 검색 위치 기준 15곳     관련도순 ▾'),('card','성수 로스터리 카페  카페\n350m · 서울 성동구 연무장길 33   + 스팟에 추가'),('button','⑤ 이 날의 장소로 추가'),('link','검색에 없나요? 직접 등록')],
 ['① 카카오 키워드 검색 15건, 서울특별시 영역·주소가 서울인 결과만(제외 수 표시). 빈 검색어 무시, 늦은 이전 응답은 버린다. ② 카테고리는 검색어를 비우고 지도 중심 반경 2km 거리순 15건. 전체: 검색어 있으면 재검색, 없으면 결과 지움.',
  '③ 지도 시작 서울시청. 이동 후 재검색, ⦿ 누를 때만 위치 권한(실패 ‘위치 권한이 꺼져 있어요. 지도 위치 기준으로 검색할 수 있어요.’/‘현재 위치를 가져오지 못했어요.’). 거리 기준 = 현재 위치 또는 검색 당시 지도 중심, 1km 미만 10m 단위. 핀 → 결과 강조.',
  '④ 결과 시트(지도 절반 높이, 접으면 84px), 관련도순/거리순, 분류 이모지 썸네일, 이미 담김 ‘✓ 스팟에 추가됨’. 결과 없음 ‘서울특별시 안의 검색 결과가 없어요 (서울 밖 n곳 제외)’, 실패 ‘검색에 실패했어요. 잠시 후 다시 시도해 주세요.’',
  '⑤ 상세 패널(이름·분류·📍주소·📅 선택한 날짜) → 그 날 맨 뒤에 시간 없이 추가 → UI08 복귀·‘추가됨’. 같은 날 같은 장소 거부 ‘{이름}은(는) 이미 {날짜} 장소에 담겨 있어요’, 15개 초과 ‘이 날짜에는 장소를 15개까지 추가할 수 있어요’. 직접 등록 → UI11.'],
 '검색 전 ‘장소를 검색하거나 카테고리를 눌러 보세요’ / 결과 없음 / 공급자 오류 / 지도 로딩 15초 초과·키 오류 / 위치 거절 / 중복 / 15개 도달', 'placesSearch visitCreate', '07-place-search')
screen('UI11','장소 직접 등록','F09','현재 참여자',[
 ('lead','장소 직접 등록'),('field','① 장소 이름  |  우리만의 피크닉 자리'),('field','주소 (선택)  |  입력하지 않음'),('map','② 지도에서 핀 지정 (선택)'),('hint','등록한 장소는 이 모임 안에서만 사용해요. 이 날짜 장소 3/15'),('button','③ 이 날의 장소로 추가')],
 ['기존 유지(프로토타입 화면 없음). UI10 결과 시트 하단 ‘검색에 없나요? 직접 등록’에서 연다. ① 이름 1~100, 주소 200. 좌표 없는 등록 허용, 마커·거리를 만들지 않는다.',
  '② 좌표 소수점 6자리. 같은 날짜에 이름·주소·좌표가 모두 같으면 중복.', '③ 그 날 맨 뒤에 시간 없이 추가, 15개 초과 거부, 지도 공급자에 게시하지 않는다.'],
 '이름 없음 / 좌표 없음 / 중복 / 15개 도달 / 검사 거부', 'visitCreate')
screen('UI12','장소 순서 편집','F10 F11','현재 참여자',[
 ('lead','장소 순서 편집'),('hint','10월 17일 토요일'),('field','① 날짜 제목  |  예: 빵 먹고 전시 보고 저녁까지'),('hint','11/30 · 비워 두면 "10월 17일의 장소"로 보여요'),
 ('hint','위·아래 버튼으로 방문 순서를 바꾸세요.'),('card','1  오후의 커피  서울 성동구 연무장길 21\n② 방문 시간 14:00 ✎        ▲ ▼   ③ 🗑'),('card','2  서울숲 산책길\n방문 시간 15:10 ✎        ▲ ▼'),('button','④ 변경 저장')],
 ['① 변경 입력 최대 30자, 비우면 기본 제목. UI38에서 저장한 기존 31~100자 제목은 원문 유지하며 순서·시간만 저장해도 자르지 않는다(Q15). 날짜 공통 메모 없음.',
  '② 방문 시간 창: 오전/오후·1~12시·00~59분 휠(1분 단위), 처음 값 현재 시간 또는 오후 12시, ‘시간 미정으로 두기’·취소·확인. 편집 사본에만 반영. 시간 변경으로 순서를 바꾸지 않는다.',
  '▲▼(맨 위 ▲·맨 아래 ▼ 비활성). ③ 빈 방문 삭제(기존 유지, 기록·진행 업로드 있으면 잠금). 장소가 없으면 ‘아직 담은 장소가 없어요. 장소를 담으면 여기서 순서와 시간을 바꿀 수 있어요.’',
  '④ 순서·시간·제목을 버전과 함께 한 번에 저장 후 UI08. 동시 수정 충돌·실패 시 입력 유지. 변경 후 뒤로가기는 ‘저장하지 않고 나갈까요?’.'],
 '빈 날 / 저장 중 / 버전 충돌 / 누락·중복·다른 날짜 혼입 거부 / 미저장 이탈 / 취소된 날·만료 비활성', 'planUpdate visitDelete', '09-plan')
screen('UI13','장소 기록 · 사진별','F14 F16 F19','현재 참여자',[
 ('lead','오후의 커피'),('hint','우리의 서울 여행 · 10.17 토'),('button','① ＋ 사진·동영상 올리기'),('row','② 함께 남긴 순간  사진 4 · 동영상 1   [사진별✓ | 사람별]   최신순   선택'),
 ('photo','③ ▶ 0:06\n14:25 · 도윤   김이 모락모락'),('photo','14:25 · 도윤   디저트도 하나'),('photo','14:12 · 수아   창가 자리 찾았어요'),('button','④ 3개 다운받기')],
 ['① 업로드 시트(UI14). 취소된 날·만료 일정이면 비활성과 사유. 진행 중 전송이 있으면 상단 진행 띠 → UI17.',
  '② 섹션 제목 ‘함께 남긴 순간’(동영상 없으면 ‘함께 남긴 사진’)+사진/동영상 수. 정렬 최신순(기본)/오래된순: 게시 묶음 업로드 완료 시각(연도 포함), 묶음 안은 고른 순서. 기록은 방문(일정·날짜·장소) 단위.',
  '③ 파일 1개 = 카드 1장, 4:3 cover, 동영상 ▶·길이, 아래 띠 작성자 아바타·HH:mm · 이름·설명 1줄. 누르면 UI18. 이미지 실패 ‘🖼️ 이미지를 불러오지 못했어요’.',
  '④ 선택 모드(‘선택’ 또는 길게 누르기): 체크·전체 선택/전체 해제·취소, 하단 ‘{n}개 다운받기’(0개 ‘사진을 선택하세요’), 최대 120개 → UI21. 본인 파일만 선택되면 정보 수정·삭제(UI20·F18) 제공. 빈 상태 ‘아직 이곳에 남긴 사진·동영상이 없어요.\\n스팟원이 올리면 여기에 모여요.’'],
 '로딩·실패·다시 시도 / 기록 없음 / 정렬 전환 / 선택 모드 / 다운받기 진행 / 업로드 진행 띠 / 취소된 날·만료', 'mediaList mediaStream avatarStream exportCreate uploadGet', '04-place')
screen('UI14','사진·동영상 올리기','F12 F13 F14','현재 참여자',[
 ('lead','지금 이 순간 남기기'),('photo','① [사진 ✕] [▶ 0:12 ✕] [사진 ✕]  [＋]'),('hint','② 사진·동영상 최대 10개'),('hint','③ 내가 이 장소에 올릴 수 있는 수  사진 2/5 · 영상 1/2'),('button','④ 업로드하기'),
 ('card','⑤ 🖼️ 사진 보관함에서 선택\n🎞️ 동영상 보관함에서 선택\n📷 사진 촬영\n🎥 동영상 촬영\n취소')],
 ['① 담은 항목 76×76, 가로 스크롤, ✕(빼기). 동영상은 ▶와 길이 m:ss. ＋는 담은 수 10개 미만일 때 → ⑤ 선택 시트. 시트를 닫아도 화면을 떠나기 전까지 유지.',
  '② 한 번에 최대 10개, 넘치면 ‘사진과 동영상은 최대 10개까지 올릴 수 있어요’. 같은 파일(기기 자산 ID, 없으면 파일 이름·크기)은 이미 담겼거나 같은 선택 안에서 겹치면 한 번만 담고 ‘이미 추가한 파일은 다시 담지 않았어요’.',
  '③ P11 작성자별 장소당 사진 5·영상 2 남은 수(완료+진행 합산, Q3). ④ 1개 이상일 때. 방문=이 장소, 기록일=그 방문 날짜, 설명 입력 없음(Q6). 서버가 파일별로 한도·규격 검사 후 넘는 파일만 거부 → UI17 추적, 시트 비우고 닫기.',
  '⑤ 보관함: 시스템 사진 선택기(사진만/동영상만) 다중, 남은 칸 수까지, 고른 순서 유지. 촬영: 카메라 권한(거부 ‘카메라 권한이 필요해요’)·후면 기기 카메라. 검증 사진 50MB·동영상 60초·200MB. 선택기 오류 ‘불러오지 못했어요’.'],
 '빈 시트(업로드 비활성) / 10개 도달 / 중복 제외 / 권한 거절 / 파일 검증 실패 / 한도 초과 파일 / 취소된 날·만료 진입 불가', 'uploadPrepare uploadLimits', '06-media-source')
screen('UI15','사진·동영상 촬영','F12','현재 참여자',[
 ('camera','① 기기 카메라 (후면)'),('row','사진  /  동영상'),('hint','② 마이크 권한이 없으면 무음으로 촬영'),('button','③ 촬영 → 사용'),('outline','취소')],
 ['① UI14 선택 시트의 사진 촬영·동영상 촬영에서 기기 카메라를 연다(앱 내 길이 선택 없음, D15). 앱 매니페스트에 카메라·마이크 권한 선언.',
  '② 동영상 촬영 결과도 60초·200MB 검증(Q7). 초과는 담지 않고 사유 안내.', '③ 사용하면 UI14 시트에 담긴다. 취소는 시트에 영향 없음. 앱 전환·전화 뒤에도 유효한 결과만 담는다.'],
 '카메라 거절 / 촬영 취소 / 검증 실패 / 저장공간 부족', 'uploadPrepare')
screen('UI16','기록 선택','F17 F18 F19','현재 참여자 또는 본인 기록 경로',[
 ('row','① 전체 선택   ·   취소'),('photo','✓ [사진]   ✓ [▶ 동영상]\n□ [사진]   ✓ [사진]'),('hint','② 3개 선택됨 · 최대 120개'),('button','③ 3개 다운받기'),('row','④ 내 기록만 선택하면  정보 수정  ·  삭제')],
 ['① UI13 사진별·일정 전체 기록·UI22에서 ‘선택’ 또는 길게 누르기로 들어간다. 카드 누름 = 체크 토글(확대 보기 안 열림). 전체 선택은 불러온 항목만.',
  '② 최대 120개. 보기 전환·화면 이탈 시 선택 종료. ③ UI21 다운로드(동영상은 동영상 파일).',
  '④ 기존 유지: 선택이 모두 본인 파일이면 정보 수정(UI20)·삭제(F18). 타인 파일이 섞이면 비활성과 이유.'],
 '0개(다운받기 비활성 ‘사진을 선택하세요’) / 120개 도달 / 타인 혼합 / 선택 중 삭제·만료', 'exportCreate metadataPatch mediaDelete', '05-upload')
screen('UI17','파일 전송 상태','F15 F20 F26','업로드 작성자',[
 ('lead','순간을 모으는 중이에요'),('card','① 1번 사진  ·  완료 ✓'),('card','② 2번 동영상  ·  서버 확인 중\n전송 100% · 위치 제거·검사 진행'),('card','③ 3번 사진  ·  실패\n네트워크 연결 확인  /  재시도'),('card','④ 4번 동영상  ·  검토 대기\n아직 공개되지 않았어요  /  문의'),('outline','실패 파일만 다시 시도'),('link','미완료 작업 취소  ·  닫기')],
 ['기존 유지. UI13 진행 띠에서 연다. ① 완료 파일만 목록·개수에 반영. ② 전송 100%는 완료가 아니다. 검토 대기는 비공개.',
  '③ 파일별 1·2·4초 최대 3회 자동 재시도, 오프라인 대기는 횟수 미소모, 동시 3개.', '하루·일정 취소 전에 접수한 같은 파일은 완료·재시도 가능. 권한 소멸·종료·만료·사용자 취소가 우선한다.'],
 '준비·대기 / 전송 / 서버 확인 / 검토 / 완료 / 실패 / 취소 / 결과 확인 필요', 'uploadGet uploadRetry uploadCancel uploadCommit')
screen('UI18','확대 보기와 동영상 재생','F16 F17 F18 F19 F25','현재 참여자 또는 본인 보존 경로',[
 ('row','① ✕'),('photo','② 사진 (1·2·3·4배)  /  동영상 자동 재생'),('row','③ －   2배   ＋'),('row','④ 도윤 · 10.17 14:25'),('hint','김이 모락모락'),('row','⑤ 휴대폰에 저장  ·  정보 수정  ·  삭제  ·  신고')],
 ['① 전체 화면, ✕·뒤로가기로 닫힘. 닫으면 재생 중지·목록 위치 유지. 이전/다음 넘기기 없음.',
  '② 사진: 화면 높이 72% 영역에 맞춤, 두 번 탭 1↔2배(확대 중이면 1배), ③ －/＋ 단계(끝 단계 비활성), 확대 시 가운데부터 상하좌우 이동. 동영상: 열자마자 재생·기본 컨트롤·반복 없음, 실패 ‘동영상을 재생하지 못했어요’+다시 시도.',
  '④ 작성자·날짜 시각·설명. ⑤ 기존 유지: 저장(UI21), 본인 정보 수정(UI20)·삭제, 타인 신고·차단(UI31). 방장도 타인 파일 수정·삭제 불가.'],
 '불러오는 중 / 재생 실패 / 만료·삭제·권한 상실 / 본인 보존 경로(저장 숨김)', 'mediaStream avatarStream metadataPatch mediaDelete reportCreate exportCreate', '04-place')
screen('UI20','본인 기록 정보 수정','F17','현재 참여 중인 작성자',[
 ('lead','① 내 기록 3개 수정'),('row','② [✓] 설명 적용   /   [ ] 유지'),('field','설명 | 함께한 산책  [설명 비우기]   12/1000'),('row','[✓] 기록일 적용   2026.10.18 >'),('row','[✓] 방문 적용  |  장소 미지정 >'),('banner','③ 변경할 필드와 3개 대상을 확인해요'),('button','④ 3개에 함께 적용')],
 ['기존 유지. 업로드 시트에 설명 입력이 없으므로 설명은 여기서 입력한다(Q6, 1000자). ② 필드별 적용/유지, 설명 비우기·방문 해제는 명시적 동작.',
  '③ 본인·같은 일정·120개·버전·옮겨 갈 방문의 사진5/영상2 검증. 설명 검사 중에는 기존 공개 내용 유지.', '④ 하나라도 오류면 전체 미적용, 대상별 이유·입력 유지.'],
 '필드 미선택 / 다른 일정 혼입 / 한도 초과 / 검사 중·거부 / 버전 충돌', 'metadataPatch')
screen('UI21','다운로드(휴대폰 저장)','F19 F20','현재 참여자',[
 ('lead','선택한 기록 3개'),('card','① 사진 2개  ·  동영상 1개\n위치 정보를 제거한 파일로 준비해요'),('row','② 파일 준비 중  2/3'),('hint','Pictures/At that place\nMovies/At that place'),('hint','③ 다른 앱으로 보내는 기능은 제공하지 않아요.')],
 ['UI16 ‘{n}개 다운받기’, UI09 ‘⋯ → 사진 다운받기’, UI18 저장에서 시작. ① 위치 제거 저장본, 동영상은 동영상 파일(프로토타입은 대표 이미지를 넘김).',
  '② 준비·내려받기·기기 쓰기 구분, 성공 ‘{n}개를 저장했어요’, 부분 실패는 성공/실패 수·실패만 재시도, 실패 ‘저장하지 못했어요’. 임시 파일은 기기 쓰기 후 정리.', '③ purpose=save만 허용.'],
 '준비 / 다운로드 / 기기 쓰기 / 부분 실패 / 공간 부족 / 저장 권한 거절 / 권한 변경', 'exportCreate exportGet exportFile')
screen('UI22','내가 올린 기록','F18 F21','로그인한 작성자',[
 ('lead','내 기록'),('row','① 전체 모임 >  ·  기한순 >  ·  선택'),('card','주말 산책 · 우리의 서울 여행\n참여 중 · 2027.01.19까지'),('photo','[사진]  [▶ 0:06]'),('card','② 이전 모임 · 바다 여행\n참여 종료 · 본인 조회·삭제 가능'),('outline','③ 선택한 내 기록 삭제')],
 ['기존 유지. 내 모임 하단 탭 ‘내 기록’에서 연다(프로토타입은 토스트). ① 활성 참여·초대를 요구하지 않는다.',
  '② 참여 종료 모임의 본인 파일은 조회·삭제만. 타인 파일·공동 계획·참여자는 보이지 않는다.', '③ 최대 120개·여러 모임 혼합. 파일별 성공·실패·이미 삭제 결과. 서버 삭제는 기기 앨범 삭제가 아님을 안내.'],
 '참여 중·종료 / 만료 30일 카드 / 파일별 삭제 실패 / 이미 삭제', 'mineList mediaDelete')
screen('UI23','초대·관리','F04 F05','모든 현재 참여자(방장 포함)',[
 ('lead','모임에 초대하기'),('row','① 모임 사진 [사진]  내 모임 목록에 보이는 대표 사진이에요   변경'),('hint','👥 주말 산책 모임\n현재 6/10명 · 초대는 7일 · 확인 50회까지'),
 ('card','② 초대 코드  사용 가능\nQ7KM2P8R   👆 탭하여 코드 복사하기\n발급 11.02 22:43  /  만료 11.09 22:43\n👁 확인 횟수 12 / 50회'),('row','③ 🔗 링크 복사    ↗ 공유하기'),('link','이 초대 취소하기 ›'),
 ('hint','ℹ️ 받은 사람이 다른 사람에게 전달하면 그 사람도 참여할 수 있어요.'),('card','④ 이전 초대 4\nM3XT9KQ2  사용 가능  공유 취소 · 확인 45/50회 · 5회 남음\nH5TW8C2N  소진 50/50'),('button','⑤ ＋ 새 초대 발급하기')],
 ['① 방장만 보이는 모임 사진 행: 사진 보관함 1장, 4:3 자르기, 위치 제거·검사 후 반영, ‘모임 사진을 바꿨어요’. 기본 이미지로 되돌리기 추가(기존 유지). 실패 ‘사진 용량이 너무 커요. 더 작은 사진을 골라 보세요.’ 등.',
  '② 현재 카드 = 사용 가능한 초대 중 가장 최근 1개. 코드 8자(0·O·1·I 제외), 탭 복사 ‘코드를 복사했어요’, 168시간, 성공한 확인 50회 소진, 10회 이하 남으면 ‘· n회 남음’. 정원이 차면 ‘지금은 정원이 다 찼어요. 자리가 나야 새로 참여할 수 있어요.’',
  '③ 링크 복사 ‘링크를 복사했어요’, 공유하기 = OS 공유 시트(메시지: [At that place] ‘{모임}’에 초대해요./일정/링크·코드/만료 시각), 실패 ‘공유할 수 없어요. 링크 복사를 이용해 주세요’. 취소 확인 ‘이 초대를 취소할까요?’/‘이 링크와 코드로는 더 이상 참여할 수 없어요. 이미 참여한 사람은 그대로예요.’',
  '④ 이전 초대(발급 최신순): 상태 사용 가능/소진 n/50/만료/취소, 사용 가능 행 공유·취소. ⑤ 요청 키로 발급, 기존 초대 유지 ‘새 초대를 만들었어요’. 빈 상태 ‘지금 사용할 수 있는 초대가 없어요’. 1분마다 만료 반영, 충돌 시 ‘초대 상태가 바뀌어 다시 불러왔어요’.'],
 '불러오는 중 / 첫 조회 실패 / 재조회 실패 띠 / 빈 상태 / 발급 실패·종료 모임 / 정원 10명 / 취소 충돌 / 모임 사진 검사 중', 'invitesList inviteCreate inviteRevoke groupUpdate coverPrepare')
screen('UI24','초대 확인과 참여','F01 F05','초대받은 사용자',[
 ('lead','초대 확인'),('row','✉️ 초대장 확인'),('lead','모임에 초대받았어요!'),('field','① 🔑  Q7KM2P8R   ✓ 코드 형식이 맞아요   8 / 8'),
 ('card','② 초대된 모임  주말 산책 모임  🔒 비공개 모임\n📅 일정  우리의 서울 여행 · 10.17 – 10.19   D-3\n🛡 참여 후에 장소와 기록을 볼 수 있어요'),('hint','✅ 확인한 내용은 로그인 뒤에도 유지돼요.\n⏱ 초대는 발급 후 7일 동안, 확인 50회까지 쓸 수 있어요.'),('button','③ 모임 참여하기  →')],
 ['① 입력마다 링크에서 코드 추출·대문자·영숫자만·8자. 8자면 ‘✓ 코드 형식이 맞아요’, 확인 버튼·키보드 검색키로 확인(성공한 확인마다 50회 중 1회). 링크로 열면 자동 확인. 입력을 바꾸면 미리보기 해제.',
  '② 로그인 전에도 모임 이름·대표 일정·D-day만 공개(‘사진·참여자 목록·장소 계획은 참여한 사람에게만 보여요.’). 일정 없으면 ‘아직 일정이 없어요’.',
  '③ 로그인 전 ‘로그인하고 참여 계속하기 →’(보류 초대 저장), 가입 후 ‘모임 참여하기 →’. 서버 재검사 후 ‘{모임}’에 참여했어요/이미 참여 중인 모임이에요 → UI05 교체.',
  '거절: 코드 불일치 / 기한(7일) / 확인 횟수(50회) / 취소 / 종료 모임 / 정원(10명) / 재참여 차단 / 100개 한도 / 오프라인 / 서버 오류. 최종 거절은 버튼이 ‘닫기’, 보류 초대 삭제.'],
 '코드 입력 중 / 형식 확인 / 확인 중 / 미리보기 / 로그인 전·후 / 최종 거절 / 재시도 가능 거절 / 이미 참여', 'invitePreview inviteJoin')
screen('UI25','모임 이름 변경','F04','현재 방장',[
 ('lead','모임 정보'),('field','① 모임 이름  |  주말 산책 모임   9/50'),('row','② 모임 사진  [사진]   변경  ·  기본 이미지로 되돌리기'),('button','변경 저장')],
 ['기존 유지(프로토타입 화면 없음). 모임 달력 머리의 방장 메뉴에서 연다. ① 1~50, 공개 전 검사, 버전 확인.',
  '② 모임 사진 변경은 UI23과 같은 흐름(4:3). 기본 이미지로 되돌리면 이름 첫 글자 썸네일.', '취소·검사 실패·동시 충돌 시 기존 정보와 입력을 유지한다.'],
 '검사 중 / 거부 / 버전 충돌 / 일반 참여자 거부', 'groupUpdate coverPrepare')
screen('UI26','함께하는 친구','F22 F23 F25','현재 참여자·방장',[
 ('lead','주말 산책 모임'),('row','① 함께하는 친구 6'),('hint','함께할 친구나 가족을 초대해보세요.\n일정을 함께 기록할 수 있습니다. (최대 10명)'),('yellow','② 💬 카카오톡 초대'),('outline','🔗 초대링크 복사'),
 ('row','(지) 지민  방장  나'),('row','(수) 수아                    ③ ⋯'),('row','(도) 도윤                    ⋯'),('link','④ 다시 참여 막은 사람  ·  모임 나가기')],
 ['① 모임 달력 상단 인원 띠에서 연다. 목록: 프로필 사진 또는 이름 첫 글자, 이름 1줄, 방장·나 태그. 소셜 식별값·연락처 비노출.',
  '② 현재 사용 가능한 가장 최근 초대로 카카오 공유/링크 복사, 없으면 새로 발급(Q8). 메시지는 UI23과 같다.',
  '③ 방장에게만 다른 사람 행의 ⋯(‘{이름} 더보기 메뉴’): ‘모임에서 내보낼까요?’/이름/‘내보낸 사람은 같은 초대로 다시 참여할 수 없어요.’/내보내기·취소 → ‘{이름}님을 내보냈어요’. 사용자 ID로 모임 재참여 차단. 방장 넘기기 메뉴 추가(기존 유지).',
  '④ 기존 유지: 방장의 재참여 차단 해제 목록, 모든 참여자의 모임 나가기(UI27), 참여자 신고·차단(UI31).'],
 '일반 참여자는 ⋯ 없음 / 내보내기 실패 ‘내보내지 못했어요. 잠시 후 다시 시도해 주세요’ / 대상이 이미 나감 / 방장 이전 충돌', 'membersList avatarStream memberRemove ownerTransfer reentryUnblock invitesList inviteCreate')
screen('UI27','모임 나가기와 종료','F22 F23','현재 참여자·방장',[
 ('lead','① 모임을 나가시겠어요?'),('card','올린 기록은 표시된 기한까지 유지돼요.\n본인 기록은 나간 뒤에도 조회·삭제 가능해요.'),('hint','나간 뒤 새 저장·정보 수정은 불가해요.'),('row','② 방장인 경우 후임 선택 >'),('banner','③ 혼자 남은 방장은 모임 종료와\n본인 서버 기록 삭제를 확인해 주세요.'),('button','④ 확인하고 나가기'),('outline','돌아가기')],
 ['기존 유지(프로토타입 화면 없음). UI26 하단 ‘모임 나가기’. ② 다른 참여자가 있으면 방장 이전 먼저.', '③ 마지막 1명일 때만 종료, 타인 유효 파일은 기한까지 본인 조회/삭제용 보존, 재개 불가.', '④ 새 참여·역할 이전과 직렬화해 재검증.'],
 '일반 나가기 / 후임 필요 / 마지막 방장 / 동시 참여로 종료 거부', 'groupLeave groupClose')
screen('UI28','설정','F02 F05 F24 F28','로그인한 본인',[
 ('lead','설정'),('row','① 프로필 및 계정  ›'),('row','친구초대   ② 초대코드 입력  ›'),('row','서비스 설정   ③ 위치 서비스      기기 설정에서 변경'),
 ('row','서비스 약관   ④ 서비스 이용약관 › · 개인정보 처리방침 › · 위치정보 이용약관 › · 서비스 이용정책 ›'),('row','⑤ 동의 내역 · 로그인 수단 · 차단 목록·신고 결과 · 저장 공간과 캐시 · 문의  ›'),('outline','⑥ 로그아웃'),('link','서비스 탈퇴')],
 ['마이페이지 ⚙에서 연다. ① UI37. ② 창 ‘초대코드 입력’(자동 포커스·대문자·최대 12자·‘친구에게 받은 코드를 입력하세요’·참여하기) → UI24.',
  '③ 기기 앱 설정 열기, 실패 ‘기기 설정에서 위치 권한을 바꿔 주세요’. ④ 게시 문서 열기(Q11). ⑤ 기존 유지 항목(동의 내역·선택 동의 변경, 로그인 수단 UI29, 차단·신고 UI31, 저장 공간 UI33, 문의).',
  '⑥ ‘로그아웃할까요?’/취소·로그아웃 → UI01(진행 업로드가 있으면 먼저 확인). 서비스 탈퇴 ‘탈퇴하면 내 기록을 되돌릴 수 없어요. 정말 탈퇴할까요?’ → UI30.'],
 '문서 열기 실패 / 업로드 중 로그아웃 / 세션 만료', 'consentDocs consentUpdate logout inquiryCreate')
screen('UI29','로그인 수단 관리','F01','재인증한 본인',[
 ('lead','로그인 수단'),('card','① 카카오  ·  연결됨'),('card','Google  ·  연결하기'),('hint','같은 이메일이어도 자동 연결하지 않아요.'),('outline','② 본인 재인증'),('link','연결 해제')],
 ['기존 유지. ① 실제 연결 목록. Google도 연결 가능(D01). ② 본인 재인증과 새 공급자 인증 모두 필요, 다른 계정 소유이면 거부.', '마지막 로그인 수단 해제 거부. 토큰을 화면·로그에 노출하지 않는다.'],
 '연결 성공 / 다른 계정 사용 중 / 마지막 수단 해제 거부 / 재인증 만료', 'identityLink identityUnlink')
screen('UI30','서비스 탈퇴(계정 삭제)','F24 F02','재인증한 본인',[
 ('lead','계정을 삭제하기 전에'),('card','① 방장 역할 정리 필요 2개\n산책 모임: 방장 넘기기 >\n혼자 있는 모임: 종료와 본인 기록 삭제 >'),('hint','② 모든 모임의 내 서버 기록이 삭제돼요.'),('row','[ ] 삭제 결과를 확인했어요'),('button','③ 본인 확인 후 계정 삭제')],
 ['기존 유지. 설정 ‘서비스 탈퇴’ 확인 후 연다. ① 방장 역할 정리가 남으면 거부(자동 후임 없음).', '② 작성자 ID로 전체 파일을 찾아 접근·업로드부터 차단.', '③ 삭제 직전 재검증, 조회 차단과 물리 정리 진행을 분리.'],
 '역할 정리 필요 / 재인증 / 삭제 접수·정리 중 / 결과 불명', 'accountDelete')
screen('UI31','신고와 개인 차단','F25 F26','현재 참여자',[
 ('row','① 신고 대상  |  수현의 사진'),('field','사유  |  내용을 입력해 주세요   0/2000'),('button','② 신고 접수'),('outline','③ 이 사용자의 기록 숨기기'),('card','내 신고 결과\n검토 중 · 문의용 번호 RPT-2026-…'),('link','차단 목록  /  조치 이의 문의')],
 ['기존 유지. UI18·UI26에서 연다. ① 파일·모임 사진·참여자 신고, 사유 2000자.', '② 신고만으로 자동 삭제하지 않는다. 최초 24시간·이의 3영업일.', '③ 개인 차단은 내 사진별·사람별·개수·다운로드에만 적용. 방장 역할·타인 화면 불변.'],
 '중복 신고 / 검토·조치 / 차단·해제', 'reportCreate reportsMine blockCreate blockDelete inquiryCreate')
screen('UI32','방장 부재 복구 문의','F27','현재 참여자',[
 ('lead','방장 부재 복구 요청'),('field','① 부재 사유와 최소 확인 자료'),('row','② 후임 후보  |  수현 >'),('banner','③ 기존 방장에게 통지하고 7일간\n응답을 기다린 뒤 담당자가 검토해요.'),('button','④ 복구 검토 요청')],
 ['기존 유지. 접수만으로 역할을 바꾸지 않는다.', '후임 별도 동의·본인 확인 필요.', '7일 경과만으로 자동 승인하지 않는다.'],
 '자료 부족 / 통지·응답 대기 / 보류 / 승인·거절', 'recoveryCreate recoveryGet')
screen('UI33','저장 공간과 캐시','F28','로그인한 본인·모임 참여자',[
 ('lead','저장 공간'),('card','① 모임 원본  1.2GB / 5GB'),('card','② 기기 재생 캐시 210MB / 최대 500MB'),('card','③ 미완료 업로드 임시 파일 80MB'),('outline','④ 재생 캐시만 정리')],
 ['기존 유지. 설정에서 연다. ① 완료 원본+예약, 5GB=5,000,000,000바이트.', '② LRU 500MB. ③ 유일 업로드 원본은 정리 대상 아님.', '④ 캐시 삭제는 서버 기록 삭제가 아니다.'],
 '조회 실패 / 한도 도달 / 정리 중', 'storageUsage')
screen('UI34','운영 검토와 복구 관리','F25 F26 F27','별도 인증 운영자',[
 ('lead','운영 검토 큐'),('row','① 검사 대기 12  /  신고 3  /  복구 1'),('card','② 비공개 영상 · 판정 불가'),('outline','③ 제한 / 삭제 / 해제 / 이용 제한'),('field','처리 사유  |  필수 입력'),('button','④ 검증 후 조치 확정')],
 ['기존 유지. 운영 전용 웹(목록+상세 2열)의 모바일 폭 와이어프레임.', '③ 운영 권한·사유·처리자·시각 감사 이력. 검사 장애는 비공개 수동 검토.', '④ 복구는 통지·7일 대기·후임 동의 후 버전 재검증.'],
 '권한 부족 / 동시 조치 / SLA 초과', 'opsQueue opsAction opsRecovery')
screen('UI35','결과 확인과 오류','F01 F03 F08 F15 F28','작업 중 사용자',[
 ('lead','① 저장 결과를 확인 중이에요'),('hint','요청은 접수됐을 수 있어요.\n내용을 다시 만들지 않고 확인할게요.'),('outline','② 같은 요청 결과 확인'),('hint','③ 문의용 번호 {요청 키}'),('card','④ 인터넷에 연결되어 있지 않아요.\n연결을 확인하고 다시 시도해 주세요.'),('outline','다시 시도')],
 ['① 응답 유실 시 입력을 잠그고 결과 확인 카드를 보여 준다(UI04 등). ② 같은 요청 키로 결과를 확인, 결과 없음이면 화면별 안내(예: ‘모임이 만들어지지 않았어요. 다시 시도해 주세요.’).',
  '④ 공통 문구: 오프라인 / 그 외 ‘잠시 문제가 생겼어요. 다시 시도해 주세요.’ 확인창은 아래쪽 카드(마지막 버튼이 가장 안전), 토스트 1.8초, 화면 전환 후 결과는 다음 화면이 한 번 보여 준다.',
  '버전 충돌은 자동 덮어쓰지 않고 내 입력을 유지한다. 권한 상실 시 공동 화면에서 나가되 본인 기록 경로는 유지.'],
 '로딩 / 빈 결과 / 조회 실패 / 오프라인 / 충돌 / 결과 불명 / 권한 상실', 'operationGet')
screen('UI36','마이페이지','F02 F28 F29','로그인한 본인',[
 ('lead','마이페이지                      ⚙'),('photo','① (프로필 사진 96 📷)'),('lead','지민'),('hint','함께한 순간을 기록하는 중'),('card','② 참여한 모임   5개  ›'),('button','③ 닉네임 변경'),('link','④ 공지사항  |  고객센터')],
 ['내 모임 하단 탭 ‘마이페이지’에서 연다. ⚙ → UI28. ① 누르면 프로필 사진 변경(1:1, F29) ‘프로필 사진을 바꿨어요’.',
  '② 서버의 현재 참여 모임 수(0개는 0개), 누르면 UI03. ③ 창 ‘닉네임 변경’·‘닉네임을 입력하세요’·최대 12자 {n}/12·trim 후 1자 이상 저장(키보드 완료 포함)·취소 → ‘닉네임을 바꿨어요’. 가입 표시명과 같은 필드, 검사 적용(Q2).',
  '④ 게시 경로 확정 후 연결(프로토타입 ‘…아직 준비 중이에요’).'],
 '정보 로딩 / 참여 수 조회 실패 / 닉네임 빈 값·검사 거부 / 사진 검사 중', 'profileGet profilePatch groupsList avatarPrepare avatarStream')
screen('UI37','프로필 및 계정','F01 F02 F29','로그인한 본인',[
 ('lead','프로필 및 계정'),('photo','① (프로필 사진 112 📷)'),('row','② 지민   수정'),('link','③ 기본 사진으로 되돌리기'),('row','④ 로그인 방식   ● 카카오')],
 ['설정 ‘프로필 및 계정’에서 연다. ① 사진 보관함 1장, 1:1 자르기, 위치 제거·검사 후 반영. 실패 ‘사진을 불러오지 못했어요. 다른 사진을 골라 보세요.’ 등.',
  '② 닉네임 변경 창(UI36과 같다). ③ 직접 고른 사진이 있을 때만, ‘기본 사진으로 되돌렸어요’.',
  '④ 실제 연결된 공급자(카카오/Google)를 표시한다(프로토타입은 고정값 카카오). 로그인 수단 관리는 UI29.'],
 '조회 실패 / 사진 검사 중·거부 / 닉네임 저장 실패 / 세션 만료', 'profileGet profilePatch identitiesList avatarPrepare avatarStream')

APIS=[]
def api(id,method,path,features,auth,req,res,errors):
    APIS.append(dict(id=id,method=method,path=path,features=features.split(),auth=auth,request=req,response=res,errors=errors))
api('authExchange','POST','/auth/exchange','F01','public','provider:kakao|google, credential, nonce, loginAttemptId','session, user, onboardingRequired','AUTH_CANCELLED AUTH_INVALID PROVIDER_UNAVAILABLE')
api('sessionRefresh','POST','/auth/refresh','F01','refresh-session','refreshToken','session','AUTH_EXPIRED')
api('consentDocs','GET','/consent-documents','F02','public','locale=ko','documents[{id,itemKey,title,version,kind,required,url,development}] (v3 가입 동의 consent 4종: 서비스 이용약관·개인정보 수집 및 이용 필수, 마케팅·위치정보 선택)','DOCUMENT_UNAVAILABLE')
api('onboard','POST','/onboarding','F02','authenticated','displayName(1~20), consents[{documentId,version,agreed:true|false}] (게시 consent 문서 버전마다)','user, consentReceipts','CONSENT_REQUIRED TEXT_REJECTED')
api('profilePatch','PATCH','/me/profile','F02 F28 F29','self','displayName?(1~20), avatarAssetId? | restoreDefaultAvatar?:true, expectedVersion','profile{...,avatarVersion} or operation','VALIDATION_ERROR FILE_INVALID TEXT_REJECTED VERSION_CONFLICT')
api('consentUpdate','PATCH','/me/consents','F02','self','items[{documentId,version,agreed}]','consentReceipts','REQUIRED_WITHDRAWAL_REQUIRES_DELETION')
api('identityLink','POST','/me/identities','F01','self-recent-auth','provider, credential, reauthProof','identities','IDENTITY_IN_USE REAUTH_REQUIRED')
api('identityUnlink','DELETE','/me/identities/{identityId}','F01','self-recent-auth','expectedVersion','identities','LAST_IDENTITY REAUTH_REQUIRED')
api('groupsList','GET','/groups','F03 F21','authenticated','cursor?, limit<=30','items[], nextCursor','AUTH_EXPIRED')
api('groupCreate','POST','/groups','F03 F07','authenticated','name, firstSchedule:ScheduleInput','group, membership, firstSchedule or operation','GROUP_LIMIT OWNER_CREATE_LIMIT VALIDATION_ERROR TEXT_REJECTED SCHEDULE_DATE_TAKEN')
api('groupUpdate','PATCH','/groups/{groupId}','F04','owner','name?, coverAssetId?, restoreDefault?, expectedVersion','group or operation','FORBIDDEN VERSION_CONFLICT TEXT_REJECTED')
api('coverPrepare','POST','/groups/{groupId}/cover-uploads','F04 F20 F26','owner','file{name,mime,declaredBytes<=5MB,fingerprint} (4:3 자르기, 긴 변1600px)','taskId, uploadEndpoint, state','FILE_INVALID FORBIDDEN')
api('groupDays','GET','/groups/{groupId}/days','F06 F10','member','cursor?, limit:1..60 (월 범위 없음)','items:GroupDay[], nextCursor','FORBIDDEN GROUP_CLOSED INVALID_CURSOR')
api('calendar','GET','/groups/{groupId}/calendar','F06','member','from:date, to:date (inclusive <=366 days)','schedules[{...,days[{date,dayNo,title,status,visitCount}]}], dateCounts','RANGE_TOO_LARGE FORBIDDEN')
api('scheduleDetail','GET','/schedules/{scheduleId}','F06 F21','member','none','schedule, days[{date,dayNo,title,status,visitCount}], retention, plan[{date,title,visits[{...,plannedTime}],visitLimit:15}], version','FORBIDDEN EXPIRED')
api('scheduleCreate','POST','/groups/{groupId}/schedules','F07','owner','ScheduleInput{title,startDate,endDate,timezone} (반복·시각 없음, 각 날짜가 일차)','schedule or operation','VALIDATION_ERROR TEXT_REJECTED FORBIDDEN SCHEDULE_DATE_TAKEN')
api('scheduleUpdate','PATCH','/schedules/{scheduleId}','F08','owner','title?, startDate?, endDate?, expectedVersion, confirmOutsideRange? (v3 1차 화면 미제공·서버 호환 유지)','schedule or operation; 미확인 기간 밖 영향은 409 OUTSIDE_RANGE_CONFIRMATION_REQUIRED + details{visits,media}','VERSION_CONFLICT VALIDATION_ERROR OUTSIDE_RANGE_CONFIRMATION_REQUIRED TEXT_REJECTED FORBIDDEN SCHEDULE_CANCELLED SCHEDULE_DATE_TAKEN')
api('scheduleCancel','POST','/schedules/{scheduleId}/cancellation','F08','owner','expectedVersion','schedule(status=cancelled)','VERSION_CONFLICT ALREADY_CANCELLED FORBIDDEN')
api('scheduleDelete','POST','/schedules/{scheduleId}/deletion','F11','owner','expectedVersion','deletedId, deletedVisitIds','NOT_EMPTY VERSION_CONFLICT FORBIDDEN')
api('dayUpdate','PATCH','/schedules/{scheduleId}/days/{date}','F08','owner','expectedVersion(일정), title?(날짜 제목1~100·생략 유지), date?(다른 날짜 하나로 이동)','DayChangeResult{schedule,days[]} or operation','SCHEDULE_DATE_TAKEN DAY_BUSY TARGET_NOT_EMPTY SCHEDULE_CANCELLED VERSION_CONFLICT NOT_FOUND FORBIDDEN TEXT_REJECTED')
api('dayCancel','POST','/schedules/{scheduleId}/days/{date}/cancellation','F08','owner','expectedVersion(일정)','DayChangeResult{schedule,days[]} (모든 날 취소 시 schedule.status=cancelled)','ALREADY_CANCELLED VERSION_CONFLICT NOT_FOUND FORBIDDEN')
api('dayDelete','POST','/schedules/{scheduleId}/days/{date}/deletion','F08 F11','owner','expectedVersion(일정)','DayChangeResult{schedule|null,days[]} (마지막 날이면 일정 삭제)','NOT_EMPTY VERSION_CONFLICT NOT_FOUND FORBIDDEN')
api('placesSearch','GET','/places','F09','member-context','groupId, query?, category, bounds?, sort, center?, page?','places[<=15], provider:kakao, region:서울특별시, excludedOutsideSeoul, page, isEnd, searchContext{radiusMeters:2000|null}','PROVIDER_UNAVAILABLE VALIDATION_ERROR')
api('visitCreate','POST','/schedules/{scheduleId}/visits','F09','member','visitDate, providerPlaceId? or manual{name,address?,lat?,lng?} (시간 없이 맨 뒤 추가, plannedTime=null)','visit','DUPLICATE_VISIT VISIT_LIMIT VALIDATION_ERROR TEXT_REJECTED SCHEDULE_CANCELLED DAY_CANCELLED')
api('planUpdate','PUT','/schedules/{scheduleId}/plans/{date}','F10','member','title(변경 0~30·기존 100자 보존), visits[{id,order,plannedTime:HH:MM 1분 단위|null}], expectedVersion','plan or operation','VERSION_CONFLICT INVALID_VISIT_SET TEXT_REJECTED VALIDATION_ERROR')
api('visitDelete','DELETE','/visits/{visitId}','F11','member','expectedVersion','deletedId','NOT_EMPTY VERSION_CONFLICT')
api('uploadLimits','GET','/schedules/{scheduleId}/upload-limits','F13 F14','member','recordDate, visitId?','visitId|null, recordDate, photos, videos, photoLimit:5, videoLimit:2, maxFilesPerSubmission:10','FORBIDDEN EXPIRED DAY_CANCELLED')
api('uploadPrepare','POST','/schedules/{scheduleId}/submissions','F13 F14 F15','member','files[1..10]:FileInput{selectionIndex 0..9, fingerprint, recordDate=방문 날짜, visitId(장소 기록 화면) 또는 null(미지정 유지)}','submissionId, tasks[{id,state,uploadEndpoint}], fileErrors[{code:MEDIA_LIMIT|FILE_INVALID|...}], remaining[{visitId|null,recordDate,photos,videos}]','SCHEDULE_CANCELLED DAY_CANCELLED DUPLICATE_FILE EXPIRED QUOTA_EXCEEDED FILE_INVALID MEDIA_LIMIT')
api('uploadGet','GET','/upload-tasks/{taskId}','F15','self','none','task, transferredBytes, state, retryable, reason','FORBIDDEN')
api('uploadCommit','POST','/upload-tasks/{taskId}/commit','F15 F20 F21 F26','self','checksum, actualBytes','task, operationId','FILE_INVALID ACCESS_REVOKED EXPIRED CANCELLED')
api('uploadRetry','POST','/upload-tasks/{taskId}/retries','F15','self','sameFileFingerprint','task, resumeOffset, uploadEndpoint','FILE_CHANGED ACCESS_REVOKED EXPIRED')
api('uploadCancel','POST','/upload-tasks/{taskId}/cancellation','F15','self','expectedVersion','task','ALREADY_COMPLETE VERSION_CONFLICT')
api('mediaList','GET','/schedules/{scheduleId}/media','F16','member','recordDate?, visitId?, unassigned?, outsideRange?, view:by_photo|by_author (기본 by_photo), order:desc|asc (기본 desc, 게시 묶음 시각), cursor?, limit<=60','items[{...,displayName,durationMs,submissionCompletedAt,sortAt}], groups[{authorUserId,displayName,avatarVersion,...}] (by_author 작성자 카드), visibleCounts, nextCursor','FORBIDDEN EXPIRED INVALID_CURSOR')
api('mediaStream','GET','/media/{mediaId}/content','F16 F18 F20','visible-member-or-author-read','variant:thumbnail|view, context:shared|mine, Range? header','authenticated binary stream, contentType, contentLength','FORBIDDEN DELETED EXPIRED MODERATION_RESTRICTED')
api('metadataPatch','POST','/media/metadata-changes','F17','member-author','targets[{id,expectedVersion}](1..120), fields{description?:{apply,value},recordDate?:{apply,value},visitId?:{apply,value}}','operationId, state, appliedIds[] or itemErrors[]','FORBIDDEN MIXED_SCHEDULE VERSION_CONFLICT VALIDATION_ERROR MEDIA_LIMIT TEXT_REJECTED')
api('mediaDelete','POST','/media/deletions','F18','author','mediaIds[1..120]','operationId, results[{id,status:deleted|already_deleted|failed,reason?}]','FORBIDDEN VALIDATION_ERROR')
api('mineList','GET','/me/media','F18','self','groupId?, status?, cursor?, limit<=60','items[], minimalGroupSchedule, nextCursor','AUTH_EXPIRED')
api('exportCreate','POST','/exports','F19 F20','member-visible','mediaIds[1..120], purpose:save (share 폐지)','exportId, state, results[{mediaId,kind,state,converted,variant,mime}] (동영상은 동영상 파일)','FORBIDDEN EXPIRED BLOCKED MODERATION_RESTRICTED')
api('exportGet','GET','/exports/{exportId}','F19','self','none','export, results[{mediaId,state,converted,variant}]','FORBIDDEN')
api('exportFile','GET','/exports/{exportId}/files/{mediaId}','F19','member-visible','Range? header','authenticated sanitized binary stream (사진=이미지, 동영상=위치 제거 동영상 파일·포스터 아님)','FORBIDDEN EXPIRED DELETED')
api('invitesList','GET','/groups/{groupId}/invites','F05','member','cursor?','invites[]','FORBIDDEN')
api('inviteCreate','POST','/groups/{groupId}/invites','F05','member','none','invite{id,link,code(8자 ABCDEFGHJKLMNPQRSTUVWXYZ23456789),issuedAt,expiresAt(+168h),useCount:0,maxUses:50,state}','GROUP_CLOSED FORBIDDEN')
api('inviteRevoke','POST','/invites/{inviteId}/revocation','F05','member','expectedVersion','invite','FORBIDDEN VERSION_CONFLICT')
api('invitePreview','GET','/invite-preview','F05','public','tokenOrCode (앱이 정규화한 8자 코드 또는 링크 토큰; 이미 참여자 포함 성공 응답마다 useCount+1, 50회 소진)','groupName, scheduleSummary, inviteState, usesRemaining','INVITE_INVALID INVITE_EXPIRED INVITE_EXHAUSTED INVITE_REVOKED GROUP_CLOSED')
api('inviteJoin','POST','/invitations/join','F05','authenticated','tokenOrCode (횟수 미소모)','groupId, membershipId, alreadyMember','INVITE_EXPIRED INVITE_EXHAUSTED INVITE_REVOKED CAPACITY_FULL REENTRY_BLOCKED GROUP_CLOSED GROUP_LIMIT')
api('membersList','GET','/groups/{groupId}/members','F22','member','none','members[{id,userId,displayName,avatarVersion,isOwner,isMe}], reentryBlocks(owner only)','FORBIDDEN')
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
api('profileGet','GET','/me/profile','F02','self','none','profile{id,displayName,status,avatarVersion,version}','AUTH_EXPIRED')
api('avatarPrepare','POST','/me/avatar-uploads','F02 F20 F26 F29','self','file{name,mime,declaredBytes<=5MB,fingerprint} (1:1 자르기)','UploadTask{targetType:avatar,avatarUserId,transport}','FILE_INVALID ACCESS_REVOKED')
api('avatarStream','GET','/users/{userId}/avatar','F02 F22 F29','self-or-co-member','v?(avatarVersion 캐시 키)','위치 제거 프로필 사진 binary (없으면 404)','NOT_FOUND FORBIDDEN')
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
 'F01': [('카카오톡 미설치→웹 인증 성공','동일 공급자 subject의 기존 작성자ID 유지'),('추후 공급자 활성화 시 같은 이메일로 최초 로그인','현재 Google 보류·활성화 후에도 자동 병합 없이 독립 계정'),('초대 진입 중 인증 실패→재로그인','초대와 미완료 작업 보존'),('Google 보류 상태·마지막 로그인 수단 해제','Google 신규 로그인/연결 UI 숨김, 마지막 수단 해제 거부')],
 'F02': [('이용약관 1개 동의·표시명 입력 후 가입','이용약관 버전과 동의시각 저장·개인정보 고지 체크 없음'),('추후 별도 선택 동의가 도입된 경우 거부·철회','현재 가입에는 추가 선택 체크 없음·도입 후 핵심 이용 유지와 이력 기록'),('공백 이름·NFC 결합문자·20/21자·중복 이름','공백/21자 거부,20자·중복 허용'),('고지 체크·전체동의 없음·게시 약관 누락','고지는 동의로 저장하지 않음·게시 이용약관 없으면 가입 차단')],
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
 'F25': [('파일/대표사진/참여자신고·중복요청','최소증거연결·중복없음·자동삭제없음'),('개인차단 뒤공동목록/집계/직접저장','내경로만숨김·집계일치'),('방장개인차단·모임재참여차단비교','방장역할유지·두차단독립'),('신고결과/이의·타인신고자정보요청','본인결과조회·타인신원/증거비공개')],
 'F26': [('사진/영상/이름/제목/주소/설명 공개전검사','통과전비공개·수정은기존공개값유지'),('엔진장애·판정불가·의심콘텐츠','비공개수동검토·자동공개없음'),('운영자제한/삭제/해제·일반방장같은요청','운영권한/감사이력·방장거부'),('서비스제한계정·종료모임보존파일 조치','열람등정책적용·본인삭제/동의철회/문의유지')],
 'F27': [('요청자재인증·후임별도동의·기존방장통지','자료/통지이력·7일응답대기'),('7일경과·이견/증거부족','자동승인없음·수동검토/보류'),('승인직전직접이전/후임나감/모임종료','버전검증거부·오래된승인미덮어씀'),('복구승인과파일기한/작성자 비교','방장역할만변경·기한/소유불변·종료재개불가')],
 'F28': [('완료원본+예약=5GB경계·동시접수','동시초과없음·파생본사용량별도'),('캐시500MB LRU정리·미완료원본포함','재생캐시만삭제·유일원본/설명/작업유지'),('로그아웃중업로드→다른계정로그인','작업확인·중단선택·이전계정보호자료비노출'),('실패문의·공개연락처·저장임시파일','문의식별값·실채널연결·기기쓰기후정리')]
}

# v3(2026-11-03): 기능명세서 v3 0.2절. 프로토타입(feature/ui-prototype@870be87)과 겹치는 결정은 프로토타입으로 덮어썼다.
# (항목, 이전 근거, 이전값, 최신 명세 기준, 기능, 설계 반영) — 07 결정 및 자료 차이.xlsx와 UI 설계 '바뀐 결정' 원천.
V3_DECISIONS=[
 ('D01 로그인','v2.3 F01·A16','카카오만(Google 보류)','카카오·Google 두 수단, 두 버튼 잠금·누른 버튼만 진행','F01','UI01 두 버튼·UI29 Google 연결·authExchange provider 2종'),
 ('D02 가입 동의','v2.3 F02·A17','이용약관 체크 1개+개인정보 고지','전체 동의+서비스 이용약관·개인정보 수집 및 이용(필수)·마케팅·위치정보(선택), 버전 단위','F02','UI02 4문서·consent_documents 모두 consent·선택 미동의 false 기록'),
 ('D03 이름','v2.3 F02','표시명 20자','가입 표시명 1~20, 닉네임 변경 입력 12(같은 필드, Q2)','F02 F28','UI02·UI36·UI37 profilePatch'),
 ('D04 프로필 사진','v2.3 A05','기본 아이콘','사진 선택·1:1·기본 사진으로 되돌리기','F29','UI36/37 avatarPrepare·avatarStream·users.avatar_asset_id'),
 ('D05 모임 사진','v2.3 F04 UI25','모임 정보 변경·16:9','초대·관리 맨 위 모임 사진(방장)·4:3','F04','UI23 사진 행·coverPrepare 4:3'),
 ('D06 같은 날 일정','v2.3 F07','겹침 안내 후 허용','하루에 일정 하나(SCHEDULE_DATE_TAKEN)','F07 F08','schedule_days·schedule_day_guard·UI06 안내'),
 ('D07 일정 구조','v2.3 F06','연속 기간 하나','날짜(일차) 묶음·기본 제목 n일차 · 일정 이름','F06 F07 F08','ScheduleDay·days[]'),
 ('D08 일정 변경','v2.3 F08 F11 UI06','일정 기간 변경·취소·빈 일정 삭제','하루 단위 제목·날짜 변경·취소·삭제(UI38), 전체 기간 변경 화면 없음','F08 F11','dayUpdate·dayCancel·dayDelete'),
 ('D09 달력','v2.3 F06','여러 날 띠·카드 → 일정 상세','하루 한 줄·진행 칩·카드 → 날짜별 장소','F06','UI05'),
 ('D10 날짜별 장소','v2.3 UI08','한 일정의 날짜','모임 이름·모임 전체 활성 날짜 탭','F10','UI08·calendar days'),
 ('D11 방문 시간','v2.3 F09 F10','추가 시 5분 단위','시간 없이 추가 후 1분 단위 휠','F09 F10','visits.planned_time 1분·visitCreate 시간 없음'),
 ('D12 순서 편집','v2.3 F10','끌기·시각순 정렬·3택 이탈','▲▼·날짜 제목 30·방문 시간·변경 저장','F10','UI12 planUpdate'),
 ('D13 장소 검색','v2.3 F09','대한민국·첫 방문 위치','서울특별시 결과·15건·카테고리 2km·서울시청 시작','F09','UI10 placesSearch'),
 ('D14 업로드','v2.3 F13 F14','한 제출 1~120·파일별 정보 입력','장소에서 한 번 10개·중복 제외·입력 없음','F13 F14','UI14·selection_index 0~9·DUPLICATE_FILE·uploadLimits'),
 ('D15 촬영','v2.3 F12','앱 내 카메라·1~5초','기기 카메라 사진·동영상','F12','UI15'),
 ('D16 기록 보기','v2.3 F16','시간순·사람별 묶음','사진별·사람별·최신순(기본)/오래된순','F16','UI13·UI09·mediaList view by_photo/by_author'),
 ('D17 선택 저장','v2.3 F19','길게 눌러·휴대폰 저장','선택 → n개 다운받기·사람별 ⋯ → 사진 다운받기','F19','UI16·UI21 exportCreate'),
 ('D18 감상','v2.3 F16','핀치 확대','1~4배 단계·두 번 탭·동영상 자동 재생','F16','UI18'),
 ('D19 초대 코드','v2.3 A18','길이 미확정','8자·0/O/1/I 제외','F05','Invitation.code·UI24 정규화'),
 ('D20 초대 화면','v2.3 UI23','사용 가능·이전 목록','현재 카드 1개+이전 초대·코드 탭 복사·공유하기','F05','UI23'),
 ('D21 참여자','v2.3 UI26','방장 이전·퇴장 화면','함께하는 친구에서 방장 ⋯ → 내보내기','F22','UI26 memberRemove'),
 ('D22 내 모임','v2.3 UI03','함께하는 모임·탭 설정','내 모임·역할 배지·탭 마이페이지','F03','UI03'),
 ('D23 내 정보','v2.3 UI28 UI36','설정 중심','마이페이지 → 설정 → 프로필 및 계정','F28 F29','UI36·UI28·UI37'),
 ('D24 기록 정렬 기준','v2.3 F16','촬영 시각','게시 묶음 업로드 완료 시각','F16','Media.sortBasis=submission'),
]
CONFLICTS.extend([(c[0],'UI 프로토타입 870be87 · '+c[1],c[2],c[3],c[4],c[5]) for c in V3_DECISIONS])
# 결정 전까지 v3 적용값으로 설계한다(기능명세서 0.4절). (ID, 내용, v3 적용, 기능)
OPEN_QUESTIONS=[
 ('Q1','일정 추가의 ‘그대로 저장할 수 있어요’ 안내와 하루 하나 규칙의 모순','사용 중인 날짜를 저장 전에 안내하고 저장 비활성','F07'),
 ('Q2','가입 표시명 20자와 닉네임 변경 12자','같은 필드, 서버 1~20·변경 입력 12','F02 F28'),
 ('Q3','한 번 업로드 10개와 작성자별 장소당 사진5·영상2','두 규칙 모두 적용, 시트에 남은 수 표시','F14'),
 ('Q4','PPT 21 “참여자는 보기·초대”와 코드(참여자도 장소 편집)','참여자 허용','F09 F10'),
 ('Q5','장소 검색 서울 한정 기간','1차 서울 한정','F09'),
 ('Q6','설명 입력 위치·길이(시트에 입력란 없음)','업로드 후 본인 기록 수정에서 1000자','F14 F17'),
 ('Q7','동영상 길이·용량(프로토타입 무제한)','촬영·가져오기 60초·200MB','F12 F13'),
 ('Q8','함께하는 친구의 카카오톡 초대·초대링크 복사 동작','가장 최근 사용 가능 초대, 없으면 새 발급','F22'),
 ('Q9','마지막 날 삭제 시 기록 검사 없음','기록·진행 업로드가 있으면 거부','F11'),
 ('Q10','취소된 날 진입·편집·업로드','보기 전용, 편집·업로드 차단','F08 F10 F14'),
 ('Q11','설정 약관 4종과 가입 동의 4종의 목록 차이','게시 문서 전체와 동의 내역을 함께 연다','F02 F28'),
 ('Q12','기록 조회 단위(장소 id vs 방문)','방문 단위','F16'),
 ('Q13','일정 배경 사진·일정 요약 화면 재사용','사용하지 않음','F06'),
 ('Q14','기록 정렬에 연도 없음','서버 시각(연도 포함) 정렬','F16'),
 ('Q15','하루 변경 100자·순서 편집 30자와 같은 날짜 제목','day_plans.title 최대100; UI12 변경만30, 기존 긴 제목 보존·부모 일정명 유지','F08 F10'),
 ('Q16','추가 설계·PM 확인 대기: 묶음 정렬의 완료 시점','임시: 첫 파일 완료 시각 고정. 첫/전체 완료·지연 재배치 확인','F16'),
 ('Q17','추가 설계·PM/백엔드 확인 대기: groupDays 페이지 한도','임시: 기본·최대 60개. 응답 크기·탭 로딩 검토 후 확정','F06 F10'),
 ('Q18','추가 설계·PM 확인 대기: 날짜만 바꿀 때 기본 제목 저장','임시: title 생략·제목 없음 유지. 프로토타입은 문자열 저장','F08 F10'),
]
# v3: 모임 사진·프로필 사진도 재개 업로드(HEAD/PATCH)를 쓴다.
for _screen in SCREENS:
    if _screen['id'] in ['UI23','UI36','UI37']:_screen['api']+=['uploadHead','uploadChunk']
# v3 검수 시나리오: 프로토타입으로 바뀐 기능을 다시 쓴다.
QA['F01']=[('카카오·Google 각각 신규/기존 로그인','신규 UI02·기존 UI03, 공급자별 계정 구분·이메일 병합 없음'),('로그인 중 두 버튼 연속 탭','두 버튼 잠금·요청 1회'),('초대 진입 중 인증 실패→재로그인','보류 초대 유지 후 UI24 복귀'),('세션 복원·가입 미완료·보류 초대·오프라인','UI01/UI02/UI24/UI03 분기·오프라인 재시도·세션 유지'),('공급자 장애·인증 취소','장애 문구·취소는 안내 없음')]
QA['F02']=[('필수 2개만 동의·선택 2개 미동의 후 가입','문서 버전별 동의 true/false 저장·가입 성공'),('약관 전체 동의 토글·문서 보기 동의하고 닫기','전부 동의/해제·해당 문서 현재 버전 동의'),('표시명 공백·NFC 결합문자·20/21자·중복','빈 값·21자 오류(입력 보존), 20자·중복 허용'),('제출 중 동의 문서 버전 변경','바뀐 문서만 미동의·재확인 문구'),('가입 중 뒤로가기','그만두기 확인·로그아웃·보류 초대 유지')]
QA['F05'].append(('코드 입력에 링크·소문자·하이픈·0/O 섞기','코드 추출·대문자·영숫자 8자·형식 확인 표시, 새 코드에 0·O·1·I 없음'))
QA['F06']=[('여러 날 일정의 달력·목록 표시','날짜마다 한 줄·n일차 · 일정 이름·하루 일정은 이름'),('같은 날 다른 일정 생성 시도 후 달력','같은 날짜 활성 일정 하나만 표시'),('칸당 4개 이상 항목·월 스와이프·다른 달 날짜 탭','3줄+N·월 이동·선택 유지'),('취소된 날 카드·진행 중/진행 예정 칩','취소선·취소된 일정 칩·오늘/미래 칩'),('빠른 월 이동·재조회 실패','마지막 요청만 반영·기존 내용 유지 띠')]
QA['F07']=[('당일·3일 기간 일정 추가','하나의 일정·일차 3개·달력 일치'),('사용 중인 날짜 포함 기간·취소된 날 포함 기간','사용 중이면 SCHEDULE_DATE_TAKEN·취소된 날은 허용'),('두 방장 세션 같은 날짜 동시 추가·응답 유실 재시도','한 날짜에 하나만 확정·중복 생성 없음'),('제목 101자·367일·일반 참여자 요청','거부·입력 유지')]
QA['F08']=[('여러 날 일정의 하루 제목·날짜 변경','그날만 변경·방문·기록 날짜 함께 이동·일차 재번호·시작/종료 재계산'),('다른 일정이 쓰는 날·같은 일정의 다른 날로 이동','시트에서 선택 불가·서버 SCHEDULE_DATE_TAKEN'),('하루 취소 후 그날 장소 추가·업로드·모든 날 취소','DAY_CANCELLED·일정 취소 전환·취소 전 접수 파일은 완료 가능'),('다른 모임 scheduleId·비방장 직접 요청·버전 충돌','거부·입력 유지')]
QA['F09'].append(('서울 밖 키워드 결과·카테고리 칩·거리 표시','서울 결과만·제외 수 표시·반경 2km 거리순·10m 단위'))
QA['F10']=[('타임라인 시간 수정 1분 단위·시간 미정으로 두기','즉시 저장·HH:mm·순서 불변'),('순서 편집 ▲▼·날짜 제목 30자·변경 저장','한 번에 저장·비운 제목은 기본 제목'),('방문 누락·중복·다른 날짜 혼입·동시 저장','전체 거부·충돌 입력 유지'),('모임 전체 날짜 탭·취소된 날 카드 진입','활성 날짜만 탭·취소된 날 보기 전용')]
QA['F11'].append(('장소 있는 날 삭제·마지막 날 삭제(기록 있음/없음)','잠금 안내·기록 있으면 거부·없으면 일정 삭제'))
QA['F12']=[('사진·동영상 촬영 후 시트에 담기','후면 카메라·결과 담김·10개 한도 적용'),('카메라 권한 거절·마이크 거절','카메라 권한이 필요해요·무음 동영상 허용'),('60.1초·200MB+1바이트 촬영 동영상','담지 않고 사유 안내'),('촬영 취소·앱 전환·전화','시트 불변·유효 결과만 담김')]
QA['F13']=[('사진·동영상 보관함 다중 선택(남은 칸 수 제한)','남은 칸까지 선택·고른 순서 유지'),('같은 파일 다시 선택·같은 선택 안 중복','한 번만 담김·중복 안내'),('11번째 항목·0개 업로드','10개 안내·업로드 비활성'),('손상·RAW·애니메이션·60초 초과 혼합','실패 파일만 제외·나머지 담김')]
QA['F14']=[('장소에서 사진 6·동영상 3 업로드','사진5·영상2만 접수·초과 파일별 MEDIA_LIMIT'),('같은 지문 파일 두 개를 한 제출에','DUPLICATE_FILE'),('취소된 날·만료 일정의 업로드','버튼 비활성·서버 DAY_CANCELLED/EXPIRED'),('두 기기 동시 업로드·실패/취소 후 자리 반환','합산 한도 유지·즉시 반환')]
QA['F16']=[('최신순·오래된순·해를 넘기는 일정','게시 묶음 완료 시각(연도 포함) 정렬·묶음 안 순서 유지'),('사람별 1·2·3·4·5개 이상 격자·+N·접기','격자 규칙·+{전체-3}·펼침/접기'),('같은 장소 다른 날 방문의 기록','방문별로 분리'),('사진 1~4배·두 번 탭·동영상 재생 실패','단계 확대·1↔2배·재생 실패 다시 시도'),('차단·운영 제한·삭제·만료 혼합','사진별·사람별 집합과 개수 일치')]
QA['F19']=[('선택 3개 다운받기(사진2·동영상1)','동영상은 동영상 파일·At that place 앨범·n개를 저장했어요'),('사람별 ⋯ → 사진 다운받기','그 사람의 그 장소 파일 전체'),('0개·121개 선택·보기 전환','다운받기 비활성·120개 상한·선택 종료'),('부분 실패·공간 부족·저장 권한 거절','성공/실패 수·실패만 재시도')]
QA['F22']=[('방장이 참여자 내보내기','참여 종료·모임 재참여 차단·완료 파일 유지'),('내보낸 사람이 다른 새 초대로 참여','REENTRY_BLOCKED'),('일반 참여자 화면·직접 요청','⋯ 없음·서버 거부'),('카카오톡 초대·초대링크 복사(초대 없음/있음)','가장 최근 초대 사용 또는 새 발급'),('방장 이전·차단 해제 후 재참여','즉시 이전·해제 후 일반 참여')]
QA['F28']=[('마이페이지 참여한 모임 수(0개·여러 페이지)','서버 수 그대로·0개는 0개'),('닉네임 12자 입력·공백만·검사 거부','12자 상한·저장 비활성·거부 안내'),('설정 초대코드 입력·위치 서비스·약관 4종','UI24 연결·기기 설정 열기·게시 문서 열기'),('로그아웃(업로드 진행 중)·서비스 탈퇴 확인','확인 후 UI01·탈퇴는 UI30'),('캐시 정리·저장 공간','재생 캐시만 삭제·5GB 표시')]
QA['F29']=[('프로필 사진 선택·1:1 자르기','위치 제거·검사 후 반영·모든 아바타 위치 갱신'),('기본 사진으로 되돌리기','이름 첫 글자 아바타·avatarVersion 증가'),('5MB 초과·불러오기 실패·권한 거절','사진 실패 문구·기존 사진 유지'),('검사 거부·동시 변경','기존 사진 유지·버전 충돌')]

# 2026-11-03 추가 대조: 옛 장소 추가 시각 입력 검수를 현행 D11에 맞춘다.
QA['F09'][0]=('검색→지도이동→영역검색→방문추가→타임라인 시간 수정','추가 시 plannedTime=null·날짜 마지막 순서·이후 1분 단위 저장')
QA['F08'].append(('하루/여러 날 제목 100자 저장·101자·빈값·날짜만 변경','100자 허용·101자/빈값 거부·날짜만 변경 시 제목과 부모 일정명 유지'))
QA['F10'].extend([('UI38에서 100자 제목 저장 후 UI12에서 순서·시간만 저장','기존 제목 100자 보존·새 제목 변경만 30자 제한'),('모임 날짜가 여러 달·해·61개 이상, 페이지 중 날짜 이동·취소','groupDays 다음 페이지·키 중복 제거·선택 유지 또는 변경 안내 후 재조회')])
QA['F14'].append(('10개 후보 중 일부 거부·응답 유실 후 재시도','접수 ID 있는 후보만 제거·거부 후보/사유 보존·같은 멱등 키로 중복 방지'))
QA['F16'].append(('동일 묶음 지연 완료·첫 완료 파일 삭제·정렬 시각 동률','묶음 첫 완료 시각 불변·submissionId 동률 정렬·묶음 내부 selectionIndex 오름차순'))
for _s in SCREENS:
    if _s['id']=='UI38': _s['notes'].append('Q15: 하루/여러 날 모두 날짜 제목 1~100자, 부모 일정명 유지. Q18 추가 설계(PM 확인 대기): 날짜만 변경할 때 title 생략; 프로토타입은 기본 제목 문자열 저장. UI12와 같은 day_plans.title.')
    if _s['id']=='UI08': _s['notes'].append('모임 전체 탭은 groupDays 커서 조회(Q17: 기본·최대 60개는 추가 설계·확인 대기). 월 달력 응답만 재사용하지 않는다. 탭은 (scheduleId,date), 취소 날짜는 원래 일정 상세로 보기 전용 진입.')
    if _s['id']=='UI14': _s['notes'].append('부분 접수는 접수된 후보만 제거하고 거부 후보·사유를 유지. 응답 유실은 같은 멱등 키로 확인, 모두 접수됐을 때만 시트를 비운다.')

# v3.1: 요구 동작과 추가 설계의 임시 적용을 화면에서 함께 표시한다.
for _s in SCREENS:
    if _s['id'] in ['UI09','UI13']: _s['notes'].append('Q16 추가 설계·PM 확인 대기: 묶음 첫 파일 완료 시각을 임시 정렬 기준으로 사용. 후속 완료 시 재배치 여부를 확인한다.')

# 확인 전 적용값에 의존하는 검수. 06 기대결과와 07 확인대기에서 같은 연결을 사용한다.
QA_PENDING_DECISIONS={
    'TC-F08-05': ['Q15','Q18'],
    'TC-F10-05': ['Q15'],
    'TC-F10-06': ['Q17'],
    'TC-F16-01': ['Q16'],
    'TC-F16-06': ['Q16'],
}
