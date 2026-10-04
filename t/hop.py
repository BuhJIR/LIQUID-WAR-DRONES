import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='haze';G.pick.day='day';G.pick.map='pair';G.pick.mode='drill';previewWorld();newMatch();G.deployDone()")
        await pg.wait_for_timeout(2500)
        print('wind', await pg.evaluate("G.wind.toFixed(1)"), 'gas', await pg.evaluate("P.cloud.GetParticleCount()"))
        await pg.screenshot(path='t/h0.png')
        # hop toward the middle rock
        await pg.evaluate("""(()=>{const u=G.sides[0].tank,[x,y]=unitPos(u),I=G.map.islands[2];u.aim=Math.atan2(I.y+I.r-y,I.x-x)+.5-u.body.GetAngle();u.aimT=null;u.power=.7;})()""")
        await pg.click('#chipRow .chip[data-id=hop]')
        for i in range(8):
            await pg.wait_for_timeout(700)
            print(await pg.evaluate("(()=>{const [x,y]=unitPos(G.sides[0].tank);const I=islandOf(x,y);return JSON.stringify({p:[x|0,y|0],isl:I?G.map.islands.indexOf(I):-1,hop:G.sides[0].recon.hop})})()"))
            if i==2: await pg.screenshot(path='t/h1.png')
        await pg.screenshot(path='t/h2.png')
        await pg.evaluate("G.pick.mode='duel';G.pick.ai='assault';G.pick.map='chain';previewWorld();newMatch();G.deployDone();G.speed=3")
        for i in range(10):
            await pg.wait_for_timeout(2500)
            st=await pg.evaluate("(()=>{if(G.cur===0&&G.phase==='play')G.endTurn(); if(G.phase==='review')G.pass(); return JSON.stringify({t:G.turn,ph:G.phase,hp:G.sides.map(s=>Math.round(s.tank.hp))})})()")
            if i%3==0 or '"over"' in st: print(st)
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
