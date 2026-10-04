import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='clear';G.pick.day='day';G.pick.map='pair';G.pick.mode='drill';previewWorld();newMatch()")
        await pg.wait_for_timeout(800)
        await pg.evaluate("G.deployDone()"); await pg.wait_for_timeout(1500)
        print(await pg.evaluate("JSON.stringify({ph:G.phase,cur:G.cur})"))
        # drive around: hold drive right for 8 s, sample positions & angles relative to island centre
        await pg.evaluate("G.speed=2;G.sides[0].fuel=1e9;G.sides[0].tank.drive=1")
        for i in range(8):
            await pg.wait_for_timeout(1000)
            print(await pg.evaluate("(()=>{const u=G.sides[0].tank,[x,y]=unitPos(u),I=G.sides[0].home;return JSON.stringify({pa:+(Math.atan2(y-I.y,x-I.x)*57.3).toFixed(0),r:+Math.hypot(x-I.x,y-I.y).toFixed(1),hull:+(u.body.GetAngle()*57.3).toFixed(0),rot:+(V.rot*57.3).toFixed(0)})})()"))
            if i==5: await pg.screenshot(path='t/u1.png')
        await pg.evaluate("G.sides[0].tank.drive=0")
        await pg.evaluate("V.z=V.minZ()*1.3;V.cx=WORLD_W/2;V.cy=WORLD_H/2"); await pg.wait_for_timeout(300); await pg.screenshot(path='t/u2.png')
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
