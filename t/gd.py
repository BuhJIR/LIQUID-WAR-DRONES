import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='clear';G.pick.map='pair';previewWorld();newMatch();G.deployDone()")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("G.phase='play';G.cur=0;const S=G.sides[0];S.ctrl='human';S.fired=false;UI.weapon='guided';UI.refresh();S.tank.aim=1.2;S.tank.power=.6;G.doFire(0,'guided');document.getElementById('cover').style.display='none'")
        await pg.wait_for_timeout(600)
        print('guiding', await pg.evaluate("document.body.classList.contains('guiding')"))
        await pg.click('#dR'); await pg.wait_for_timeout(200)
        print('vec after tap', await pg.evaluate("UI.guided()&&UI.guided().vec"))
        bx=await pg.locator('#dL').bounding_box()
        await pg.mouse.move(bx['x']+20,bx['y']+20); await pg.mouse.down(); await pg.wait_for_timeout(1000)
        print('vec 1s', await pg.evaluate("UI.guided()&&UI.guided().vec"))
        await pg.wait_for_timeout(1500)
        print('vec 2.5s', await pg.evaluate("UI.guided()&&UI.guided().vec"))
        await pg.screenshot(path='t/gd.png'); await pg.mouse.up()
        print('\n'.join(errs[:6])); await b.close()
asyncio.run(main())
