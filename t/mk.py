import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.mode='duel';G.pick.ai='assault';G.pick.map='pair';previewWorld();newMatch();G.deployDone();0")
        print(await pg.evaluate("(()=>{const u=G.sides[1].tank,w=WEAPONS.get('flamer'),[,,px,py]=u.def.muzzle(u),[ux,uy]=Grav.up(px,py),a=Math.atan2(uy,ux);return JSON.stringify({up:hitGrade(u,w,{ang:a,pow:1,score:0},0,0,G.aiProfile,0,0),side:hitGrade(u,w,{ang:a-1.3,pow:1,score:0},0,0,G.aiProfile,0,0)})})()"))
        await pg.wait_for_timeout(2000); await pg.evaluate("if(G.cur===0)G.endTurn()")
        for i in range(60):
            await pg.wait_for_timeout(500)
            if await pg.evaluate("(()=>{if(G.phase==='review')G.pass();return !!G.aiMark})()"): break
        await pg.evaluate("document.getElementById('cover').style.display='none';const m=G.aiMark;if(m){V.cx=m.x;V.cy=m.y}")
        await pg.wait_for_timeout(400); await pg.screenshot(path='t/mk.png'); print(await pg.evaluate('JSON.stringify(G.aiMark)'))
        print('\n'.join(errs[:6])); await b.close()
asyncio.run(main())
