import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='clear';G.pick.day='day';G.pick.map='pair';G.pick.mode='hotseat';previewWorld();newMatch()")
        await pg.wait_for_timeout(2000)
        print(await pg.evaluate("JSON.stringify({ph:G.phase,ds:G.deploySide,rot:+V.rot.toFixed(2),tanks:G.sides.map(s=>unitPos(s.tank).map(v=>+v.toFixed(1))),ang:G.sides.map(s=>+s.tank.body.GetAngle().toFixed(2))})"))
        await pg.screenshot(path='t/s1.png')
        # whole map
        await pg.evaluate("V.z=V.minZ()*1.1;V.cx=WORLD_W/2;V.cy=WORLD_H/2")
        await pg.wait_for_timeout(300); await pg.screenshot(path='t/s2.png')
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
