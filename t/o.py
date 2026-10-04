import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:300]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3000)
        # spawn distribution
        xs={0:[],1:[]}
        for i in range(14):
            mp=['valley','ridge','island'][i%3]
            r=await pg.evaluate(f"G.pick.weather='clear';G.pick.map='{mp}';G.pick.foe='tank';G.pick.mode='hotseat';previewWorld();newMatch();JSON.stringify(G.sides.map(s=>Math.round(unitPos(s.tank)[0])))")
            a=json.loads(r); xs[0].append((mp[0],a[0])); xs[1].append((mp[0],320-a[1]))
        print('dist from own tip  side0:',xs[0]); print('                   side1:',xs[1])
        await pg.evaluate("G.pick.map='valley';previewWorld();newMatch()"); await pg.wait_for_timeout(1200)
        # levers deflected screenshot
        box=await pg.locator('#levA').bounding_box(); cx=box['x']+box['width']/2; cy=box['y']+box['height']/2
        await pg.mouse.move(cx,cy); await pg.mouse.down(); await pg.mouse.move(cx+30,cy,steps=3); await pg.wait_for_timeout(200)
        await pg.screenshot(path='t/o1.png', clip={'x':0,'y':600,'width':390,'height':244})
        await pg.mouse.up(); await pg.wait_for_timeout(600)
        await pg.screenshot(path='t/o2.png', clip={'x':0,'y':600,'width':390,'height':244})
        # slow motion: fire HE, then measure clock rate in review
        await pg.evaluate("const u=G.sides[0].tank;u.aim=.9;u.power=.5;G.doFire(0,'he')")
        await pg.wait_for_function("G.phase==='review'",timeout=20000); await pg.wait_for_timeout(1500)
        c0=await pg.evaluate("Clock.t"); await pg.wait_for_timeout(1000); c1=await pg.evaluate("Clock.t")
        print('review: game seconds per real second', round(c1-c0,3), 'ts', await pg.evaluate("G.ts.toFixed(3)"))
        await pg.click('#bFire',force=True); await pg.wait_for_timeout(300); await pg.click('#coverGo'); await pg.wait_for_timeout(1500)
        c0=await pg.evaluate("Clock.t"); await pg.wait_for_timeout(1000); c1=await pg.evaluate("Clock.t")
        print('after pass: game s per real s', round(c1-c0,3))
        # flip a tank on its roof, see it right itself
        await pg.evaluate("const u=G.sides[1].tank,[x,y]=unitPos(u);P.V1.Set(x,y+4);u.body.SetTransform(P.V1,Math.PI);u.wheels.forEach((w,i)=>{P.V1.Set(x+TK.wx[i],y+4-TK.wy);w.SetTransform(P.V1,0)})")
        for i in range(6):
            await pg.wait_for_timeout(1000)
            print('flip angle', await pg.evaluate("(()=>{const a=G.sides[1].tank.body.GetAngle();return Math.atan2(Math.sin(a),Math.cos(a)).toFixed(2)})()"))
        print('\n'.join(errs[:6])); await b.close()
asyncio.run(main())
