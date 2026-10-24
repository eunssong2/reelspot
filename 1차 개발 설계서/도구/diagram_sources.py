from pathlib import Path
from xml.sax.saxutils import escape
from design_model import ROOT

def box(x,y,w,h,title,lines,accent=False):
    return f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="15" fill="{"#FDEDEB" if accent else "#F2F4F6"}" stroke="#DCE1E6"/><text x="{x+18}" y="{y+35}" font-size="23" font-weight="700">{escape(title)}</text>'+''.join(f'<text x="{x+18}" y="{y+72+i*29}" font-size="18" fill="#4E5968">{escape(line)}</text>' for i,line in enumerate(lines))+'</g>'
def line(x1,y1,x2,y2,label=''):
    return f'<path d="M{x1} {y1} L{x2} {y2}" fill="none" stroke="#7C8895" stroke-width="2" marker-end="url(#arrow)"/>'+ (f'<text x="{(x1+x2)/2+5}" y="{(y1+y2)/2-7}" font-size="15" fill="#5F6B78">{escape(label)}</text>' if label else '')
def svg(w,h,body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#7C8895"/></marker></defs><style>text{{font-family:"Noto Sans CJK KR",sans-serif;fill:#191F28}}</style><rect width="100%" height="100%" fill="white"/>{body}</svg>'
def make():
    body='<text x="30" y="45" font-size="30" font-weight="700">At that place 1차 구성도</text>'
    for args in [(30,105,330,180,'Android 앱',['React Native / Expo','화면·계정별 영속 전송 큐','Picker·카메라·저장·공유'],True),(475,105,390,180,'업무 API / 콘텐츠 프록시',['인증·동의·현재 권한·버전','모임·일정·초대·기록 트랜잭션','인증된 Range 스트리밍'],True),(980,105,350,180,'외부 공급자',['카카오 / Google 인증','국내 장소·지도','텍스트·이미지·영상 검사'],False),(475,385,390,180,'PostgreSQL',['행 잠금·불변식·보관 고정','업무 결과·도메인 outbox','삭제 tombstone·운영 감사'],False),(30,385,330,180,'운영 웹',['별도 인증·신고/검사 큐','이의·부재 수동 복구','최소 증거·처리 이력'],False),(980,385,350,180,'비공개 Object Storage',['격리 원본·위치 포함 원본','위치 제거 저장본·호환본','썸네일·수명별 정리'],False),(475,660,390,160,'미디어·정리 작업자',['probe→위치 제거→검사','완료 재검증·24시간 정리'],True)]:body+=box(*args)
    for args in [(360,195,475,195,'HTTPS'),(865,195,980,195,'서버 연동'),(670,285,670,385,'업무 커밋'),(360,475,475,475,'운영 권한'),(865,475,980,475,'private'),(670,660,670,565,'outbox'),(865,740,1150,565,'변환/정리')]:body+=line(*args)
    body+='<text x="30" y="875" font-size="20" fill="#B8433F">앱 직접 DB 쓰기·공개 원본 URL 없음 · 저장/열람도 현재 권한과 기한 재검증</text>'
    (ROOT/'부록/아키텍처.svg').write_text(svg(1380,915,body))
    nodes=[('users',['PK id','표시명 · 계정 상태']),('identities',['FK user_id','UNIQUE provider+subject']),('memberships',['FK user_id, group_id','활성 참여 유일 · 세대 ID']),('groups',['owner_user_id 단일 방장','완료/예약 원본 바이트']),('invitations',['group_id · code/token hash','7일 · 확인 50회 소진']),('schedules',['group_id · 날짜 범위만','기한 최초 고정 · 상태']),('visits',['schedule_id · place_id','방문일 · 순서 · 시각 · 15개/일']),('places',['group_id · 공급자 ID','수기 이름/주소/좌표']),('submissions',['schedule_id · author_id','묶음 첫 완료시각 고정']),('upload_tasks',['파일별 접수/상태/예약','작성자×방문 사진5/영상2']),('media',['task_id UNIQUE · author_id','기록일 · 방문 · 접근 상태']),('assets',['media_id / 대표사진','variant · 위치 제거 검증'])]
    body='<text x="30" y="40" font-size="29" font-weight="700">핵심 ERD · 전체 테이블 정의는 데이터베이스 설계서 참조</text>'
    for i,(name,lines) in enumerate(nodes):body+=box(30+(i%4)*345,80+(i//4)*260,300,175,name,lines,i in [3,5,10])
    for args in [(330,165,375,165,'1:N'),(1065,165,1020,165,'1:N'),(675,425,720,425,'1:N'),(1065,425,1020,425,'1:N'),(525,515,180,600,'1:N'),(330,685,375,685,'1:N'),(675,685,720,685,'1:0..1'),(1020,685,1065,685,'1:N'),(870,515,870,600,'선택 방문')]:body+=line(*args)
    body+='<path d="M180 255 L180 285 L870 285 L870 255" fill="none" stroke="#7C8895" stroke-width="2" marker-end="url(#arrow)"/><text x="440" y="280" font-size="15">users 1:N memberships</text>'
    body+='<path d="M1150 255 L1150 330 L180 330 L180 340" fill="none" stroke="#7C8895" stroke-width="2" marker-end="url(#arrow)"/><text x="300" y="326" font-size="15">groups 1:N invitations</text>'
    body+='<path d="M1215 255 L1215 315 L525 315 L525 340" fill="none" stroke="#7C8895" stroke-width="2" marker-end="url(#arrow)"/><text x="770" y="332" font-size="15">groups 1:N schedules</text>'
    body+='<text x="30" y="850" font-size="20">FK 연쇄삭제 금지 · 재참여는 새 membership ID · 기한은 schedule 단위 고정 · 반복 테이블 없음(v0.3)</text>'
    (ROOT/'부록/ERD.svg').write_text(svg(1410,885,body))
if __name__=='__main__':make()
