import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3000)
        await pg.evaluate("G.pick.map='valley';G.pick.foe='sub';previewWorld();newMatch()"); await pg.wait_for_timeout(1000)
        await pg.evaluate("UI.weapon='strike';UI.refresh(); window.EV=[]; cv.addEventListener('pointerup',e=>EV.push(['up',e.clientX,e.clientY])); cv.addEventListener('pointerdown',e=>EV.push(['dn']));")
        print(await pg.evaluate("JSON.stringify({w:UI.weapon, my:!!UI.myUnit(), el:document.elementFromPoint(200,400).id})"))
        await pg.mouse.click(200,400); await pg.wait_for_timeout(100)
        print(await pg.evaluate("JSON.stringify({EV, tx:G.sides[0].tank.droneTx, w:UI.weapon})"))
        await pg.touchscreen.tap(250,380); await pg.wait_for_timeout(100)
        print(await pg.evaluate("JSON.stringify({EV, tx:G.sides[0].tank.droneTx})"))
        print(errs); await b.close()
asyncio.run(main())
