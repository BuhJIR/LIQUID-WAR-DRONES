import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='clear';G.pick.day='day';G.pick.map='pair';G.pick.mode='drill';previewWorld();newMatch()")
        await pg.wait_for_timeout(600)
        # tower 14 m to the right of the tank along the ground
        await pg.evaluate("""(()=>{const u=G.sides[0].tank,[x,y]=unitPos(u),[ux,uy]=Grav.up(x,y);const g=Grav.dropToGround(x+uy*14+ux*4,y-ux*14+uy*4,20);window.TW=placeStructureAt('tower',g[0],g[1]);G.deployDone()})()""")
        await pg.wait_for_timeout(1500)
        n0=await pg.evaluate("G.blocks.filter(b=>b.alive).length")
        # aim the laser at the 3rd block of the tower
        await pg.evaluate("""(()=>{G.phase='play';G.cur=0;const S=G.sides[0];S.fired=false;S.ammo.laser=9;const u=S.tank,t=TW[2].body.GetPosition(),[,,px,py]=u.def.muzzle(u);u.aim=Math.atan2(t.y-py,t.x-px)-u.body.GetAngle();u.aimT=null;G.doFire(0,'laser')})()""")
        for i in range(8):
            await pg.wait_for_timeout(250); print('heat', await pg.evaluate("JSON.stringify(G.blocks.filter(b=>b.alive&&b.heat>0).map(b=>+b.heat.toFixed(2)))"), await pg.evaluate("JSON.stringify(G.shots.filter(s=>s.kind==='laser').map(s=>s.beams.map(b=>b.hits.map(h=>h.kind+':'+(+h.I.toFixed(2))))))"))
        await pg.evaluate("(()=>{const t=TW[2].body.GetPosition();V.cx=t.x;V.cy=t.y;V.z=9})()"); await pg.wait_for_timeout(100)
        await pg.screenshot(path='t/cut1.png')
        await pg.wait_for_timeout(2500)
        print('blocks', n0, '->', await pg.evaluate("G.blocks.filter(b=>b.alive).length"), 'polys', await pg.evaluate("G.blocks.filter(b=>b.alive&&b.poly).length"))
        await pg.screenshot(path='t/cut2.png')
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
