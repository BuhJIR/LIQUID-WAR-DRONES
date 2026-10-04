import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:300]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3000)
        out=[]
        for i in range(8):
            r=await pg.evaluate("G.pick.weather='clear';G.pick.map='island';G.pick.foe='tank';G.pick.mode='hotseat';previewWorld();newMatch();JSON.stringify(G.sides.map(s=>{const [x,y]=unitPos(s.tank);return [Math.round(x),Water.wet(x,y+1)]}))")
            out.append(r)
        print('island', out)
        await pg.wait_for_timeout(1500)
        await pg.evaluate("V.z=V.minZ();V.cx=WORLD_W/2;V.cy=WORLD_H*.35"); await pg.wait_for_timeout(200); await pg.screenshot(path='t/p1.png')
        await pg.evaluate("G.pick.mode='duel';G.pick.ai='assault';G.pick.map='valley';previewWorld();newMatch();G.speed=3")
        for i in range(12):
            await pg.wait_for_timeout(1800)
            st=await pg.evaluate("(()=>{if(G.cur===0&&G.phase==='play')G.endTurn(); if(G.phase==='review')G.pass(); return JSON.stringify({t:G.turn,ph:G.phase,hp:G.sides.map(s=>Math.round(s.tank.hp)),wind:+G.wind.toFixed(2)})})()")
            if i%3==0 or '"over"' in st: print(st)
            if '"over"' in st: break
        print('\n'.join(errs[:6])); await b.close()
asyncio.run(main())
