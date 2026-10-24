"""DOCX/XLSX/PPTX/SVG/HTML/OpenAPI 생성. Python 3.10+, requirements.txt 참조."""
import json, re, html, hashlib, math, textwrap, shutil
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from xml.sax.saxutils import escape
from docx import Document
from docx.shared import Inches as DInches, Pt as DPt, RGBColor as DColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from design_model import ROOT,DATE,SCREENS,APIS,CONFLICTS,QA
from data_model import TABLES,RELATIONS
from document_content import ARCH,DECISIONS,SOURCES,SEQUENCES
from workflow_readable import WORKFLOWS
from api_contract import build_openapi
from revision_content import prepare_baseline,apply_content,SECTIONS,EXTERNAL,REVISION,CONTRACT_CASES,test_method
apply_content(ARCH,DECISIONS,SOURCES,WORKFLOWS)

E=html.escape
FONT='Noto Sans CJK KR'
COLORS={'ink':'191F28','body':'4E5968','muted':'5F6B78','coral':'F1706B','accent':'B8433F','soft':'FDEDEB','surface':'F2F4F6','border':'DCE1E6','white':'FFFFFF','navy':'202A35'}
HTML_DIR=ROOT/'부록/열람용HTML';HTML_DIR.mkdir(parents=True,exist_ok=True)
def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def label(f):
    spec=(ROOT/'기준/기능명세서.md').read_text().split('<!-- 문서에 포함된 그림 데이터')[0]
    m=re.search(r'### '+f+r'\. (.+)',spec)
    return m.group(1) if m else f

class Doc:
    def __init__(self,filename,title,sub='1차 개발 구현 설계 v0.3.1 · 기준 기능명세서 v2.1(2026-10-24) 우선'):
        self.name=filename;self.doc=Document();self.parts=[]
        sec=self.doc.sections[0];sec.top_margin=DInches(.65);sec.bottom_margin=DInches(.65);sec.left_margin=DInches(.65);sec.right_margin=DInches(.65)
        normal=self.doc.styles['Normal'];normal.font.name=FONT;normal.font.size=DPt(10)
        normal._element.rPr.rFonts.set(qn('w:eastAsia'),FONT)
        normal.paragraph_format.space_after=DPt(7)
        for style in ['Title','Heading 1','Heading 2','Heading 3']:
            self.doc.styles[style].font.name=FONT;self.doc.styles[style]._element.rPr.rFonts.set(qn('w:eastAsia'),FONT)
        self.doc.add_heading(title,0);self.doc.add_paragraph(sub+'\n기준일 '+DATE)
        self.parts=[f'<h1>{E(title)}</h1><p class="subtitle">{E(sub)} · {DATE}</p>']
        footer=sec.footer.paragraphs[0];footer.text='At that place · 1차 개발 설계 · '+DATE+'  |  '
        fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');footer._p.append(fld)
    def h(self,t,level=1):
        self.doc.add_heading(t,level);self.parts.append(f'<h{level+1}>{E(t)}</h{level+1}>')
    def p(self,t):
        self.doc.add_paragraph(t);self.parts.append('<p>'+E(t).replace('\n','<br>')+'</p>')
    def table(self,heads,rows):
        t=self.doc.add_table(rows=1,cols=len(heads));t.style='Light Shading Accent 1'
        for c,v in zip(t.rows[0].cells,heads):c.text=str(v)
        pr=t.rows[0]._tr.get_or_add_trPr();x=OxmlElement('w:tblHeader');pr.append(x)
        for r in rows:
            for c,v in zip(t.add_row().cells,r):
                c.text=str(v)
                for p in c.paragraphs:
                    for run in p.runs:run.font.size=DPt(8)
        self.parts.append('<table><thead><tr>'+''.join('<th>'+E(str(h))+'</th>' for h in heads)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+E(str(v)).replace('\n','<br>')+'</td>' for v in r)+'</tr>' for r in rows)+'</tbody></table>')
    def image(self,path,width=6):
        if Path(path).exists():
            self.doc.add_picture(str(path),width=DInches(width));rel=Path(path).relative_to(ROOT)
            self.parts.append(f'<img class="diagram" src="../../{E(str(rel))}">')
    def save(self):
        self.doc.save(ROOT/(self.name+'.docx'))
        template='''<!doctype html><html lang="ko"><meta charset="utf-8"><title>{title}</title><style>
        @page{{size:A4;margin:18mm 16mm}}body{{font:10pt/1.65 'Noto Sans CJK KR',sans-serif;color:#191F28;max-width:900px;margin:auto}}
        h1{{font-size:27pt;line-height:1.3;border-bottom:4px solid #B8433F;padding-bottom:18px}}h2{{font-size:17pt;margin-top:28px;break-after:avoid}}h3{{font-size:12pt;break-after:avoid}}
        p{{overflow-wrap:anywhere}}.subtitle{{color:#5F6B78}}table{{border-collapse:collapse;width:100%;font-size:8pt;margin:12px 0 24px;table-layout:auto}}thead{{display:table-header-group}}th{{background:#202A35;color:white;text-align:left}}td,th{{padding:7px;border:1px solid #DCE1E6;vertical-align:top;overflow-wrap:anywhere}}tr{{break-inside:avoid}}img.diagram{{width:100%;max-height:800px;object-fit:contain}}a{{color:#B8433F}}
        </style><body>{body}</body></html>'''
        (HTML_DIR/(self.name+'.html')).write_text(template.format(title=E(self.name),body=''.join(self.parts)))

def sheet(wb,name,headers,rows,widths=None):
    s=wb.create_sheet(name);s.append(headers)
    for r in rows:s.append([str(v) if isinstance(v,(dict,list)) else v for v in r])
    s.freeze_panes='A2';s.auto_filter.ref=s.dimensions;s.sheet_view.zoomScale=85
    for c in s[1]:c.fill=PatternFill('solid',fgColor=COLORS['navy']);c.font=Font(name=FONT,bold=True,color='FFFFFF');c.alignment=Alignment(wrap_text=True,vertical='center')
    s.row_dimensions[1].height=32
    for row in s.iter_rows(min_row=2):
        max_lines=1
        for c in row:
            c.font=Font(name=FONT,size=10,color=COLORS['ink']);c.alignment=Alignment(vertical='top',wrap_text=True)
            if c.row%2==0:c.fill=PatternFill('solid',fgColor='F5F7F9')
            max_lines=max(max_lines,len(str(c.value or '').splitlines())+len(str(c.value or ''))//40)
        s.row_dimensions[row[0].row].height=min(160,max(34,max_lines*17))
    for i in range(1,len(headers)+1):s.column_dimensions[get_column_letter(i)].width=(widths[i-1] if widths and i<=len(widths) else 28)
    s.print_options.horizontalCentered=True;s.sheet_properties.pageSetUpPr.fitToPage=True
    s.page_setup.orientation='landscape';s.page_setup.paperSize=s.PAPERSIZE_A3;s.page_setup.fitToWidth=1;s.page_setup.fitToHeight=0
    s.print_title_rows='1:1';return s

# 공통 도형 데이터를 SVG와 PowerPoint 네이티브 요소로 변환한다.
def rect(x,y,w,h,fill='white',stroke=None,r=12):return dict(k='rect',x=x,y=y,w=w,h=h,fill=fill,stroke=stroke,r=r)
def txt(x,y,w,h,t,size=17,color='ink',bold=False,align='left'):return dict(k='text',x=x,y=y,w=w,h=h,t=t,size=size,color=color,bold=bold,align=align)
def wrap(t,n=22):
    lines=[]
    for raw in t.split('\n'):
        while len(raw)>n:
            cut=raw.rfind(' ',0,n+1)
            if cut<n//2:cut=n
            lines.append(raw[:cut]);raw=raw[cut:].lstrip()
        lines.append(raw)
    return '\n'.join(lines)
def screen_elements(s):
    el=[rect(0,0,390,844,'white',r=26),txt(20,12,200,25,'9:41   ·   Android',12,'muted'),txt(20,48,350,50,('‹  ' if s['id']!='UI01' else '')+s['title'],23,'ink',True)]
    y=112
    rows=s['rows'];height={'brand':78,'lead':72,'hint':46,'yellow':56,'button':56,'outline':56,'link':38,'field':64,'row':56,'card':82,'banner':64,'calendar':236,'photo':130,'map':190,'camera':310,'nav':50}
    # 대표 프리뷰에 구성요소를 배치한다. 실제 앱은 세로 스크롤을 허용한다.
    total=sum(height[k]+10 for k,_ in rows)
    factor=min(1,670/total)
    for idx,(k,t) in enumerate(rows):
        h=height[k]*factor;gap=10*factor;w=350;x=20;fs=17
        if k in ['brand','lead']:
            el.append(txt(x,y,w,h,wrap(t,19),29 if k=='brand' else 24,'accent' if k=='brand' else 'ink',True))
        elif k in ['hint','link']:
            el.append(txt(x,y,w,h,wrap(t,26),14,'muted' if k=='hint' else 'accent'))
        elif k=='calendar':
            el.append(rect(x,y,w,h,'surface',r=16))
            for j,day in enumerate(['월','화','수','목','금','토','일']):el.append(txt(x+8+j*48,y+8,46,25,day,12,'body',align='center'))
            for n in range(1,32):
                cx=x+8+((n+2)%7)*48;cy=y+34+((n+2)//7)*32
                if cy+30<y+h:
                    if n in [17,18,19]:el.append(rect(cx,cy,44,29,'soft',r=6))
                    el.append(txt(cx,cy,44,26,str(n),13,'accent' if n in [17,18,19] else 'ink',align='center'))
            el.append(txt(x+12,y+h-30,326,25,'17  우리의 서울 여행  ·  +2',12,'accent'))
        elif k in ['photo','map','camera']:
            fill='surface' if k=='photo' else ('soft' if k=='map' else 'navy')
            el.append(rect(x,y,w,h,fill,r=14))
            if k=='map':
                for j in range(3):el.append(rect(x+28+j*105,y+12,4,max(8,h-24),'white',r=0))
                el.append(rect(x+15,y+h*.55,w-30,6,'white',r=0))
                el.append(rect(x+w/2-10,y+h/2-22,24,28,'accent',r=12))
            if k=='photo':
                el.append(rect(x+18,y+18,50,42,'soft',r=9));el.append(txt(x+23,y+23,40,30,'▶' if '영상' in t else '▧',20,'accent',align='center'))
            el.append(txt(x+15,y+h*.48,w-30,h*.5-8,wrap(t,23),16,'white' if k=='camera' else 'body',True,align='center'))
        else:
            fill={'yellow':'FEE500','button':'accent','outline':'white','card':'surface','banner':'soft','field':'surface','row':'white','nav':'surface'}[k]
            el.append(rect(x,y,w,h,fill,'border' if k in ['outline','row'] else None,r=12))
            color='white' if k=='button' else ('accent' if k in ['outline','banner'] else 'ink')
            wrapped=wrap(t,24 if k not in ['button','outline'] else 22)
            lines=len(wrapped.splitlines());size=16 if lines<3 else 14
            el.append(txt(x+14,y+max(5,(h-lines*(size*1.4))/2),w-28,max(20,h-6),wrapped,size,color,k in ['button','outline','yellow'],align='center' if k in ['button','outline','yellow','nav'] else 'left'))
        y+=h+gap
    el.append(rect(143,826,104,4,'ink',r=2));return el
def color(c):return '#'+COLORS.get(c,c.lstrip('#'))
def svg_for(elements,width=390,height=844):
    out=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">',f'<style>text{{font-family:"{FONT}",sans-serif}}</style>']
    for e in elements:
        if e['k']=='rect':out.append(f'<rect x="{e["x"]}" y="{e["y"]}" width="{e["w"]}" height="{e["h"]}" rx="{e["r"]}" fill="{color(e["fill"])}" stroke="{color(e["stroke"])}"/>' if e['stroke'] else f'<rect x="{e["x"]}" y="{e["y"]}" width="{e["w"]}" height="{e["h"]}" rx="{e["r"]}" fill="{color(e["fill"])}"/>')
        else:
            anchor='middle' if e['align']=='center' else 'start';x=e['x']+e['w']/2 if anchor=='middle' else e['x']
            out.append(f'<text x="{x}" y="{e["y"]+e["size"]}" fill="{color(e["color"])}" font-size="{e["size"]}" font-weight="{700 if e["bold"] else 500}" text-anchor="{anchor}">')
            for i,line in enumerate(e['t'].splitlines()):out.append(f'<tspan x="{x}" dy="{0 if i==0 else e["size"]*1.4}">{escape(line)}</tspan>')
            out.append('</text>')
    return ''.join(out)+'</svg>'

def ppt_shape(slide,e,ox=0,oy=0,scale=1):
    x,y,w,h=[Inches(v) for v in (ox+e['x']*scale,oy+e['y']*scale,e['w']*scale,e['h']*scale)]
    if e['k']=='rect':
        sh=slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if e['r'] else MSO_SHAPE.RECTANGLE,x,y,w,h)
        if e['r']:
            try:sh.adjustments[0]=min(.25,e['r']/max(1,min(e['w'],e['h'])))
            except (IndexError,AttributeError):pass
        sh.fill.solid();sh.fill.fore_color.rgb=RGBColor.from_string(COLORS.get(e['fill'],e['fill'].lstrip('#')))
        if e['stroke']:sh.line.color.rgb=RGBColor.from_string(COLORS.get(e['stroke'],e['stroke']))
        else:sh.line.fill.background()
    else:
        sh=slide.shapes.add_textbox(x,y,w,h);tf=sh.text_frame;tf.word_wrap=True
        tf.margin_left=0;tf.margin_right=0;tf.margin_top=0;tf.margin_bottom=0
        for i,line in enumerate(e['t'].splitlines()):
            p=tf.paragraphs[0] if i==0 else tf.add_paragraph();p.text=line;p.font.name=FONT;p.font.size=Pt(e['size']*scale*72);p.font.bold=e['bold'];p.font.color.rgb=RGBColor.from_string(COLORS.get(e['color'],e['color']));p.space_after=Pt(1)
            if e['align']=='center':p.alignment=PP_ALIGN.CENTER
    return sh
def pt_text(slide,x,y,w,h,t,size=18,color='ink',bold=False):
    return ppt_shape(slide,txt(x,y,w,h,t,size/72,color,bold),scale=1)

def build_ui():
    prs=Presentation();prs.slide_width=Inches(16);prs.slide_height=Inches(9)
    def base(title,sub):
        s=prs.slides.add_slide(prs.slide_layouts[6]);ppt_shape(s,rect(0,0,16,.86,'navy',r=0));pt_text(s,.45,.18,15,.5,title,26,'white',True);pt_text(s,.5,8.58,15,.3,sub+'  ·  '+DATE,11,'muted');return s
    s=base('At that place  1차 UI 설계','편집 가능한 화면 원본 · 기능명세서 v2.1(2026-10-24) 기준')
    pt_text(s,.7,1.35,9,1.2,'함께한 기록을\n일정 안에서 바로 만납니다.',36,'ink',True)
    pt_text(s,.7,3.1,8.7,2.2,f'{len(SCREENS)}개 대표 화면과 실제 APK 화면을 함께 검토합니다.\nUI07(맞춤 반복)은 폐지, UI19는 UI16에 통합했습니다.\n각 화면의 글자·버튼·배경·필드는 PowerPoint 도형입니다.\nSVG의 텍스트·도형도 개별 편집할 수 있습니다.\nAPK 캡처는 관찰 근거 이미지이며 편집용 UI 원본과 구분합니다.',21)
    ppt_shape(s,rect(.7,6.15,8.8,1.2,'soft'));pt_text(s,1,6.35,8.2,.8,'Android 12+ · 한국 시간 고정 · 반복 일정·외부 공유 없음\n영상 편집·제작·결제는 후속 범위',19,'accent',True)
    for e in screen_elements(next(x for x in SCREENS if x['id']=='UI08')):ppt_shape(s,e,11.1,1.12,3.1/390)
    s=base('정보 구조와 핵심 이동','날짜는 일정 내부의 정리·필터 속성')
    stages=[('UI03','내 모임'),('UI05','모임 달력'),('UI08','일정 전체'),('UI09 / UI13','공동 기록'),('UI18','감상')]
    for i,(id,t) in enumerate(stages):
        x=.65+i*3.05;ppt_shape(s,rect(x,1.5,2.65,1.1,'soft'));pt_text(s,x+.15,1.64,2.3,.75,id+'\n'+t,20,'accent',True)
        if i<4:pt_text(s,x+2.72,1.8,.32,.4,'→',24,'muted')
    pt_text(s,.8,3.2,14,1.4,'등록  UI14 방식 선택 → UI15 촬영 / 기기 선택기 → UI16 파일 선택·정보 → UI17 전송\n선택  UI09/UI13 길게 누르기 → UI16 선택 모드 → UI21 저장 · UI20 본인 수정 · 삭제\n관리  UI06 일정 수동 추가 · UI23 초대(50회) · UI26 참여자 · UI27 나가기/종료 · UI30 계정 삭제',23)
    pt_text(s,.8,5.5,14,1.7,'화면 공통 규칙\n로딩·빈 결과·오류를 구분하고, 실패해도 입력을 유지합니다.\n서버가 권한·기한·버전을 재검증하며 전송100%를 완료로 표시하지 않습니다.',23)
    s=base('디자인 토큰과 편집 방법','선행 XLSX의 브랜드 색과 간격을 Android 기준으로 정리')
    tokens=[('기본 본문','#191F28'),('보조 본문','#4E5968'),('브랜드 포인트','#F1706B'),('주 버튼','#B8433F'),('안내 배경','#FDEDEB')]
    for i,(name,c) in enumerate(tokens):
        x=.8+i*3;ppt_shape(s,rect(x,1.4,2.5,1.1,c,r=.2));pt_text(s,x,2.65,2.8,.8,name+'\n'+c,18)
    pt_text(s,.8,4,14,3,'본문17sp · 보조14sp · 제목24~28sp · 간격4dp 단위 · 좌우20dp\n버튼/필드 최소56dp · 폰트 확대200%는 스크롤/재배치로 검수\n밝은 코랄은 장식에 사용하고 주 버튼은 대비를 높인 진한 코랄로 제안합니다.\nPowerPoint: 도형/텍스트를 직접 선택해 수정 · SVG: 벡터 도구에서 열어 수정\n재생성: 도구/design_model.py 수정 후 build_design.py 실행',22)
    wb=Workbook();wb.remove(wb.active)
    screen_rows=[];component_rows=[];api_rows=[];state_rows=[];ui_html=[]
    for si,spec in enumerate(SCREENS):
        els=screen_elements(spec);svg=svg_for(els);fn=spec['id']+'_'+spec['title'].replace(' ','_')+'.svg';(ROOT/'UI/SVG'/fn).write_text(svg)
        s=base(spec['id']+'  '+spec['title'],'1차 신규 설계안 · 도형/텍스트 개별 편집 가능 · '+ ' / '.join(spec['features']))
        pt_text(s,.55,1.05,3.5,.35,'1차 화면 설계안 · 390×844dp',12,'accent',True)
        for e in els:ppt_shape(s,e,.55,1.48,3.05/390)
        ref=ROOT/'근거/APK'/str(spec.get('reference') or '')
        ref=ref.with_suffix('.png') if spec.get('reference') else None
        if ref and ref.exists():
            pt_text(s,3.95,1.05,3.2,.38,'이번 실행 APK · 관찰 근거',12,'muted',True)
            s.shapes.add_picture(str(ref),Inches(4),Inches(1.48),height=Inches(6.6))
        else:
            pt_text(s,4.05,1.55,2.6,.8,'명세 기반\n신규 화면',24,'accent',True)
            pt_text(s,4.05,2.85,2.6,3.7,'데모에서 동작을\n확인한 화면이 아닙니다.\n\n구현·실제 연동·실기기\n검수가 필요합니다.',18,'muted')
        pt_text(s,7.25,1.12,8.15,.5,'대상  '+spec['role'],20,'ink',True)
        y=1.95
        for n in spec['notes']:
            n=wrap(n,38);linecount=len(n.splitlines());hh=max(.7,linecount*.27+.15)
            pt_text(s,7.25,y,8.1,hh,n,17);y+=hh+.17
        pt_text(s,7.25,5.98,8.15,.35,'상태와 예외',16,'accent',True)
        pt_text(s,7.25,6.4,8.1,.95,wrap(spec['states'],49),14,'body')
        pt_text(s,7.25,7.55,8.1,.8,'API  '+', '.join(spec['api']),12,'muted')
        s.notes_slide.notes_text_frame.text='기능: '+' '.join(spec['features'])+'\n권한: '+spec['role']+'\n'+'\n'.join(spec['notes'])+'\n상태: '+spec['states']+'\nAPI: '+', '.join(spec['api'])
        screen_rows.append([spec['id'],spec['title'],' '.join(spec['features']),spec['role'],'신규 설계안',fn,str(ref.relative_to(ROOT)) if ref and ref.exists() else '이번 APK에 대응 화면 없음',spec['states'],', '.join(spec['api'])])
        for i,(kind,t) in enumerate(spec['rows'],1):component_rows.append([spec['id'],f'{spec["id"]}-C{i:02}',kind,t,'\n'.join(spec['notes']),spec['role'],spec['states']])
        for op in spec['api']:api_rows.append([spec['id'],op,' '.join(spec['features'])])
        state_rows.append([spec['id'],'정상/로딩/빈결과/오류/권한변경',spec['states'],'입력·필터·선택·스크롤 보존. 결과불명은작업조회. 쓰기는버전/권한검증.'])
        refhtml=f'<figure><img src="../근거/APK/{ref.name}"><figcaption>이번 APK 실행 캡처 · {E(ref.stem)}</figcaption></figure>' if ref and ref.exists() else '<div class="new">최신 기능명세서에 따라 새로 설계한 화면입니다.</div>'
        ui_html.append(f'<article class="screen" id="{spec["id"]}"><h2>{spec["id"]} {E(spec["title"])}</h2><p class="meta">{" · ".join(spec["features"])} · {E(spec["role"])}</p><div class="pair"><figure><img src="SVG/{E(fn)}"><figcaption>수정 가능한 1차 화면 원본 · <a href="SVG/{E(fn)}">SVG 열기</a></figcaption></figure>{refhtml}<div class="notes">'+''.join('<p>'+E(n)+'</p>' for n in spec['notes'])+f'<h3>상태</h3><p>{E(spec["states"])}</p><h3>API</h3><p>{E(", ".join(spec["api"]))}</p></div></div></article>')
    # 실제 실행 캡처 전용 페이지에 관찰 경로를 표시한다.
    for p in sorted((ROOT/'근거/APK').glob('*.png')):
        meta=json.loads(p.with_suffix('.json').read_text());s=base('APK 관찰  '+p.stem,'원본 스크린샷 · 이번 실행 · 설계안/실서비스 검수 결과와 구분')
        s.shapes.add_picture(str(p),Inches(.8),Inches(1.15),height=Inches(7.1))
        pt_text(s,4.8,1.4,10,1.1,meta['action'],26,'ink',True)
        pt_text(s,4.8,2.85,10,1.6,'촬영 시각  '+meta['captured_at']+'\nAndroid 15(API35) · daylog35 · 1080×2400\n예시 데이터 기반 데모 모드',19,'body')
        pt_text(s,4.8,5.05,10,2,'관찰 근거: PNG + UI XML + 화면 텍스트 + 실행 경로\n실제 로그인·서버 업로드·공동 동기화·실제 지도·검사·만료는 이 캡처로 검증되지 않습니다.',20,'muted')
    prs.save(ROOT/'UI/05 UI 설계.pptx')
    sheet(wb,'화면목록',['화면ID','화면명','기능','권한','설계상태','SVG','APK근거','대표상태','API'],screen_rows,[12,28,22,30,18,38,42,65,65])
    sheet(wb,'구성요소명세',['화면ID','요소ID','유형','표시문구','동작·검증·전환','권한','오류·상태'],component_rows,[12,18,15,48,100,32,70])
    sheet(wb,'화면API연결',['화면ID','operationId','기능'],api_rows,[16,35,28])
    sheet(wb,'화면상태',['화면ID','공통상태','화면별주요상태','복구규칙'],state_rows,[14,45,90,80])
    flow=[('앱시작','UI01','세션복원실패/없음','replace','초대와 보류작업 유지'),('UI01','UI02','최초가입','replace','동의 완료 전 공동진입 제한'),('UI01/UI02','UI24','보류초대 존재','replace','참여하기 재확인'),('UI01/UI02','UI03','로그인/가입완료','replace','초대없음'),('UI03','UI04','모임생성','push','첫일정 필수'),('UI03','UI05','모임카드','push','현재참여'),('UI05','UI23','초대 발급·관리','push','모든 현재 참여자·같은 모임 초대'),('UI05','UI06','일정추가','push','현재 방장·반복 없음'),('UI05','UI08','일정선택','push','날짜별 화면 경유없음'),('UI08','UI09','공동기록','tab','필터·보기방식·스크롤 유지'),('UI08','UI13','장소선택','push','사람별/시간순 보기'),('UI08','UI10','장소추가','push','일정/방문일 전달·15개 검사'),('UI10','UI11','직접등록','push','검색어 초깃값'),('UI10/UI11','UI08','방문저장성공','pop','마지막순서 추가·예정 시각'),('UI08','UI12','계획편집','push','미저장이탈확인'),('UI08/UI13','UI14','올리기','sheet','취소/만료검증'),('UI14','UI15','촬영','push','필요시권한'),('UI14/UI15','UI16','파일선택/사용','push','최대120'),('UI16','UI17','업로드확인','push','서버접수·한도 파일별 거부'),('UI09/UI13/UI22','UI18','카드열기','push','공동/본인context'),('UI09/UI13/UI22','UI16','길게누르기/선택','mode','최대120·기존 기록 선택(구 UI19)'),('UI16','UI20','본인정보수정','push','같은일정본인'),('UI18/UI16','UI21','휴대폰 저장','sheet','현재참여·공유 없음'),('UI28','UI22','내기록','push','나간모임본인포함'),('UI26','UI27','나가기','sheet','방장선행조건'),('UI28','UI30','계정삭제','push','재인증·역할정리'),('UI28','UI29','로그인수단','push','명시적연결'),('UI31','UI28','차단해제/신고조회','pop','목록/집계갱신'),('UI26','UI32','부재복구문의','push','후임별도동의'),('UI28','UI33','캐시/저장공간','push','원본과캐시분리'),('모든쓰기화면','UI35','결과불명/충돌','inline/sheet','입력유지·작업조회')]
    sheet(wb,'화면전환',['출발','도착','이벤트','방식','전달·복귀규칙'],flow,[28,18,35,20,70])
    sheet(wb,'디자인토큰',['토큰','값','용도·기준'],[['기준 캔버스','390×844dp','Android 대표화면·실제는가변레이아웃'],['본문','17sp','200%글자확대검수'],['보조','14sp','충분한대비'],['터치','최소56dp','달력 셀은예외로확대날짜선택목록 보완'],['간격','4dp단위·좌우20dp','카드간12·섹션32'],*[[k,'#'+v,'브랜드/본문/표면'] for k,v in COLORS.items()]], [30,30,75])
    wb.save(ROOT/'UI/05 화면 명세.xlsx')
    navigation=''.join(f'<a href="#{s["id"]}">{s["id"]} {E(s["title"])}</a>' for s in SCREENS)
    ui_page='''<!doctype html><html lang="ko"><meta charset="utf-8"><title>At that place 1차 UI 설계</title><style>
    *{box-sizing:border-box}body{font-family:'Noto Sans CJK KR',sans-serif;color:#191F28;background:#f4f5f7;margin:0}header{background:#202A35;color:white;padding:40px}header a{color:#fff}h1{font-size:34px}h2{font-size:27px}aside{position:fixed;top:0;bottom:0;width:250px;overflow:auto;background:white;padding:22px}aside a{display:block;padding:8px;font-size:13px;color:#4E5968;text-decoration:none}main{margin-left:250px}.screen{background:white;border-radius:20px;margin:30px;padding:30px;scroll-margin:20px}.pair{display:flex;gap:28px;align-items:flex-start}figure{margin:0;width:255px;flex-shrink:0}figure img{width:100%;border:1px solid #DCE1E6;border-radius:16px}figcaption{font-size:12px;line-height:1.7;color:#5F6B78;margin-top:8px}.notes{max-width:630px;font-size:15px;line-height:1.9}.meta{color:#B8433F}.new{width:210px;background:#FDEDEB;color:#B8433F;padding:24px;border-radius:15px;flex-shrink:0}.notes h3{font-size:15px}a{color:#B8433F}@media(max-width:1100px){aside{display:none}main{margin:0}.pair{flex-wrap:wrap}}@media print{@page{size:A4 landscape;margin:10mm}aside,header{display:none}main{margin:0}.screen{margin:0;padding:15px;break-after:page;break-inside:avoid;border-radius:0}.pair{flex-wrap:nowrap;gap:24px}figure{width:235px}.notes{font-size:13px;line-height:1.75}body{background:white}h2{margin:0 0 8px}}
    </style><aside><b>1차 UI 설계</b><p><a href="../00 설계서 안내.html">← 설계서 목록</a></p>'''+navigation+'''</aside><main><header><h1>At that place 1차 UI 설계</h1><p>'''+str(len(SCREENS))+'''개 대표 화면 · Android 12+ · 기능명세 v2(2026-10-20 회의 반영) · UI07 폐지·UI19는 UI16에 통합 · 수정 가능한 PPTX와 SVG</p><p><a href="05 UI 설계.pptx">PowerPoint 원본</a> · <a href="05 화면 명세.xlsx">화면 명세 Excel</a> · <a href="05 UI 설계.pdf">열람용 PDF</a></p></header>'''+''.join(ui_html)+'</main></html>'
    (ROOT/'UI/05 UI 화면 갤러리.html').write_text(ui_page)
    (ROOT/'UI/화면데이터.json').write_text(json.dumps(SCREENS,ensure_ascii=False,indent=2))

def build_docs():
    d=Doc('01 시스템 설계','At that place 1차 시스템 설계')
    for title,ps in ARCH:
        d.h(title)
        for p in ps:d.p(p)
        if title.startswith('3 '):d.image(ROOT/'부록/아키텍처.png')
    d.h('9 요구사항과 기술 근거')
    d.table(['ID','자료','반영 범위','우선순위'],SOURCES);d.save()
    d=Doc('02 데이터베이스 설계','At that place 1차 데이터베이스 설계')
    d.p('PostgreSQL16 물리 설계 v0.3.1(반복 테이블 제거·초대 횟수·방문 15개·사진5/영상2 트리거). 컬럼별 정의의 원천은 도구/physical_model.py이며 부록/DB/001_initial.sql과 이 사전을 함께 생성한다. 초기 스키마와 DB 제약은 임시 DB에서 실행 검증했다. FK는 ON DELETE NO ACTION, 서버 역할은002_service_roles.sql을 따른다. API/worker의 업무 권한·검사·집계·최종 완료는 별도 구현 및 통합 검수가 필요하다.')
    d.h('1 핵심 관계');d.image(ROOT/'부록/ERD.png');d.table(['부모','자식','관계'],RELATIONS)
    d.h('2 공통 데이터 규칙')
    for p in ['식별자는UUID, 순간은timestamptz(UTC저장), 기록일·방문일·일정의날짜는date, 표시는Asia/Seoul이다. 순수날짜를기기UTC Date 변환으로계산하지않는다.','모든수정대상은version을갖고초기1에서증가한다. 보관고정·소유자·완료시각·최초선택순서는수정가능정보와분리한다.','문자길이는SQL char_length가아닌NFC후grapheme단위애플리케이션검증을기준으로한다. DB의text크기/체크는보조장치다.','집계캐시는가속용이다. 사용자가볼수있는파일조건(완료·기한·삭제·운영·차단)과같은predicate로응답집계를구성한다.','representative cover는별도asset이며일반기록바이트/보관정책과혼동하지않는다. 모임종료후불필요한대표사진·계획은정리한다.']:d.p(p)
    d.h('3 테이블과 필드')
    for t in TABLES:
        d.h(t['name']+'  '+t['purpose'],2);d.p('관련 기능: '+' '.join(t['features']))
        d.table(['컬럼','타입·NULL·기본값·컬럼제약','정의 원천','설명'],t['fields'])
        d.p('인덱스: '+'; '.join(t['indexes']))
        for r in t['rules']:d.p(r)
    d.h('4 권한과 무결성 강제 위치')
    d.table(['불변식','DB/API 강제','경쟁 검수'],[
      ['활성참여10명·중복없음','group잠금+활성membership 부분UNIQUE','9명동시2참여'],['초대 관리 현재 권한','현재 member·활성 모임·이용 제한 검증·발급자 ID는 이력','일반 참여자/타인 초대 취소·참여 종료 경합'],['초대 확인 50회','invitations 행 잠금+use_count 증가·소진 트리거','49회 동시 두 확인'],['방문 15개/일','schedule 잠금+visit_limit 트리거','14개 동시 두 추가'],['작성자 사진5/영상2','advisory lock+media_limit 트리거(task+media 합산)','같은 방문 동시 접수·F17 이동'],['방장한명·활성참여','groups.owner_user_id단일원천+membership일치검사','이전/나가기/종료 경합'],['일정별최초기한고정','schedule잠금+null→값트리거·업무권한','첫완료/변경 동시'],['용량5GB','group잠금+완료/예약CHECK','동시접수/실패/취소/정리'],['파일완료1회','media.task_id UNIQUE+task잠금','중복worker/완료취소'],['빈방문/일정삭제','접수/완료와같은잠금+숨김task포함조회','삭제/접수 경합'],['일괄수정원자성','검사후모든대상잠금·버전검증·단일커밋','검사중버전변경'],['오래된퇴장무효','targetMembershipId고정+멱등결과','해제/재가입후재시도']])
    d.h('5 정리와 복원');d.p('논리차단→정리outbox→원본/파생본삭제→purged_at와용량반환을한번확정한다. 객체정리의부분실패는재시도하되접근을복구하지않는다. 백업최대30일, 복원은tombstone먼저반영후API를개방한다. 신고증거는암호화·최소권한·종료후최대90일로별도정리한다.');d.save()
    d=Doc('03 API 연동 설계','At that place 1차 API 연동 설계')
    d.p('부록/openapi.json은OpenAPI3.1구현계약안이다. 서버주소example.invalid는실제배포주소가아니다. 모든operationId는화면/기능/검수추적표와연결한다. 인증과운영권한·공개전검사·도메인검증은스키마만으로완성되지않으며서버에서집행한다.')
    d.h('1 공통 요청과 응답')
    d.table(['구분','계약'],[
      ['기본경로','/v1. 실제 도메인은 배포시 주입. JSON UTF-8, 업로드 PATCH는 바이너리.'],['인증','Authorization: Bearer. auth/exchange·문서·초대미리보기는 공개,refresh는 본문 refreshToken 검증.'],['멱등','업무 쓰기 Idempotency-Key(16~128자),actor+route+key유일. 업로드 PATCH는 세대·offset·청크해시로 중복 판정.'],['버전','expectedVersion과 필요시 previewId. 충돌409는 입력 유지·최신값 확인.'],['정상','확정200 또는 접수202 Operation. 키는 operationId로 통일. HEAD/PATCH 성공은204와 전송 헤더. 전송100%는 완료 아님.'],['오류','{code,message,requestId,retryable,operationId?,currentVersion?,itemErrors?}. HEAD 오류는 본문 없이 X-Error-Code/X-Request-Id.'],['페이지','모임30개·파일60개. opaque cursor에 필터/정렬/actor/snapshotAt와 마지막 정렬키 서명.'],['목록스냅샷','snapshotAt 뒤 완료 파일은 갱신에서 반영. 삭제·차단·만료는 즉시 제외.'],['필드삭제','apply/value 명시. 설명 빈문자열은 비우기,visitId:null은 미지정. 누락 필드는 유지.'],['파일GET','인증된 thumbnail/view/export만. Range 재검증·private/no-store. 위치포함 원본GET 없음.'],['파일전송','ATP-Upload/1: 인증 HEAD/PATCH·offset·generation·SHA256·24h transport.09 문서·예제 참조.']])
    d.h('2 업무별 확정과 실패 단위')
    d.table(['업무','성공 조건','실패·재시도'],[
      ['초대 조회/발급/취소','모든 현재 참여자(member)·같은 모임 전체 초대·발급자 ID는 이력','비참여/참여 종료/이용 제한/모임 종료 거부·멱등 재시도 재검증'],['모임생성','모임+방장참여+첫일정(날짜만)한커밋','응답유실은동일키결과조회'],['초대확인/참여','확인마다 use_count+1·50회 소진. 참여는 서버시각·정원·차단·계정·모임 재검증','만료/소진/취소/종료/정원/차단구분'],['일정추가/변경','날짜 범위·겹침 안내. 변경은 기간 밖 영향 confirm 없으면 409','버전충돌409·입력유지'],['방문추가','일정잠금·중복·15개 검사·예정시각','VISIT_LIMIT·중복요청 방문 불증가'],['파일접수','유효후보별task+예약·작성자×방문 사진5/영상2. 잘못된/초과후보는fileErrors·remaining','수락0개면공동빈묶음없음'],['파일완료','위치/검사·현재권한·기한재검증','기존task재시도·성공파일중복없음'],['일괄정보수정','검사후전체대상원자커밋','하나오류면전체미적용'],['일괄삭제','사전권한전체검증후파일별결과','실패파일만재시도·이미삭제성공'],['휴대폰 저장','purpose=save만. 준비와실제기기쓰기를분리','새파일GET권한재검증·share 400']])
    for a in APIS:
        d.h(a['id']+'  '+a['method']+' '+a['path'],2)
        d.table(['항목','계약'],[['기능·권한',' '.join(a['features'])+' / '+a['auth']],['요청',a['request']],['응답',a['response']],['도메인오류',a['errors']]])
    d.h('3 오류코드와 화면 동작')
    d.table(['오류','HTTP','화면동작'],[['VALIDATION_ERROR / FILE_INVALID','400','대상/필드별이유·입력유지'],['VISIT_LIMIT / MEDIA_LIMIT / INVITE_EXHAUSTED','409·410','남은 개수·사유 표시, 초과 파일만 제외, 소진 초대는 새 발급 안내'],['OUTSIDE_RANGE_CONFIRMATION_REQUIRED','409','기간 밖 방문/기록 수 확인 후 confirm 재요청'],['AUTH_EXPIRED / REAUTH_REQUIRED','401','인증복구후보류경로복귀'],['FORBIDDEN / ACCESS_REVOKED','403','공동화면종료·본인기록경로유지'],['VERSION_CONFLICT / PREVIEW_STALE','409','최신값·내입력비교·재적용'],['CAPACITY_FULL / QUOTA_EXCEEDED','409','정원/예약포함사용량안내'],['EXPIRED / DELETED / GROUP_CLOSED','410','재시도로부활시키지않음'],['PROVIDER_UNAVAILABLE','503','실패종류·재시도·문의ID'],['MODERATION_RESTRICTED','403','운영사유/이의경로·허용된본인삭제유지']]);d.save()
    d=Doc('04 업무 흐름 상태 설계','At that place 1차 업무 흐름과 상태 설계')
    for title,ps in WORKFLOWS:
        d.h(title)
        for p in ps:d.p(p)
    d.h('13 권한 판정표')
    d.table(['동작','현재참여자','현재방장','참여종료작성자','운영자'],[
      ['공동조회/계획','가능','가능','불가','운영케이스최소범위'],['장소추가·예정시각·계획(15개/일)','가능','가능','불가','없음'],['업로드(방문당 사진5·영상2)','유효일정','동일','불가','없음'],['초대 조회·발급·공유·복사·개별 취소','가능(같은 모임 전체)','가능(같은 모임 전체)','불가','일반 초대 관리 권한 없음'],['일정추가/변경/취소/삭제·모임정보/역할','불가','가능','불가','복구만별도절차'],['본인정보수정','본인만','본인만','불가','콘텐츠조치별도'],['본인조회/삭제','가능','가능','본인파일만','위반조치예외'],['휴대폰 저장(길게 눌러 다중 선택)','조회가능본인·타인','동일','본인도불가','일반내보내기권한없음'],['개인차단/신고','가능','가능','본인보존문의','케이스처리'],['모임종료','불가','마지막1인만','불가','종료재개불가']])
    d.h('14 수정 가능한 다이어그램');d.p('부록/다이어그램/*.mmd는유스케이스가아닌실행시퀀스·상태도원본이다. Mermaid를지원하는IDE에서편집/렌더링한다. DB관계와구성도는부록/ERD.svg·아키텍처.svg의도형/텍스트를수정할수있다.');d.save()
    d=Doc('09 구현 계약 보완','At that place 1차 구현 계약 보완','v0.3.1 · 2026-10-24 초대 권한 확대·기존 회의 반영·기준 명세 v2.1·물리 DB·전송·운영·검수')
    for title,paragraphs in SECTIONS:
        d.h(title)
        for p in paragraphs:d.p(p)
        if title.startswith('8 '):d.table(['구분','필요 조건','개발 방식','완료 조건'],EXTERNAL)
    d.h('11 검증 파일 안내')
    d.table(['자료','범위'],[['기준/기준선.json','정책 원본 SHA256·독립 패키지 기준'],['기준/재사용후보.json','DayLog 경로·파일 hash·선별 조건·선언 버전'],['부록/DB/검증결과.json','초기 DDL/DB 제약/정원 경쟁'],['부록/DB/실제 컬럼 사전.json','실행 DB에서 조회한 타입·NULL·기본값'],['부록/계약예제/examples.json','정상·오류 JSON 예제'],['부록/계약예제/검증결과.json','OpenAPI 예제 유효성'],['06 검수 및 추적.xlsx','자동/경쟁/기기/수동 검수 방식·실제 기능 결과 미실행']]);d.save()

def build_tracking():
    wb=Workbook();wb.remove(wb.active)
    feature_rows=[];qa_rows=[]
    for i in range(1,29):
        f=f'F{i:02}';uis=[s['id'] for s in SCREENS if f in s['features']];ops=[a['id'] for a in APIS if f in a['features']];tables=[t['name'] for t in TABLES if f in t['features']]
        if f=='F12':
            ops=['로컬 Android Camera API → F14/F15 접수·전송'];tables=['계정별 촬영 임시 파일(로컬)']
        feature_rows.append([f,label(f),', '.join(uis),', '.join(ops),', '.join(tables),', '.join(f'TC-{f}-{j+1:02}' for j in range(len(QA[f]))),'설계 연결 완료 / 구현·검수 미실행'])
        for j,(scenario,expected) in enumerate(QA[f],1):
            qa_rows.append([f'TC-{f}-{j:02}',f,label(f),'P0' if f in ['F01','F05','F15','F17','F18','F20','F21','F22','F23','F24','F26'] else 'P1',scenario,expected,', '.join(uis),'staging 실제연동+실기기/서버경쟁 주입','미실행','','','',test_method(f,scenario)])
    sheet(wb,'요구사항추적',['기능ID','기능명','UI','API','DB','테스트','구현·검수상태'],feature_rows,[12,40,48,90,80,65,40])
    sheet(wb,'공통정책추적',['정책ID','정책','기능','핵심 검수'],[
      ['P01','일정별 보관 고정','F21','최초완료·종료날짜+달력3개월·말일·변경불가·만료접근차단'],
      ['P02','마지막 방장 모임 종료','F23','본인파일삭제·타인유효파일보존·재개불가'],
      ['P03','강제 퇴장과 재참여 차단','F22','참여세대·차단해제·오래된퇴장재시도'],
      ['P04','방장 부재 수동 복구','F27','본인/후임확인·통지·7일·이견보류·수동검증'],
      ['P05','빈 방문·빈 일정 삭제','F11','숨김/보존파일과진행task포함·경쟁전체거부'],
      ['P06','표시명','F02','20자·중복허용·소유권유지'],
      ['P07','촬영 위치 메타데이터 제거','F20','타인제공모든variant·원본불변·제거검증실패비공개'],
      ['P08','신고·차단·콘텐츠 운영','F25 F26','개인/모임차단분리·검사전비공개·운영별도권한'],
      ['P09','가입 동의와 철회','F02','필수/선택·버전/시각·필수철회계정삭제'],
      ['P10','기록일','F14','일정양끝날짜·실촬영시간독립·방문일일치'],
      ['P11','작성자별 방문당 업로드 한도','F13 F14 F17 F18','사진5·영상2·미지정은작성자×일정×기록일·완료+진행합산·실패/취소/삭제반환·동시접수'],
      ['P12','일차별 방문 한도','F09 F10 F11','일정×방문일활성방문15개·16번째거부·동시추가·삭제후복귀']],[15,35,20,95])
    sheet(wb,'기능검수',['TC ID','기능ID','기능명','우선순위','입력·행동·조건','기대결과','화면','검수환경','결과','앱버전·OS·기기','실측·증거','결함번호','예정 실행 방식'],qa_rows,[20,12,34,12,80,90,40,55,18,35,55,25,60])
    sheet(wb,'계약통합검수',['ID','대상','입력·행동','기대결과','실행 방식','서버 검수 결과'],[[*r,'미실행'] for r in CONTRACT_CASES],[16,35,85,100,50,24])
    sheet(wb,'보완개발순서',['순서','범위','필수 선행 조건','완료 문턱'],[
      ['1 계약/기술 검증','기준선·DDL·전송·SDK·혼합파일','파일/스크립트와 실제 환경 준비','스키마·예제·기술 검증 결과 기록'],
      ['2 계정/모임/초대','F01~F05 + 최소 파일 처리 뼈대','Node/Fastify/pg·신규 앱 셸','권한·동시 정원·응답 유실 확인'],
      ['3 일정/장소/계획','F06~F11','날짜 범위 일정·방문 15개·예정 시각·버전','기간 밖 확인·취소/삭제·방문 한도 경쟁 확인'],
      ['4 업로드/감상','F12~F16 + F20 + F26 공개 전 검사','실제 위치 제거·비공개 review·transport·사진5/영상2 트리거·시간순/사람별 보기','위치 검증과 검사 통과 전 완료/공개 금지·한도 경쟁'],
      ['5 공통 선택/수정/삭제/저장','F17~F19','공개 완료 파일·동일 권한 predicate·UI16 선택 모드','원자 수정·파일별 삭제·휴대폰 저장 권한·공유 경로 없음'],
      ['6 생명주기/운영/실연동','F21~F28','운영 계정·실제 공급자/문서/연락처','실기기·SLA·복원·출시 검수']],[30,65,85,100])
    nfr=[
      ['NFR01','성능','Android12 RAM4GB·10Mbps RTT100ms·100모임/일정1000파일','p95 첫표시<=2s/후속<=1s/재생시작<=3s·버튼<=100ms','미실행'],
      ['NFR02','위치태그','사진/영상/대표사진각형식·회전·HDR·GPS유무','타인제공모든variant에서GPS없음·촬영시각/방향/음성보존','미실행'],
      ['NFR03','접근차단','만료/삭제/퇴장/차단전발급exportId·Range·직접URL','새요청즉시거부·기존외부사본회수주장없음','미실행'],
      ['NFR04','파일정리','대상파일/파생본정리실패주입·중복worker','접근즉시차단·24h내정리·실패경보·용량1회반환','미실행'],
      ['NFR05','백업복원','30일이내백업+삭제/만료tombstone복원','파일공개전tombstone반영·삭제자료재공개없음','미실행'],
      ['NFR06','Android기기','API31/32/33/34/35+·사진선택기/권한/백그라운드','지원범위기능일치·시스템권한/프로세스종료복구','미실행'],
      ['NFR07','접근성','200%글자확대·TalkBack·좁은폭·다크시스템','주요작업완료·잘림/겹침없음·역할/라벨·선택상태','미실행'],
      ['NFR08','부하/경쟁','9명2참여·5GB동시예약·완료취소·종료참여·49회초대·14개방문·사진5경계','모든불변식유지·중복생성/집계없음·한도초과없음','미실행'],
      ['NFR09','운영SLA','검사장애/신고/이의/복구통지실패','비공개대기·24h최초/3영업일이의·7일대기수동결정','미실행'],
      ['NFR10','실연동','카카오/Google/국내지도/파일서버/검사/문의','목업과빈문서/연락처로완료처리하지않음','미실행']]
    sheet(wb,'비기능검수',['ID','항목','조건','기대결과','결과'],nfr,[18,25,90,100,20])
    sheet(wb,'검수계획',['단계','목적','환경·준비','완료기준'],[
      ['1 도메인단위','보관/반복/문자/권한','고정KSTclock·경계벡터','명세경계일치'],['2 API통합','트랜잭션/멱등/파일검증','staging DB·스토리지·검사대체/실연동','실패주입과재시도결과일치'],['3 경쟁','정원·역할·보관·원자수정','동시클라이언트·DB장벽','불변식유지'],['4 Android','권한·촬영·선택기·백그라운드','에뮬레이터+API31최저/보급형실기기','120개혼합·강제종료복구'],['5 운영','신고·이의·복구·정리/복원','운영별도계정·연락처·SLAclock','실제큐/감사/문의연결'],['6 수락','F01~28 전체·성능','버전/기기/파일/네트워크증거','중대미해결0·전항목결과기록']],[25,55,85,70])
    sheet(wb,'검증된데모범위',['구분','이번 확인','확인하지 않은 범위'],[['관찰','근거/APK PNG·XML·JSON·실행검토.docx 참조','실제인증·서버동기화·실지도·미디어검사·보관·실기기성능'],['설계검증','산출물구조·화면/기능/API참조·OpenAPI스키마·SVG시각검토','기능테스트결과를성공으로기입하지않음']],[25,100,100])
    wb.save(ROOT/'06 검수 및 추적.xlsx')
    wb=Workbook();wb.remove(wb.active)
    sheet(wb,'자료차이와반영',['항목','이전근거','이전값','최신명세기준','기능근거','설계반영'],CONFLICTS,[24,50,65,75,25,75])
    sheet(wb,'기술결정',['ID','영역','선택안','이유·검증할점','상태','담당역할'],DECISIONS,[16,25,80,100,30,32])
    sheet(wb,'출시준비',['항목','담당역할','필요한실값/행동','종료조건'],[
      ['로그인','앱/백엔드','카카오/Google 앱ID·서명·리디렉트·공급자 subject 검증','두수단실연동·명시적연결·실패복구'],['지도','앱/백엔드','카카오맵키·도메인/패키지·장소데이터보관/표시조건','실제검색·실패/율제한'],['클라우드','인프라','리전·DB/Storage·private정책·키·백업·정리','접근차단/24h정리/복원훈련'],['콘텐츠검사','운영/백엔드','사진/영상/텍스트엔진·기준·검토인력','장애시비공개·실제큐·SLA'],['문서/문의','제품/운영','약관·개인정보·동의항목/버전·공개연락처','열람/동의저장/철회/실문의'],['기기/성능','앱/QA','API31최저·보급형·혼합파일·네트워크프로파일','F01~28·성능실측증거']],[25,30,100,90])
    sheet(wb,'구현과외부준비구분',['구분','필요 조건','개발 방식','완료 조건'],EXTERNAL,[30,50,95,95])
    sheet(wb,'자료목록',['ID','경로·URL','검토내용','우선순위·용도'],SOURCES,[14,100,100,55]);wb.save(ROOT/'07 결정 및 자료 차이.xlsx')
    wb=Workbook();wb.remove(wb.active)
    from physical_model import TABLES as physical
    sheet(wb,'컬럼',['테이블','컬럼','타입·NULL·기본값·컬럼제약','설명'],[[n,*c] for n,t in physical.items() for c in t['columns']],[30,32,105,80])
    sheet(wb,'제약과인덱스',['테이블','구분','SQL 정의'],[[n,'테이블 제약',v] for n,t in physical.items() for v in t['constraints']]+[[n,'인덱스',v] for n,t in physical.items() for v in t['indexes']],[30,25,150])
    sheet(wb,'서비스강제',['불변식','DB 강제','서비스 추가 책임'],[
      ['초대 관리','issuer_user_id 기록·group/초대 잠금','모든 현재 member 권한·타인 초대 취소·참여 종료와 멱등 재시도 재검증'],['동시 참여','group 잠금·활성 중복유일·정원10명','초대시각·모임별 차단·현재 계정 검증'],
      ['보관 고정','첫 기준 계산·고정 이후 변경 거부','첫 공개 완료 시각·현재 권한·기한 경합'],
      ['파일 공개','위치 미검증 파생 ready 거부·task별media유일','실파일 제거 검증·콘텐츠 검사·완료 트랜잭션'],
      ['일괄 수정','대상별 버전 컬럼·정합 FK','검사 뒤 전 대상 재검증·전체 단일 커밋'],
      ['운영','감사 이력 append-only·서버 역할 분리','OIDC/MFA·역할·사유·당사자 확인']],[35,100,100])
    wb.save(ROOT/'부록/DB/컬럼 및 제약.xlsx')

def build_index():
    files=[('09 구현 계약 보완','v0.3.1 변경 요약(2026-10-20 회의)·기준선·DayLog 선별 재사용·재개 업로드·개발 순서'),('01 시스템 설계','서비스 구조·확정한 도구·인증·파일접근·운영'),('02 데이터베이스 설계',f'{len(TABLES)}개 테이블의 컬럼별 물리 정의·실행 SQL·DB 제약'),('03 API 연동 설계',f'{len(APIS)}개 operation·typed 업무 결과·HEAD/PATCH 전송'),('04 업무 흐름 상태 설계','업로드·위치 제거·검사·보관·원자 수정·생명주기')]
    rows=''.join(f'<a class="card" href="{n}.docx"><b>{n}</b><span>{desc}</span></a><a class="pdf" href="{n}.pdf">PDF 열기</a>' for n,desc in files)
    index='''<!doctype html><html lang="ko"><meta charset="utf-8"><title>At that place 1차 개발 설계서</title><style>
    body{font-family:'Noto Sans CJK KR',sans-serif;color:#191F28;background:#f3f5f7;margin:0}header{padding:55px max(30px,calc((100vw - 1120px)/2));background:#202A35;color:white}header small{color:#F1706B}h1{font-size:42px;line-height:1.35}main{max-width:1120px;margin:35px auto;padding:0 24px}h2{margin-top:45px}p{line-height:1.9}.grid{display:grid;grid-template-columns:1fr 110px;gap:12px}.card,.pdf{display:block;background:white;padding:22px;border:1px solid #DCE1E6;border-radius:14px;text-decoration:none;color:#191F28}.card b{display:block;font-size:20px}.card span{display:block;color:#5F6B78;margin-top:8px}.pdf{color:#B8433F;display:flex;align-items:center}.primary{background:#B8433F;color:white;padding:22px;border-radius:14px;display:inline-block;text-decoration:none;font-size:22px}.info{background:#FDEDEB;padding:25px;border-radius:16px}a{color:#B8433F}li{margin:14px 0;line-height:1.7}code{background:#e9edf0;padding:2px 6px}footer{padding:35px;color:#5F6B78}
    </style><header><small>AT THAT PLACE · '''+DATE.replace('-','.')+''' · 1차 구현 설계안</small><h1>함께한 순간을 모으는 앱<br>1차 개발 설계서</h1><p>기능명세서 v2(2026-10-20 회의 반영) F01~F28을 시스템·DB·API·화면·검수 항목으로 연결했습니다.<br>Android 12 이상 · Asia/Seoul 고정 · 반복 일정·외부 공유 없음 · 영상 편집·제작·결제 후속</p></header><main>
    <a class="primary" href="UI/05 UI 화면 갤러리.html">UI 화면과 APK 캡처 함께 보기 →</a>
    <h2>개발 설계서</h2><div class="grid">'''+rows+'''</div><h2>편집 가능한 UI 원본</h2><ul>
    <li><a href="UI/05 UI 설계.pptx">UI 설계 PowerPoint</a> — 글자·버튼·필드·배경을 개별 도형으로 수정합니다. 실제 APK 캡처는 별도 근거 이미지입니다.</li>
    <li><a href="UI/05 화면 명세.xlsx">화면 명세 Excel</a> — 화면목록·구성요소·상태·전환·API·디자인토큰</li>
    <li><a href="UI/05 UI 설계.pdf">UI 열람용 PDF</a> · <a href="UI/화면데이터.json">화면 데이터 JSON</a> · SVG 원본은 각 갤러리 화면에서 엽니다.</li>
    </ul><h2>검수와 구현 결정</h2><ul>
    <li><a href="06 검수 및 추적.xlsx">검수 및 요구사항 추적 Excel</a> — 28개 기능·112개 기능 시나리오·10개 비기능 항목. 구현 검수 결과는 미실행입니다.</li>
    <li><a href="07 결정 및 자료 차이.xlsx">결정 및 자료 차이 Excel</a> — 이전 자료와 최신 명세의 충돌·기술 선택안·출시준비</li>
    <li><a href="부록/openapi.json">OpenAPI 3.1 JSON</a> — 실제 배포 서버가 아닌 구현 계약안</li>
    <li><a href="근거/08 APK 실행 검토.docx">APK 실행 검토 Word</a> · <a href="근거/08 APK 실행 검토.pdf">실행 검토 PDF</a> · <a href="근거/APK/실행검토.json">실행 근거 JSON</a></li>
    <li><a href="부록/아키텍처.svg">아키텍처 SVG</a> · <a href="부록/ERD.svg">ERD SVG</a> · 업무 시퀀스/상태 원본은 <code>부록/다이어그램/</code></li>
    </ul><div class="info"><b>적용 기준과 수정 방법</b><p>루트 기능명세서가 정책 기준입니다. 소개 PDF·선행 XLSX·APK는 참고 자료이며 충돌은 최신 명세로 정리했습니다. 클라우드·검사 공급자·키·문서·문의 연락처·SDK 버전은 실제 환경에서 확정해야 합니다.</p><p>Word·Excel·PowerPoint 파일은 직접 편집할 수 있습니다. SVG는 벡터 편집기로 열어 수정합니다. 전체를 재생성하려면 <code>도구/사용법.txt</code>를 참고하세요. 직접 편집한 Office 파일은 재생성 전에 별도 보관하세요.</p></div><footer>설계 검토와 구현 검수를 구분합니다. PDF는 같은 내용의 HTML 인쇄 레이아웃이며 Office 원본과 줄바꿈이 다를 수 있습니다.</footer></main></html>'''
    index=index.replace('1차 구현 설계안','1차 구현 설계 v0.3.1').replace('루트 기능명세서가 정책 기준입니다.','패키지 내부 기준/기능명세서.md(v2.1, 2026-10-24)가 정책 기준입니다. 정책 원본은 ../기능 명세서/기능명세서.md이며 동일한 SHA256 사본을 포함했습니다. v1 대비 변경은 명세 0절과 09 문서 0절을 보세요.').replace('112개 기능 시나리오·10개 비기능 항목.','112개 기능 시나리오·10개 비기능 항목·12개 계약 통합 시나리오와 실행 방식.').replace('클라우드·검사 공급자·키·문서·문의 연락처·SDK 버전은 실제 환경에서 확정해야 합니다.','서버 도구·전송·물리 스키마·재사용 범위는 v0.2에서 구체화했습니다. 운영 공급자·키·문서·문의 연락처·실기기/빌드 검증은 남아 있습니다.')
    extra='''<h2>v0.3.1 구현 계약과 기준 자료</h2><ul><li><a href="기준/기능명세서.md">기준 기능명세서 사본</a> · <a href="기준/기준선.json">SHA256 기준선</a> · <a href="기준/재사용후보.json">DayLog 재사용 후보와 버전</a></li><li><a href="부록/DB/001_initial.sql">실행 가능한 초기 DB SQL</a> · <a href="부록/DB/검증결과.json">실제 PostgreSQL 검증 결과</a> · <a href="부록/DB/실제 컬럼 사전.json">실행 DB 컬럼 사전</a> · <a href="부록/DB/컬럼 및 제약.xlsx">컬럼·제약 Excel</a></li><li><a href="부록/계약예제/examples.json">정상·오류 JSON 예제</a> · <a href="부록/계약예제/검증결과.json">계약 검증 결과</a> · <a href="부록/계약예제/업로드.http">HEAD/PATCH 요청 예제</a></li></ul>'''
    index=index.replace('<h2>검수와 구현 결정</h2>',extra+'<h2>검수와 구현 결정</h2>')
    index=index.replace('112개',str(sum(map(len,QA.values())))+'개').replace('12개 계약 통합',str(len(CONTRACT_CASES))+'개 계약 통합').replace('기능명세서 v2(', '기능명세서 v2.1(').replace('v2.1(2026-10-20 회의 반영)', 'v2.1(2026-10-24 초대 권한 확대)')
    (ROOT/'00 설계서 안내.html').write_text(index)

def main():
    prepare_baseline(ROOT)
    from physical_model import write_ddl
    write_ddl(ROOT)
    for s in SCREENS:
        if s['reference']:assert (ROOT/'근거/APK'/f'{s["reference"]}.png').exists(),s['reference']
    api_ids={a['id'] for a in APIS}
    assert len(api_ids)==len(APIS)
    assert all(set(s['api'])<=api_ids for s in SCREENS)
    (ROOT/'부록/openapi.json').write_text(json.dumps(build_openapi(),ensure_ascii=False,indent=2))
    (ROOT/'부록/다이어그램').mkdir(exist_ok=True)
    for name,source in SEQUENCES.items():(ROOT/'부록/다이어그램'/(name+'.mmd')).write_text(source)
    build_ui();build_docs();build_tracking();build_index()
    print(json.dumps({'screens':len(SCREENS),'operations':len(APIS),'tables':len(TABLES),'functional_cases':sum(map(len,QA.values())),'native_ui_pptx':str(ROOT/'UI/05 UI 설계.pptx')},ensure_ascii=False))
if __name__=='__main__':main()
