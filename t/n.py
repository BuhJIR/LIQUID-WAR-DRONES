import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:300]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.screenshot(path='t/b_menu.png')
        await pg.evaluate("G.pick.weather='haze';G.pick.day='dusk';G.pick.map='ridge';G.pick.foe='tank';G.pick.mode='hotseat';previewWorld();newMatch()"); await pg.wait_for_timeout(1500)
        await pg.evaluate("V.z=5;V.cx=20;V.cy=LIFT+2"); await pg.wait_for_timeout(200); await pg.screenshot(path='t/b_edge.png')
        await pg.evaluate("const [x,y]=unitPos(G.sides[0].tank);V.z=7;V.cx=x+10;V.cy=y+6"); await pg.wait_for_timeout(200); await pg.screenshot(path='t/b_tank.png')
        await pg.evaluate("G.pick.mode='duel';G.pick.ai='assault';G.pick.weather='clear';G.pick.day='day';G.pick.map='valley';previewWorld();newMatch();G.speed=3")
        for i in range(10):
            await pg.wait_for_timeout(1800)
            st=await pg.evaluate("(()=>{if(G.cur===0&&G.phase==='play')G.endTurn(); if(G.phase==='review')G.pass(); return JSON.stringify({t:G.turn,ph:G.phase,hp:G.sides.map(s=>Math.round(s.tank.hp))})})()")
            if i%3==0: print(st)
            if '"over"' in st: print(st); break
        print('\n'.join(errs[:6])); await b.close()
asyncio.run(main())
