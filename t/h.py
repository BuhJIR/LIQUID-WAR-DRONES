import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3000)
        await pg.evaluate("G.pick.map='valley';G.pick.foe='tank';previewWorld();newMatch()"); await pg.wait_for_timeout(1500)
        print('visible', await pg.is_visible('#bFull'))
        await pg.click('#bFull'); await pg.wait_for_timeout(500)
        print('fs', await pg.evaluate("!!document.fullscreenElement"), await pg.evaluate("document.querySelector('#bFull').getAttribute('aria-label')"))
        await pg.screenshot(path='t/fs.png', clip={'x':0,'y':0,'width':390,'height':60})
        await pg.click('#bFull'); await pg.wait_for_timeout(500)
        print('fs', await pg.evaluate("!!document.fullscreenElement"))
        print(errs); await b.close()
asyncio.run(main())
