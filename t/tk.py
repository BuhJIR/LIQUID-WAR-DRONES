import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+str(e.stack)[:400]))
        pg.on('console',lambda m: errs.append('CON '+m.text[:200]) if m.type=='error' else None)
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.screenshot(path='t/tk0.png')
        await pg.evaluate("G.pick.mode='hotseat';G.pick.map='pair';previewWorld();newMatch();G.deployDone();document.getElementById('cover').hidden=true;G.paused=false;0")
        await pg.wait_for_timeout(2500)
        st="JSON.stringify(G.sides.map(s=>{const u=s.tank;return {p:unitPos(u).map(v=>+v.toFixed(1)),a:+u.body.GetAngle().toFixed(2),aimRel:+(aimW(u)-u.body.GetAngle()).toFixed(2),hp:u.hp|0,alive:u.alive,m:+u.mass.toFixed(1)}}))"
        print(await pg.evaluate(st))
        await pg.evaluate("const u=G.sides[0].tank;const [x,y]=unitPos(u);V.cx=x;V.cy=y;V.z=V.W/30")
        await pg.wait_for_timeout(300); await pg.screenshot(path='t/tk1.png')
        await pg.evaluate("G.phase='play';G.cur=0;G.sides[0].tank.drive=1;G.sides[0].fuel=999")
        await pg.wait_for_timeout(3000)
        await pg.evaluate("G.sides[0].tank.drive=0")
        print(await pg.evaluate(st))
        await pg.evaluate("const u=G.sides[0].tank;const [x,y]=unitPos(u);V.cx=x;V.cy=y;V.z=V.W/30")
        await pg.wait_for_timeout(300); await pg.screenshot(path='t/tk2.png')
        print(await pg.evaluate("JSON.stringify(G.sides[0].tank.veh.parts.filter(p=>p.k==='link').slice(0,43).map(p=>{const h=G.sides[0].tank.body.GetPosition(),q=p.b.GetPosition();return [p.k,+(q.x-h.x).toFixed(2),+(q.y-h.y).toFixed(2),+p.b.GetAngle().toFixed(2)]}))"))
        await pg.evaluate("V.z=V.W/14"); await pg.wait_for_timeout(200); await pg.screenshot(path='t/tk3.png')
        print('\n'.join(errs[:8])); await b.close()
asyncio.run(main())
