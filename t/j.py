import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:300]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3000)
        await pg.evaluate("G.pick.weather='rain';G.pick.map='valley';G.pick.foe='tank';G.pick.mode='hotseat';previewWorld();newMatch()"); await pg.wait_for_timeout(1200)
        g=lambda: pg.evaluate("JSON.stringify([+G.sides[0].tank.aim.toFixed(3),+G.sides[0].tank.power.toFixed(3)])")
        print('start', await g())
        box=await pg.locator('#levA').bounding_box(); cx=box['x']+box['width']/2; cy=box['y']+box['height']/2
        await pg.mouse.move(cx,cy); await pg.mouse.down(); await pg.mouse.move(cx-40,cy,steps=3)
        for i in range(3): await pg.wait_for_timeout(300); print('lever left', await g())
        await pg.screenshot(path='t/l1.png')
        await pg.mouse.up(); await pg.wait_for_timeout(400); print('released', await g(), await pg.evaluate("document.querySelector('#levA .hand').style.transform"))
        box=await pg.locator('#levP').bounding_box(); px=box['x']+box['width']/2; py=box['y']+box['height']/2
        await pg.mouse.move(px,py); await pg.mouse.down(); await pg.mouse.move(px,py-30,steps=3); await pg.wait_for_timeout(600); await pg.mouse.up(); print('power up', await g())
        # drone mode
        await pg.evaluate("UI.weapon='strike';UI.refresh()"); await pg.wait_for_timeout(200)
        a0=await g(); t0=await pg.evaluate("G.sides[0].tank.droneTx")
        box=await pg.locator('#dR').bounding_box()
        await pg.mouse.move(box['x']+20,box['y']+20); await pg.mouse.down(); await pg.wait_for_timeout(1200); await pg.mouse.up()
        t1=await pg.evaluate("G.sides[0].tank.droneTx")
        print('drone circle', round(t0), '->', round(t1), 'aim before/after', a0, await g(), 'beep', await pg.evaluate("Math.round(performance.now()-UI.beepAt)"))
        await pg.evaluate("V.cx=G.sides[0].tank.droneTx;V.z=V.W/160;V.clampCam()"); await pg.wait_for_timeout(100)
        await pg.screenshot(path='t/l2.png')
        # long HE shots in rain
        await pg.evaluate("UI.weapon='he';UI.refresh();G.pick.mode='drill';window.EXP=[];const oe=explode;explode=function(x,y,w,o){EXP.push([+x.toFixed(0),+(y-Terrain.topAt(x)).toFixed(1)]);return oe.apply(this,arguments)};0")
        for ang in [.5,.8,1.0,1.2]:
            await pg.evaluate(f"previewWorld();newMatch();G.speed=3;EXP.length=0;const u=G.sides[0].tank;u.aim={ang};u.power=1;G.doFire(0,'he')")
            await pg.wait_for_timeout(6000)
            print('rain HE', ang, await pg.evaluate("JSON.stringify(EXP)"))
        print('\n'.join(errs[:6])); await b.close()
asyncio.run(main())
