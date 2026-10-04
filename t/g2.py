import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='clear';G.pick.day='night';G.pick.map='moon';G.pick.mode='hotseat';previewWorld();newMatch()")
        await pg.wait_for_timeout(600)
        # lamp in the void between islands, tank rotated
        await pg.click('#depRow .chip[data-id=lamp]')
        await pg.mouse.click(195,200); print("lamp placed", await pg.evaluate("!!G.sides[0].lamp"))
        await pg.evaluate("G.deployDone()"); await pg.wait_for_timeout(300); await pg.evaluate("document.querySelector('#coverGo').click();G.deployDone();document.querySelector('#coverGo').click()")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("const u=G.sides[0].tank;u.aim=1.0;u.power=.35;UI.weapon='lantern';G.doFire(0,'lantern')")
        await pg.wait_for_timeout(9000)
        print(await pg.evaluate("JSON.stringify({ph:G.phase,lamps:Lamps.list.map(l=>[l.side,l.x|0,l.y|0,!!l.follow,l.lit.size]),vents:Geo.vents.map(v=>v.type),oil:P.oil.GetParticleCount(),lava:P.lava.GetParticleCount(),steam:P.steam.GetParticleCount()})"))
        await pg.evaluate("V.z=V.minZ()*1.25;V.cx=WORLD_W/2;V.cy=WORLD_H*.55"); await pg.wait_for_timeout(300); await pg.screenshot(path='t/g2.png')
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
