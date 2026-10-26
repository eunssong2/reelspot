"""SVG 미리보기와 열람용 PDF 생성. 네트워크 없이 Chromium으로 렌더링한다."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
from PIL import Image,ImageDraw,ImageFont
from design_model import ROOT

async def render(only_diagrams=False, ui_only=False):
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True)
        page=await browser.new_page(viewport={'width':1600,'height':1100},device_scale_factor=1)
        for name in ([] if ui_only else ['아키텍처','ERD']):
            p=ROOT/'부록'/(name+'.svg')
            await page.goto(p.as_uri());await page.locator('svg').screenshot(path=str(p.with_suffix('.png')))
        if only_diagrams:
            await browser.close();return
        (ROOT/'UI/미리보기').mkdir(exist_ok=True)
        issues=[]
        for p in sorted((ROOT/'UI/SVG').glob('*.svg')):
            await page.goto(p.as_uri());await page.locator('svg').screenshot(path=str(ROOT/'UI/미리보기'/(p.stem+'.png')))
            bounds=await page.evaluate('''()=>[...document.querySelectorAll('text')].map(t=>({text:t.textContent,box:((b)=>({x:b.x,y:b.y,width:b.width,height:b.height}))(t.getBBox())})).filter(t=>t.box.x< -1||t.box.y< -1||t.box.x+t.box.width>391||t.box.y+t.box.height>845)''')
            if bounds:issues.append({'screen':p.stem,'outside':bounds})
        (ROOT/'부록/SVG 레이아웃 검사.json').write_text(json.dumps(issues,ensure_ascii=False,indent=2))
        paths=sorted((ROOT/'UI/미리보기').glob('UI*.png'));out=Image.new('RGB',(1800,math_rows(len(paths))*520),'#e6e9ed');draw=ImageDraw.Draw(out)
        font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',17)
        for i,p in enumerate(paths):
            im=Image.open(p);im.thumbnail((215,470));x=(i%7)*257+18;y=(i//7)*520+30;out.paste(im,(x,y));draw.text((x,y-23),p.stem[:18],font=font,fill='#191F28')
        out.save(ROOT/'UI/전체 화면 미리보기.jpg')
        prototype_paths=sorted((ROOT/'UI/프로토타입').glob('*.png'))
        if prototype_paths:
            out=Image.new('RGB',(1800,math_rows(len(prototype_paths))*520),'#e6e9ed');draw=ImageDraw.Draw(out)
            for i,p in enumerate(prototype_paths):
                im=Image.open(p);im.thumbnail((215,470));x=(i%7)*257+18;y=(i//7)*520+30
                out.paste(im,(x,y));draw.text((x,y-23),p.stem,font=font,fill='#191F28')
            out.save(ROOT/'UI/프로토타입 전체 미리보기.jpg')
        for p in ([] if ui_only else sorted((ROOT/'부록/열람용HTML').glob('*.html'))):
            await page.goto(p.as_uri());await page.evaluate('document.fonts.ready')
            dest=(ROOT/'근거' if p.stem.startswith('08 ') else ROOT)/(p.stem+'.pdf')
            await page.pdf(path=str(dest),print_background=True,prefer_css_page_size=True,display_header_footer=True,header_template='<div></div>',footer_template='<div style="font-size:8px;width:100%;text-align:center;color:#777">At that place · 1차 개발 설계 · <span class="pageNumber"></span> / <span class="totalPages"></span></div>')
        await page.goto((ROOT/'UI/05 UI 화면 갤러리.html').as_uri());await page.evaluate('document.fonts.ready')
        await page.pdf(path=str(ROOT/'UI/05 UI 설계.pdf'),print_background=True,prefer_css_page_size=True)
        await page.goto((ROOT/'00 설계서 안내.html').as_uri());await page.screenshot(path=str(ROOT/'부록/설계서 표지 미리보기.png'),full_page=True)
        await browser.close()
        print(json.dumps({'svg_layout_issues':len(issues),'previews':len(paths)},ensure_ascii=False))
def math_rows(n):return (n+6)//7
if __name__=='__main__':
    import sys
    asyncio.run(render('--diagrams' in sys.argv, '--ui' in sys.argv))
