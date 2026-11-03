"""브랜치 실행 캡처를 우선 사용해 UI 설계서와 추적 자료를 함께 생성한다."""
import base64, hashlib, html, json, re
from pathlib import Path
from xml.sax.saxutils import escape
from openpyxl import Workbook
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from design_model import ROOT, SCREENS

E = html.escape
FONT = 'Noto Sans CJK KR'
RELATED = {'S0':None,'S02':'UI08','S02-empty':'UI08','S02-oneday':'UI08','S02-tabs':'UI08',
           'M4':'UI08','M1':'UI12','S05-empty':'UI12','S03-detail':'UI10',
           'V1-video':'UI18','M3':'UI14','S04-empty':'UI13',
           'MY-name':'UI36','SET-invite':'UI28','DATES':'UI08','S04-select':'UI13','PERIOD':'UI04',
           'MEMBERS':'UI26','MEMBERS-READER':'UI26','MEMBER-REMOVE':'UI26','MEMBER-REMOVED':'UI26',
           'CALENDAR-LIST':'UI05','DAY-MENU':'UI38','DAY-EDIT':'UI38','DAY-DATE':'UI38','DAY-CANCEL':'UI38',
           'GROUP-DAYS':'UI08','MY-LINK':'UI36'}


def load_source():
    manifest=json.loads((ROOT/'UI/프로토타입/출처.json').read_text())
    for shot in manifest['screens']:
        p=ROOT/'UI/프로토타입'/shot['image']
        if hashlib.sha256(p.read_bytes()).hexdigest()!=shot['sha256']:
            raise ValueError('프로토타입 캡처 SHA256 불일치: '+p.name)
    return manifest


def load_overview():
    """UI 담당 '전체 화면 정리' PPTX 추출본. UI 설계의 최우선 기준이다(도구/capture_overview.py)."""
    manifest=json.loads((ROOT/'UI/전체화면정리/출처.json').read_text())
    for img in manifest['images']:
        p=ROOT/'UI/전체화면정리'/img['image']
        if hashlib.sha256(p.read_bytes()).hexdigest()!=img['sha256']:
            raise ValueError('전체 화면 정리 이미지 SHA256 불일치: '+p.name)
    return manifest


def build(screen_elements, svg_for, ppt_shape, sheet):
    manifest=load_source(); overview=load_overview()
    shots=manifest['screens']; primary={s['ui']:s for s in shots if s['ui']}
    commit=manifest['commit']; short=commit[:7]
    ov_short=overview['commit'][:7]; ov_slides={s['slide']:s for s in overview['slides']}
    ov_by_ui={}
    for img in overview['images']:ov_by_ui.setdefault(img['ui'],[]).append(img)
    replaced=set(primary)|set(ov_by_ui)
    applied_count=len(replaced); extra_count=len(shots)+len(overview['images'])-applied_count; native_count=len(SCREENS)-applied_count
    prs=Presentation();prs.slide_width=Inches(16);prs.slide_height=Inches(9)
    def text(slide,x,y,w,h,value,size=18,color='191F28',bold=False):
        box=slide.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h))
        box.text_frame.word_wrap=True
        box.text_frame.margin_left=box.text_frame.margin_right=0
        box.text_frame.margin_top=box.text_frame.margin_bottom=0
        for i,line in enumerate(value.split('\n')):
            p=box.text_frame.paragraphs[0] if i==0 else box.text_frame.add_paragraph()
            p.text=line;p.font.name=FONT;p.font.size=Pt(size);p.font.bold=bold
            p.font.color.rgb=RGBColor.from_string(color);p.space_after=Pt(5)
        return box
    def base(title,sub):
        s=prs.slides.add_slide(prs.slide_layouts[6])
        sh=s.shapes.add_shape(MSO_SHAPE.RECTANGLE,0,0,prs.slide_width,Inches(.85))
        sh.fill.solid();sh.fill.fore_color.rgb=RGBColor.from_string('202A35');sh.line.fill.background()
        text(s,.5,.16,15,.5,title,25,'FFFFFF',True)
        text(s,.5,8.57,15,.3,sub+' · 2026-11-01',10,'5F6B78')
        return s
    ov_img=lambda img:ROOT/'UI/전체화면정리'/img['image']
    cover=base('At that place · UI 설계 · 전체 화면 정리 반영',f'UI 담당 전체 화면 정리 @ {ov_short} (최우선) · 프로토타입 캡처 @ {short}')
    text(cover,.7,1.25,10,1.2,'UI 담당 전체 화면 정리를\n화면 설계의 최우선 기준으로 반영합니다.',32,bold=True)
    text(cover,.7,3.15,9.3,3.4,
         f'최우선 자료: {overview["file"]}\nfeature/ui-prototype @ {overview["commit"]}\n슬라이드 {len(overview["slides"])}장 · 화면 이미지 {len(overview["images"])}개 · 대응 화면 {len(ov_by_ui)}개(새 화면 UI38 포함)\n프로토타입 실행 캡처 {len(shots)}개(@ {short})는 PPTX에 없는 화면·상태와 참고용으로 유지합니다.\n제품 UI ID {len(SCREENS)}개 중 {applied_count}개는 이미지, {native_count}개는 명세 기반 설계안입니다.',19)
    text(cover,.7,7,9.4,.9,'화면 구성·문구·규칙은 PPTX가 우선합니다. 기능명세 v2.3·API·DB와 다른 항목은\n‘화면과 제품 계약의 차이’와 회의 안건에서 개정 여부를 정합니다.',17,'B8433F',True)
    cover.shapes.add_picture(str(ov_img(ov_by_ui['UI05'][0])),Inches(11.6),Inches(1.1),height=Inches(7.2))
    flow=base('화면 흐름과 원본 위치','UI 담당 전체 화면 정리 2번 슬라이드 기준')
    text(flow,.8,1.35,14.5,2.6,
         '시작: 로그인(UI01) → 가입 동의·표시명(UI02) → 내 모임(UI03) → 모임 만들기(UI04) · 초대 코드 참여(UI24)\n모임 안: 모임 달력·일정 목록(UI05) → 날짜별 장소(UI08) → 장소 기록(UI13·UI09) → 사진·동영상 올리기(UI14)\n모임 달력 → 일정 추가(UI06) · 하루 일정 변경(UI38) · 초대·관리(UI23) · 함께하는 친구(UI26)\n날짜별 장소 → 장소 검색(UI10) · 순서 편집(UI12)',21)
    text(flow,.8,4.35,14.5,2.2,
         '내 정보: 내 모임 아래 탭 마이페이지(UI36) → 설정(UI28) → 프로필 및 계정(UI37)\nUI/전체화면정리/출처.json: PPTX 해시·슬라이드 문구·이미지별 화면 대응·이미지 해시\nUI/프로토타입/출처.json: 이전 실행 캡처의 커밋·소스·경로·해시\n재생성은 저장된 이미지를 사용하며 원격 브랜치·Expo 실행이 필요하지 않습니다.',20)
    text(flow,.8,7.05,14.3,.9,'PPTX에 없는 화면(일정 요약·전체 기록·감상·내 기록·신고·계정 삭제 등)은 기존 설계안을 유지합니다.',17,'B8433F',True)
    # PPTX(최우선)와 현재 제품 계약(명세 v2.3·API·DB)의 차이. 원천은 design_model의 P 항목이다.
    from design_model import CONFLICTS
    differences=[[c[0],c[2],c[3]+' → '+c[5]] for c in CONFLICTS if c[1].startswith('PPTX')]
    diff=base('화면과 제품 계약의 차이','UI 담당 전체 화면 정리(최우선) vs 기능명세 v2.3 · 회의 안건 참조')
    y=1.1
    for name,actual,contract in differences:
        text(diff,.6,y,2.4,.45,name,12,'B8433F',True)
        text(diff,3.1,y,5.9,.45,actual,11)
        text(diff,9.2,y,6.3,.45,contract,11)
        y+=.5
    text(diff,.6,8.2,14.8,.3,'PPTX 이미지는 UI 담당의 프로토타입 화면 예시입니다. 실제 로그인·서버 저장·업로드는 PPTX 22번 슬라이드의 미연결 목록을 따릅니다.',11,'5F6B78')
    rules=base('일정 규칙과 아직 연결되지 않은 기능','UI 담당 전체 화면 정리 21·22번 슬라이드')
    rule_lines=ov_slides[21]['lines'][1:]
    text(rules,.7,1.2,7.2,6.8,'\n'.join(rule_lines),15)
    table_rows=ov_slides[22].get('table',[])
    text(rules,8.3,1.2,7,6.8,'\n'.join(f'{r[0]}: {r[1]}' for r in table_rows[1:]),14)

    articles=[];screen_rows=[];components=[];states=[];apis=[];data=[];page_ids=[]
    nav=[]
    def article(id,title,kind,img,notes,related='',extra=''):
        nav.append(f'<a href="#{E(id)}">{E(id)} {E(title)}</a>');page_ids.append(id)
        articles.append(f'<article class="screen" id="{E(id)}"><h2>{E(id)} · {E(title)}</h2>'
                        f'<p class="meta">{E(kind)} · {E(related)}</p><div class="pair"><figure>'
                        f'<img src="{E(img)}" alt="{E(title)}"><figcaption>{E(kind)}</figcaption></figure>'
                        f'<div class="notes">'+''.join(f'<p>{E(n)}</p>' for n in notes)+extra+'</div></div></article>')
    def capture_page(shot,ui_spec=None):
        id=ui_spec['id'] if ui_spec else shot['id']
        title=shot['title'];related=shot['ui'] or RELATED.get(shot['id']) or '데모 전용'
        s=base(id+'  '+title,f'브랜치 실행 캡처 · {shot["id"]} · {short}')
        s.shapes.add_picture(str(ROOT/'UI/프로토타입'/shot['image']),Inches(.65),Inches(1.05),height=Inches(7.2))
        text(s,4.3,1.15,10.9,.5,shot['id']+' · '+shot['actions'],22,bold=True)
        y=2
        for n in shot['notes']:
            text(s,4.3,y,10.8,.9,n,18);y+=1.05
        text(s,4.3,5.5,10.8,.35,'출처와 적용 범위',16,'B8433F',True)
        text(s,4.3,5.95,10.8,1.5,shot['source']+'\n'+manifest['environment']+'\n'+manifest['scope'],14,'5F6B78')
        if ui_spec:
            text(s,4.3,7.52,10.8,.8,'제품 계약: '+' / '.join(ui_spec['features'])+' · '+ui_spec['role']+'\nAPI: '+', '.join(ui_spec['api']),12,'5F6B78')
        s.notes_slide.notes_text_frame.text='실행경로: '+shot['actions']+'\n브랜치: '+manifest['branch']+'\n커밋: '+commit+'\n'+ '\n'.join(shot['notes'])
        if ui_spec:
            s.notes_slide.notes_text_frame.text+='\n제품 구현 계약(데모에서 미구현 가능):\n'+'\n'.join(ui_spec['notes'])+'\n상태: '+ui_spec['states']
        extra=f'<h3>원본과 실행 경로</h3><p>{E(shot["source"])}</p><p>{E(shot["actions"])}</p><p class="small">{E(shot["route"])}</p>'
        if ui_spec:
            # 제품 계약은 접어서 제공한다. 인쇄 시에는 핵심 상태와 API를 함께 표시한다.
            extra+=f'<details><summary>제품 구현 계약 · {E(ui_spec["title"])}</summary>'+''.join(f'<p>{E(n)}</p>' for n in ui_spec['notes'])+'</details>'
            extra+=f'<h3>제품 상태·API</h3><p class="small">{E(ui_spec["states"])}</p><p class="small">{E(", ".join(ui_spec["api"]))}</p>'
        label='프로토타입 실행 캡처(참고)' if not ui_spec and shot['ui'] in ov_by_ui else '브랜치 실행 캡처'
        article(id,title,label+' · '+shot['id']+' @ '+short+' · 웹','프로토타입/'+shot['image'],shot['notes'],related,extra)
    def overview_page(img,ui_spec=None):
        """PPTX 이미지 한 장. 대표 이미지는 설계 화면 ID로, 나머지 상태는 P번호로 쪽을 만든다."""
        sl=ov_slides[img['slide']]
        id=ui_spec['id'] if ui_spec else img['id']
        title=img['screen'] if ui_spec else img['screen']+' · '+img['state']
        source=f'UI 담당 전체 화면 정리 {img["slide"]}번 슬라이드 · {img["id"]} {img["state"]} @ {ov_short}'
        s=base(id+'  '+title,source+' · 최우선')
        s.shapes.add_picture(str(ov_img(img)),Inches(.65),Inches(1.05),height=Inches(7.2))
        text(s,4.3,1.15,10.9,.5,(sl.get('section')+' · ' if sl.get('section') else '')+img['screen']+' — '+img['state'],22,bold=True)
        text(s,4.3,1.8,10.8,.5,sl['lead'],18,'B8433F',True)
        y=2.45
        for n in sl['bullets']:
            text(s,4.3,y,10.8,.5,'· '+n,17);y+=.55
        if sl.get('note'):
            text(s,4.3,y+.1,10.8,.6,'참고  '+sl['note'],14,'5F6B78');y+=.7
        conflicts=[c for c in CONFLICTS if c[1].startswith('PPTX') and str(img['slide']) in re.findall(r'\d+',c[1])]
        if conflicts:
            text(s,4.3,6.1,10.8,.35,'제품 계약(명세 v2.3)과 다른 점',15,'B8433F',True)
            text(s,4.3,6.5,10.8,1.3,'\n'.join(f'{c[0]}: {c[3]} → {c[5]}' for c in conflicts),12,'5F6B78')
        if ui_spec:
            text(s,4.3,7.85,10.8,.5,'제품 계약: '+' / '.join(ui_spec['features'])+' · '+ui_spec['role']+' · API: '+', '.join(ui_spec['api']),11,'5F6B78')
        s.notes_slide.notes_text_frame.text='\n'.join([source,sl['lead'],*sl['bullets'],sl.get('note','')])
        notes=[sl['lead'],*sl['bullets']]+(['참고: '+sl['note']] if sl.get('note') else [])
        extra=f'<h3>최우선 자료</h3><p class="small">{E(overview["file"])} · {E(overview["commit"])} · {E(img["image"])}</p>'
        if conflicts:
            extra+='<h3>제품 계약(명세 v2.3)과 다른 점</h3>'+''.join(f'<p class="small">{E(c[0])}: {E(c[3])} → {E(c[5])}</p>' for c in conflicts)
        if ui_spec:
            extra+=f'<details><summary>제품 구현 계약 · {E(ui_spec["title"])}</summary>'+''.join(f'<p>{E(n)}</p>' for n in ui_spec['notes'])+'</details>'
            extra+=f'<h3>제품 상태·API</h3><p class="small">{E(ui_spec["states"])}</p><p class="small">{E(", ".join(ui_spec["api"]))}</p>'
        article(id,title,'UI 담당 전체 화면 정리(최우선) · '+img['id']+' '+img['state'],'전체화면정리/'+img['image'],notes,img['ui'],extra)
    (ROOT/'UI/제품적용').mkdir(exist_ok=True)
    for spec in SCREENS:
        id=spec['id'];filename=id+'_'+spec['title'].replace(' ','_')+'.svg'
        path=ROOT/'UI/SVG'/filename
        shot=primary.get(id)
        ov=ov_by_ui.get(id)
        if ov:
            # PPTX 대표 이미지가 SVG·쪽의 기준이다. 실행 캡처는 참고 쪽으로 뒤에 둔다.
            b64=base64.b64encode(ov_img(ov[0]).read_bytes()).decode()
            path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844" role="img"><title>{escape(ov[0]["screen"])}</title><desc>UI 담당 전체 화면 정리 @ {overview["commit"]} · {escape(ov[0]["id"])} · 이미지 편집은 UI 원본에서 수행</desc><image width="390" height="844" href="data:image/png;base64,{b64}"/></svg>')
            overview_page(ov[0],spec)
            for img in ov[1:]:overview_page(img)
            if shot:capture_page(shot)
            if id in ['UI01','UI02','UI03']:
                applied_path=ROOT/'UI/제품적용'/filename
                applied_path.write_text(svg_for(screen_elements(spec)))
                slide=base(id+' 이전 결정 적용안(참고)', 'A16·A17 이전 사용자 결정 · PPTX(최우선)와 다름 · 회의 확인 필요')
                for element in screen_elements(spec): ppt_shape(slide,element,.65,1.05,3.33/390)
                selected=spec['notes'][-1:] + spec['notes'][:2]
                for n,note in enumerate(selected):text(slide,4.4,1.4+n*1.65,10.6,1.5,note,18)
                slide.notes_slide.notes_text_frame.text='\n'.join(spec['notes'])
                article(id+'-PRODUCT',spec['title']+' · 이전 결정 적용안(참고)','명세 기반 편집 가능 도형 · PPTX와 다름','제품적용/'+filename,selected,id)
            title=ov[0]['screen'];kind='UI 담당 전체 화면 정리(최우선)';image='전체화면정리/'+ov[0]['image']
            slide_text=ov_slides[ov[0]['slide']]
            display=dict(spec,title=title,rows=[['overview',t] for t in [slide_text['lead'],*slide_text['bullets']]],
                         contract_title=spec['title'],contract_rows=spec['rows'],visual_source=kind,
                         overview=[dict(i,lead=ov_slides[i['slide']]['lead'],bullets=ov_slides[i['slide']]['bullets']) for i in ov],
                         overview_commit=overview['commit'],prototype=shot,source_commit=commit)
            for i,t in enumerate([slide_text['lead'],*slide_text['bullets']],1):components.append([id,f'{id}-O{i:02}','전체 화면 정리 설명',t,ov[0]['id'],'UI 담당 정리(최우선)·제품 권한 별도',ov[0]['image']])
        elif shot:
            # 기존 SVG 경로도 최신 캡처를 담아, 외부의 기존 링크가 초안으로 돌아가지 않게 한다.
            b64=base64.b64encode((ROOT/'UI/프로토타입'/shot['image']).read_bytes()).decode()
            path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844" role="img"><title>{escape(shot["title"])}</title><desc>feature/ui-prototype @ {commit} · 웹 실행 캡처 · 이미지 편집은 앱 소스에서 수행</desc><image width="390" height="844" href="data:image/png;base64,{b64}"/></svg>')
            capture_page(shot,spec)
            if id in ['UI01','UI02','UI03']:
                # 고객 원본 캡처와 구별되는 제품 적용 도형을 PDF/PPTX에도 함께 제공한다.
                applied_path=ROOT/'UI/제품적용'/filename
                applied_path.write_text(svg_for(screen_elements(spec)))
                slide=base(id+' 제품 적용안', 'v2.3 확정사항 적용 · 고객 원본 캡처와 구분')
                for element in screen_elements(spec): ppt_shape(slide,element,.65,1.05,3.33/390)
                selected=spec['notes'][-1:] + spec['notes'][:2]
                for n,note in enumerate(selected):text(slide,4.4,1.4+n*1.65,10.6,1.5,note,18)
                slide.notes_slide.notes_text_frame.text='\n'.join(spec['notes'])
                article(id+'-PRODUCT',spec['title']+' · 제품 적용안','명세 기반 편집 가능 도형','제품적용/'+filename,selected,id)
            title=shot['title'];kind='브랜치 실행 캡처';image='프로토타입/'+shot['image']
            display=dict(spec, title=title, rows=[['prototype',t] for t in shot.get('text','').splitlines()],
                         contract_title=spec['title'],contract_rows=spec['rows'],
                         visual_source=kind,prototype=shot,source_commit=commit)
            for i,t in enumerate(shot.get('text','').splitlines(),1):components.append([id,f'{id}-P{i:02}','실행 화면 문구',t,shot['actions'],'데모 표시·서비스 권한 별도',shot['id']])
        else:
            path.write_text(svg_for(screen_elements(spec)))
            title=spec['title'];kind='명세 기반 설계안 · 기존 화면 유지';image='미리보기/'+path.stem+'.png'
            s=base(id+'  '+title,kind)
            for e in screen_elements(spec):ppt_shape(s,e,.65,1.05,3.33/390)
            text(s,4.4,1.2,10.7,.5,'대상: '+spec['role'],21,bold=True)
            y=1.95
            step=4.65/len(spec['notes'])
            for n in spec['notes']:
                text(s,4.4,y,10.6,step-.1,n,16);y+=step
            text(s,4.4,6.75,10.6,.9,spec['states'],14,'5F6B78')
            text(s,4.4,7.9,10.6,.4,'API: '+', '.join(spec['api']),11,'5F6B78')
            s.notes_slide.notes_text_frame.text='\n'.join(spec['notes'])+'\n'+spec['states']
            article(id,title,kind,image,spec['notes'],' / '.join(spec['features']),f'<h3>상태·API</h3><p>{E(spec["states"])}</p><p class="small">{E(", ".join(spec["api"]))}</p><p class="small"><a href="SVG/{E(filename)}">편집 가능한 SVG 원본</a></p>')
            display=dict(spec,visual_source=kind)
            for i,(k,t) in enumerate(spec['rows'],1):components.append([id,f'{id}-C{i:02}',k,t,'\n'.join(spec['notes']),spec['role'],spec['states']])
        data.append(display)
        screen_rows.append([id,title,' '.join(spec['features']),spec['role'],kind,image,' '.join(i['id'] for i in ov) if ov else (shot['id'] if shot else ''),overview['file'] if ov else (shot['source'] if shot else '도구/design_model.py'),spec['states'],', '.join(spec['api'])])
        states.append([id,kind,spec['states'],'제품 요구: 입력 보존·오류/빈 결과 구분·권한/버전 재검증 · 데모 구현과 구분'])
        apis.extend([[id,a,' '.join(spec['features']),'제품 구현 계약 · 데모 연동 검수 아님'] for a in spec['api']])
        for extra in shots:
            if not extra['ui'] and RELATED.get(extra['id'])==id:capture_page(extra)
    capture_page(next(s for s in shots if s['id']=='S0'))
    prs.save(ROOT/'UI/05 UI 설계.pptx')
    wb=Workbook();wb.remove(wb.active)
    sheet(wb,'화면목록',['화면ID','화면명','기능','권한','화면출처','대표이미지','전체화면정리·브랜치화면','원본','제품상태','API'],screen_rows)
    sheet(wb,'전체화면정리',['이미지ID','슬라이드','화면','상태','설계UI','파일','SHA256','요약','설명'],
          [[i['id'],i['slide'],i['screen'],i['state'],i['ui'],i['image'],i['sha256'],ov_slides[i['slide']]['lead'],'\n'.join(ov_slides[i['slide']]['bullets'])] for i in overview['images']],[10,8,22,22,8,40,30,45,80])
    sheet(wb,'전체화면규칙',['구분','내용'],[['일정 규칙',l] for l in ov_slides[21]['lines'][1:]]+[['미연결 기능: '+r[0],r[1]] for r in ov_slides[22].get('table',[])[1:]],[35,110])
    sheet(wb,'구성요소명세',['화면ID','요소ID','유형','표시문구','동작·검증·전환','권한·범위','상태·원본'],components)
    sheet(wb,'화면API연결',['화면ID','operationId','기능','범위'],apis)
    sheet(wb,'화면상태',['화면ID','화면출처','제품별상태','복구규칙'],states)
    source_rows=[[s['id'],s['title'],s['ui'] or RELATED.get(s['id']) or '데모 전용',s['source'],s['route'],s['actions'],s['captured_at'],s['sha256']] for s in shots]
    sheet(wb,'프로토타입대응',['브랜치화면','화면명','설계UI','소스','라우트','실행경로','캡처시각','캡처SHA256'],source_rows)
    # 앱 구현 현황은 반영 기준 문서의 표를 원천으로 한다(앱 점검 때마다 문서를 갱신).
    status_md=(ROOT/'UI/2026-11-01_UI_전체화면정리_반영.md').read_text().split('## 앱 구현 현황',1)
    status_rows=[]
    if len(status_md)==2:
        for line in status_md[1].splitlines():
            cells=[c.strip() for c in line.strip().strip('|').split('|')]
            if line.startswith('| ') and len(cells)>=4 and not set(line)<=set('|- ') and cells[0] not in ('PPTX 화면','규칙'):
                status_rows.append(cells[:4])
    sheet(wb,'앱구현현황',['PPTX 화면·규칙','판정','같은 점','다른 점'],status_rows,[28,14,70,90])
    sheet(wb,'정책차이',['항목','전체 화면 정리(최우선)','제품 계약(명세 v2.3) → 처리'],differences,[25,75,75])
    integration=(ROOT/'UI/2026-10-30_UI_통합_설계.md').read_text()
    qa_rows=[]
    for line in integration.splitlines():
        if line.startswith('| U30-'):
            qa_rows.append([v.strip() for v in line.strip('|').split('|')]+['미실행'])
    sheet(wb,'UI통합검수',['ID','확인 항목','기대 결과','실제 앱 검수'],qa_rows,[18,65,100,22])
    sheet(wb,'적용기준',['구분','내용'],[
        ['최우선 기준','UI 담당 전체 화면 정리 '+overview['file']+' @ '+ov_short+' — 화면 구성·문구·규칙'],
        ['기준','명세 v2.3 / 설계 v0.3.3 / 프로토타입 실행 캡처 '+short],
        ['필수 열람','UI/2026-11-01_UI_전체화면정리_반영.md — 반영 기준·제품 계약 차이 / UI/2026-10-30_UI_통합_설계.md — 이전 화면별 계약'],
        ['미결정','회의록/10월 30일 회의 안건.md — 맨 앞 목차의 논의 안건'],
        ['주의','PPTX·캡처는 프로토타입 화면. 기능 완료·권한·동의·출시 적합성 확인 아님.'],
        ['가입 적용','PPTX 기준 카카오·Google, 약관 전체 동의·선택 동의. A16·A17 이전 결정과 다르므로 회의 확인 필요. 이전 결정 적용안은 참고 쪽으로 보존.'],
        ['출시 전','F02 기본 가입 구성 반영, F20/F24 등 출시 조건은 A13']], [28,110])

    flows=[['UI03','UI05','모임 카드','전체 화면 정리'],['UI05','UI05 일정 목록','일정 목록 탭','전체 화면 정리'],['UI05 일정 목록','UI08','하루 일정 카드','전체 화면 정리·날짜별 장소'],['UI05 일정 목록','UI38','⋯ → 일정 변경(방장)','전체 화면 정리·그날만'],['UI05','UI06','+ 일정 추가(방장)','전체 화면 정리'],['UI05','UI23','초대·관리 ›','전체 화면 정리·모임 사진 변경 포함'],['UI05','UI26','위쪽 인원 띠','전체 화면 정리'],['UI08','UI10','장소 추가','전체 화면 정리'],['UI08','UI12','편집','전체 화면 정리'],['UI08','UI13','장소 카드','전체 화면 정리'],['UI13','UI09','사람별 아이콘','전체 화면 정리'],['UI13','UI14','+ 사진·동영상 올리기','전체 화면 정리·최대10개'],['UI03','UI36','하단 마이페이지 탭','전체 화면 정리'],['UI36','UI28','톱니바퀴','전체 화면 정리'],['UI28','UI37','프로필 및 계정','전체 화면 정리'],['UI28','UI24','초대코드 입력','전체 화면 정리'],
           ['UI01','UI02','카카오 예시 인증','제품은 실제 인증 검증'],['UI02','UI03/UI24','가입 완료','제품은 이용약관 체크1개·보류 초대 분기'],['UI03','UI05','모임 선택','groupId'],['UI05','UI23','초대 관리','모든 현재 참여자'],['UI24','UI05','명시적 참여','정원/초대/현재 권한 재검증'],['UI05','UI08/S01','일정 선택','제품 진입'],['S0','S01','예시 일정 선택','데모 전용'],['S01','S02','날짜 카드 선택','tripId/itineraryId/dayId'],['S01','M4','배경 사진 변경','앨범 선택'],['S02','S03','장소 추가','선택 날짜'],['S03','S02','추가 성공','마지막 순서·제품은 예정 시각 선택·추가됨'],['S02','S05','편집','빈 날짜에도 제공'],['S02/S05','M1','시간 수정','S05에서는 변경 저장 때 반영'],['S05','S02','변경 저장','순서·시각·제목'],['S02','S04','장소 카드','방문별 기록'],['S04','V1','파일 탭','사진 확대·영상 재생'],['S04','M2','올리기','업로드 연결 지점'],['M2','M3','추가 타일','촬영·앨범 선택']]
    # 브랜치 전환과 기존 제품 계약을 구분해 모두 보존한다.
    flows+=json.loads((ROOT/'UI/제품 화면전환.json').read_text())
    sheet(wb,'화면전환',['출발','도착','이벤트','범위·전달'],flows,[25,25,35,80])
    sheet(wb,'디자인토큰',['토큰','브랜치값','원본'],[
        ['primary','#F1706B','src/theme/theme.ts'],['primaryPressed','#DC5F5A','src/theme/theme.ts'],['primarySoft','#FDEDEB','src/theme/theme.ts'],['text','#191F28','src/theme/theme.ts'],['surface','#F2F4F6','src/theme/theme.ts'],['pageBg','#F9FAFB','src/prototype/styles/tokens.ts'],['간격','4px 단위·좌우20px','src/theme/theme.ts'],['큰 버튼','최소56px·radius14','src/prototype/styles/tokens.ts'],['카드/행','radius20/16','src/prototype/styles/tokens.ts'],['캡처','390×844 CSS px·DPR2','Playwright Chromium 웹'],['브랜치',manifest['branch'],commit]], [30,48,85])
    wb.save(ROOT/'UI/05 화면 명세.xlsx')
    (ROOT/'UI/화면데이터.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    css="""*{box-sizing:border-box}body{font:15px/1.8 'Noto Sans CJK KR',sans-serif;color:#191F28;background:#f4f5f7;margin:0}a{color:#B8433F}aside{position:fixed;inset:0 auto 0 0;width:260px;background:white;overflow:auto;padding:24px}aside a{display:block;font-size:12px;padding:6px;text-decoration:none}main{margin-left:260px}header{background:#202A35;color:white;padding:40px}header a{color:white}.screen,.intro{background:white;margin:28px;padding:28px;border-radius:18px;scroll-margin:20px}h2{font-size:25px;margin:0 0 8px}.meta{color:#B8433F;font-size:13px}.pair{display:flex;gap:32px;align-items:flex-start}figure{width:260px;flex-shrink:0;margin:0}figure img{width:100%;border:1px solid #dce1e6}figcaption,.small{font-size:11px;overflow-wrap:anywhere}.notes{max-width:760px}.notes p{margin:0 0 16px}.notes h3{font-size:15px;margin:15px 0 8px}details{background:#f2f4f6;padding:12px;margin-bottom:16px}details p{font-size:13px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #dce1e6;padding:8px;text-align:left}th{background:#f2f4f6}@media(max-width:1100px){aside{display:none}main{margin:0}.pair{flex-wrap:wrap}}@media print{@page{size:A4 landscape;margin:10mm}aside,header,.intro{display:none}main{margin:0}.screen{height:187mm;margin:0;padding:0;border-radius:0;break-after:page;break-inside:avoid}.screen:last-child{break-after:auto}.pair{flex-wrap:nowrap;gap:24px}figure{width:232px}figure img{height:502px;object-fit:contain}.notes{font-size:12px;line-height:1.7}.notes p{margin-bottom:11px}.notes h3{font-size:12px}.small{font-size:9px}details{display:none}body{background:white}h2{font-size:21px}.meta{margin:4px 0 12px}}"""
    table='<table><tr><th>항목</th><th>전체 화면 정리(최우선)</th><th>제품 계약(명세 v2.3) → 처리</th></tr>'+''.join('<tr>'+''.join('<td>'+E(c)+'</td>' for c in row)+'</tr>' for row in differences)+'</table>'
    css+='@media print{.intro{display:block;height:187mm;margin:0;padding:0;break-after:page;font-size:12px}.intro table{font-size:10px}.intro td,.intro th{padding:6px}}'
    rules_html='<ul>'+''.join(f'<li>{E(l)}</li>' for l in ov_slides[21]['lines'][1:])+'</ul>'
    pending_html='<ul>'+''.join(f'<li><b>{E(r[0])}</b>: {E(r[1])}</li>' for r in ov_slides[22].get('table',[])[1:])+'</ul>'
    intro=f'<section class="intro"><h2>화면 적용 기준</h2><p><b>최우선 기준: UI 담당 전체 화면 정리</b> · {E(overview["file"])} @ <b>{ov_short}</b> · 슬라이드 {len(overview["slides"])}장 · 화면 이미지 {len(overview["images"])}개 · 대응 화면 {len(ov_by_ui)}개(새 화면 UI38 하루 일정 변경). 제품 UI {len(SCREENS)}개 중 {applied_count}개는 이미지, {native_count}개는 명세 기반 설계안입니다. 프로토타입 실행 캡처 {len(shots)}개(@ {short})는 PPTX에 없는 화면·상태와 참고용으로 유지합니다.</p><p><a href="전체화면정리/출처.json">PPTX 해시·슬라이드 문구·이미지 대응</a> · <a href="전체화면정리/슬라이드 문구.txt">슬라이드 문구 원문</a> · <a href="2026-11-01_UI_전체화면정리_반영.md">반영 기준·제품 계약 차이·앱 구현 현황</a> · <a href="앱대조_구현후/">앱 대조 이미지(구현 후)</a> · <a href="앱대조_0.2.3/">적용 전</a> · <a href="2026-10-30_UI_통합_설계.md">이전 UI 통합 설계</a> · <a href="2026-11-01_UI_변경_반영.md">11월 1일 캡처 관찰</a> · <a href="../../회의록/10월%2030일%20회의%20안건.md">회의 안건</a> · <a href="프로토타입/출처.json">이전 캡처 출처</a></p><h3>일정 규칙(PPTX 21번)</h3>{rules_html}<h3>아직 연결되지 않은 기능(PPTX 22번)</h3>{pending_html}</section><section class="intro"><h2>화면과 제품 계약의 차이</h2><p>전체 화면 정리(최우선)와 기능명세 v2.3·API·DB가 다른 항목입니다. 제품 계약은 이번에 바꾸지 않았으며 회의 결정 후 명세부터 개정합니다.</p>{table}</section>'
    page='<!doctype html><html lang="ko"><meta charset="utf-8"><title>At that place UI 설계 · 전체 화면 정리 반영</title><style>'+css+'</style><aside><b>UI 설계 · 화면 출처별 표시</b><p><a href="../00 설계서 안내.html">← 설계서 안내</a></p>'+''.join(nav)+'</aside><main><header><h1>At that place · UI 설계</h1><p>2026-11-01 · UI 담당 전체 화면 정리(최우선) 반영</p><a href="05 UI 설계.pptx">PowerPoint</a> · <a href="05 화면 명세.xlsx">화면 명세 Excel</a> · <a href="05 UI 설계.pdf">PDF</a></header>'+intro+''.join(articles)+'</main></html>'
    (ROOT/'UI/05 UI 화면 갤러리.html').write_text(page)
    result=dict(source_commit=commit,overview_commit=overview['commit'],overview_sha256=overview['sha256'],
                overview_images=len(overview['images']),overview_ui=sorted(ov_by_ui),
                main_screens=len(SCREENS),replaced_ui=sorted(replaced),
                captures=len(shots),supplemental_screens=len(shots)+len(overview['images'])-len(replaced),
                gallery_pages=page_ids,pdf_intro_pages=2,pdf_pages=len(page_ids)+2,pptx_slides=len(prs.slides))
    (ROOT/'UI/화면 반영.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False))


def update_index():
    """재생성 시 최신 manifest와 통합 설계로 안내한다."""
    import re
    p=ROOT/'00 설계서 안내.html'
    s=p.read_text()
    m=load_source(); applied=json.loads((ROOT/'UI/화면 반영.json').read_text())
    s=s.replace('UI 화면과 APK 캡처 함께 보기 →','최신 프로토타입 UI 화면 보기 →')
    s=s.replace('편집 가능한 UI 원본','UI 설계와 프로토타입 화면')
    s=s.replace('글자·버튼·필드·배경을 개별 도형으로 수정합니다. 실제 APK 캡처는 별도 근거 이미지입니다.',
                '최신 UI 캡처와 제품 적용 계약을 함께 제공합니다. 캡처는 데모이며 기능 검수 결과가 아닙니다.')
    s=s.replace('SVG 원본은 각 갤러리 화면에서 엽니다.','화면 출처·제품 적용 기준·회의 안건을 함께 확인합니다.')
    s=s.replace('SVG는 벡터 편집기로 열어 수정합니다.','명세 기반 SVG는 벡터 편집, 캡처 래퍼는 앱 소스 수정 후 재캡처합니다.')
    s=re.sub(r'<div class="info"><b>2026-1[01]-\d+ UI 화면 반영</b>.*?</div>', '',s,flags=re.S)
    info=f'<div class="info"><b>2026-11-01 UI 화면 반영</b><p><b>최우선 기준: UI 담당 전체 화면 정리</b>(feature/ui-prototype @ {applied["overview_commit"][:7]}, 이미지 {applied["overview_images"]}개, 새 화면 UI38). 프로토타입 실행 캡처 @ {m["commit"][:7]} {applied["captures"]}개는 참고로 유지. 제품 화면 {applied["main_screens"]}개. 명세 v2.3·설계 v0.3.3과 다른 항목은 <a href="UI/2026-11-01_UI_전체화면정리_반영.md">전체 화면 정리 반영 기준</a>과 회의 안건에서 개정 여부를 정합니다. <a href="UI/전체화면정리/출처.json">출처</a></p></div>'
    s=s.replace('<h2>개발 설계서</h2>',info+'<h2>개발 설계서</h2>')
    p.write_text(s)
