import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+str(e.stack)[:300]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.mode='hotseat';G.pick.map='pair';previewWorld();newMatch();G.deployDone();document.getElementById('cover').hidden=true;G.paused=false;G.phase='play';0")
        print(await pg.evaluate("JSON.stringify({n:P.water.GetParticleCount(),ppm:Terrain.PPM})"))
        # drop the player's tank into the lake of its island
        await pg.evaluate("""(()=>{const I=G.sides[0].home,c=(I.cr||[])[0];if(!c)return;const u=G.sides[0].tank;window.LK=[c.x,c.y];placeUnit(u,c.x,c.y+c.rc*.2,0)})()""")
        t0=await pg.evaluate("performance.now()")
        for k in range(5):
            await pg.wait_for_timeout(1000)
            print(await pg.evaluate("(()=>{const u=G.sides[0].tank,v=u.body.GetLinearVelocity();return JSON.stringify({p:unitPos(u).map(v=>v|0),v:+Math.hypot(v.x,v.y).toFixed(1),bc:P.water.GetBodyContactCount(),fps:G.fps||0})})()"))
        await pg.evaluate("const u=G.sides[0].tank;const [x,y]=unitPos(u);V.cx=x;V.cy=y;V.z=V.W/40")
        await pg.wait_for_timeout(300); await pg.screenshot(path='t/wt.png')
        await pg.evaluate("G.sides[0].tank.drive=1;G.sides[0].fuel=999"); await pg.wait_for_timeout(2500)
        await pg.evaluate("const u=G.sides[0].tank;const [x,y]=unitPos(u);V.cx=x;V.cy=y;V.z=V.W/40")
        await pg.wait_for_timeout(200); await pg.screenshot(path='t/wt2.png')
        print(await pg.evaluate("(()=>{let f=0,t=performance.now();return new Promise(r=>{function s(){f++;if(performance.now()-t<2000)requestAnimationFrame(s);else r(f/2)}requestAnimationFrame(s)})})()"),'fps')
        print('\n'.join(errs[:6])); await b.close()
asyncio.run(main())
