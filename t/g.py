import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:300]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3000)
        await pg.evaluate("G.pick.weather='clear';G.pick.map='valley';G.pick.foe='sub';G.pick.mode='hotseat';previewWorld();newMatch()"); await pg.wait_for_timeout(1000)
        # hand over to sub
        await pg.evaluate("G.endTurn()"); await pg.wait_for_function("G.phase==='review'",timeout=10000); await pg.click('#bFire',force=True); await pg.click('#coverGo')
        y0=await pg.evaluate("unitPos(G.sides[1].tank)[1]")
        box=await pg.locator('#stickL').bounding_box(); lx=box['x']+box['width']/2; ly=box['y']+box['height']/2
        await pg.mouse.move(lx,ly); await pg.mouse.down(); await pg.mouse.move(lx+10,ly+55,steps=3); await pg.wait_for_timeout(2500)
        print('dove', round(await pg.evaluate("unitPos(G.sides[1].tank)[1]")-y0,2), await pg.evaluate("JSON.stringify({dep:G.sides[1].tank.depth.toFixed(1),fuel:G.sides[1].fuel.toFixed(1),hp:G.sides[1].tank.hp})"))
        await pg.screenshot(path='t/s1.png')
        await pg.mouse.up()
        # duel vs AI, player passes
        await pg.evaluate("G.pick.foe='tank';G.pick.mode='duel';G.pick.ai='assault';previewWorld();newMatch();G.speed=3")
        for i in range(10):
            await pg.wait_for_timeout(1800)
            st=await pg.evaluate("(()=>{if(G.cur===0&&G.phase==='play')G.endTurn(); if(G.phase==='review')G.pass(); return JSON.stringify({t:G.turn,ph:G.phase,cur:G.cur,hp:G.sides.map(s=>Math.round(s.tank.hp))})})()")
            print(st)
            if '"over"' in st: break
        await pg.screenshot(path='t/s2.png')
        print('\n'.join(errs[:8])); await b.close()
asyncio.run(main())
