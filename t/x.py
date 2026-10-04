import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='clear';G.pick.day='day';G.pick.map='moon';G.pick.mode='hotseat';previewWorld()")
        await pg.wait_for_timeout(500); await pg.click('#bStart'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='t/x1.png')
        # place a tower by tapping the island near the tank
        await pg.click('#depRow .chip[data-id=tower]')
        X,Y=await pg.evaluate("(()=>{const [x,y]=unitPos(G.sides[0].tank),[ux,uy]=Grav.up(x,y);return V.proj(x+uy*12+ux*6,y-ux*12+uy*6)})()")
        await pg.mouse.click(X,Y); await pg.wait_for_timeout(300)
        await pg.click('#depRow .chip[data-id=arch]')
        X,Y=await pg.evaluate("(()=>{const [x,y]=unitPos(G.sides[0].tank),[ux,uy]=Grav.up(x,y);return V.proj(x-uy*14+ux*6,y+ux*14+uy*6)})()")
        await pg.mouse.click(X,Y); await pg.wait_for_timeout(1500)
        print('structs', await pg.evaluate("G.sides[0].structs.length"), 'blocks', await pg.evaluate("G.blocks.filter(b=>b.alive).length"))
        await pg.screenshot(path='t/x2.png')
        await pg.click('#depGo'); await pg.wait_for_timeout(400)
        print(await pg.evaluate("JSON.stringify({ph:G.phase,ds:G.deploySide,cover:!document.querySelector('#cover').hidden})"))
        await pg.click('#coverGo'); await pg.wait_for_timeout(800); await pg.click('#depGo'); await pg.wait_for_timeout(400)
        print(await pg.evaluate("JSON.stringify({ph:G.phase,cur:G.cur,turn:G.turn,cover:!document.querySelector('#cover').hidden})"))
        await pg.click('#coverGo'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='t/x3.png')
        # fire HE via button, wait for review, measure slow-mo
        await pg.evaluate("const u=G.sides[0].tank;u.aim=1.0;u.power=.6")
        await pg.click('#bFire'); await pg.wait_for_function("G.phase==='review'", timeout=40000)
        await pg.wait_for_timeout(1500); c0=await pg.evaluate("Clock.t"); await pg.wait_for_timeout(1000); c1=await pg.evaluate("Clock.t")
        print('review game-s per real-s', round(c1-c0,5))
        await pg.screenshot(path='t/x4.png')
        # duel vs AI quick run
        await pg.evaluate("G.pick.mode='duel';G.pick.ai='assault';G.pick.map='chain';previewWorld();newMatch();G.deployDone();G.speed=3")
        for i in range(14):
            await pg.wait_for_timeout(2500)
            st=await pg.evaluate("(()=>{if(G.cur===0&&G.phase==='play')G.endTurn(); if(G.phase==='review')G.pass(); return JSON.stringify({t:G.turn,ph:G.phase,hp:G.sides.map(s=>Math.round(s.tank.hp))})})()")
            if i%3==0 or '"over"' in st: print(st)
            if '"over"' in st: break
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
