import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:400]))
        pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.screenshot(path='t/m.png')
        print(await pg.evaluate("JSON.stringify({mode:G.pick.mode, rocks:Nature.rocks.length})"))
        await pg.evaluate("G.pick.weather='clear';G.pick.day='day';G.pick.map='valley';G.pick.foe='sub';previewWorld();newMatch()"); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='t/g0.png')
        # aim stick drag: up-right
        box=await pg.locator('#stickR').bounding_box(); cx=box['x']+box['width']/2; cy=box['y']+box['height']/2
        await pg.mouse.move(cx,cy); await pg.mouse.down(); await pg.mouse.move(cx+40,cy-40,steps=5)
        print('aim', await pg.evaluate("JSON.stringify([G.sides[0].tank.aim.toFixed(2),G.sides[0].tank.power.toFixed(2)])"))
        await pg.mouse.up()
        # drive stick
        box=await pg.locator('#stickL').bounding_box(); lx=box['x']+box['width']/2; ly=box['y']+box['height']/2
        x0=await pg.evaluate("unitPos(G.sides[0].tank)[0]")
        await pg.mouse.move(lx,ly); await pg.mouse.down(); await pg.mouse.move(lx+50,ly,steps=3); await pg.wait_for_timeout(1500); await pg.mouse.up()
        print('drove', round(await pg.evaluate("unitPos(G.sides[0].tank)[0]")-x0,2), 'fuel', await pg.evaluate("G.sides[0].fuel.toFixed(1)"))
        # select strike, tap target on sub
        await pg.evaluate("UI.weapon='strike';UI.refresh()")
        sx,sy=await pg.evaluate("(()=>{const [x,y]=unitPos(G.sides[1].tank);V.cx=(unitPos(G.sides[0].tank)[0]+x)/2;V.z=V.W/260;V.clampCam();return [V.sx(x),V.sy(y)]})()")
        await pg.wait_for_timeout(200)
        await pg.mouse.click(min(max(sx,20),370), 400)
        print('droneTx', await pg.evaluate("JSON.stringify([G.sides[0].tank.droneTx, unitPos(G.sides[1].tank)[0]])"))
        await pg.screenshot(path='t/g1.png')
        await pg.click('#bFire'); await pg.wait_for_function("G.phase==='review'", timeout=15000); await pg.wait_for_timeout(300)
        print('after launch', await pg.evaluate("JSON.stringify({ph:G.phase,frozen:G.frozen,body:document.body.className})"))
        await pg.screenshot(path='t/g2.png')
        await pg.click('#bFire', force=True)
        await pg.wait_for_timeout(500)
        print('after pass', await pg.evaluate("JSON.stringify({ph:G.phase,cur:G.cur,cover:!document.querySelector('#cover').hidden})"))
        await pg.screenshot(path='t/g3.png')
        await pg.click('#coverGo'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='t/g4.png')
        for i in range(8):
            await pg.wait_for_timeout(1000)
            st=await pg.evaluate("JSON.stringify({hp:G.sides.map(s=>Math.round(s.tank.hp)),d:G.units.filter(u=>u.alive&&u.type=='strike').map(u=>[u.phase,!!u.lock,Math.round(unitPos(u)[0]),Math.round(u.tx)])})")
            print(st)
            if i==2: await pg.screenshot(path='t/g5.png')
        print('\n'.join(errs[:10]))
        await b.close()
asyncio.run(main())
