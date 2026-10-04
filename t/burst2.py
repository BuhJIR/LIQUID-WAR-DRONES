import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        for cover in [False]:
          for DIST in [3,5,7]:
            for wid in ['he','photon','rocket']:
                await pg.evaluate("G.pick.weather='clear';G.pick.day='dusk';G.pick.map='pair';G.pick.mode='drill';previewWorld();newMatch();G.deployDone()")
                await pg.wait_for_timeout(800)
                r=await pg.evaluate(f"""(()=>{{window.DIST={DIST}}})();"""); r=await pg.evaluate(f"""(()=>{{const u=G.sides[0].tank,[x,y]=unitPos(u),[ux,uy]=Grav.up(x,y);
                  const g=Grav.dropToGround(x+uy*{DIST}+ux*2,y-ux*{DIST}+uy*2,20);
                  if({str(cover).lower()}){{const w=Grav.dropToGround(x+uy*6+ux*4,y-ux*6+uy*4,20);window.WL=placeStructureAt('shield',w[0],w[1]);placeStructureAt('wall',w[0]-uy*1.2,w[1]+ux*1.2);}}
                  window.H0=u.hp; window.GP=g; return JSON.stringify({{dist:Math.hypot(g[0]-x,g[1]-y).toFixed(1)}})}})()""")
                await pg.wait_for_timeout(800)
                await pg.evaluate(f"explode(GP[0],GP[1],WEAPONS.get('{wid}'),null)")
                await pg.wait_for_timeout(300)
                if not cover and wid=='photon':
                    await pg.evaluate("V.cx=GP[0];V.cy=GP[1];V.z=4"); await pg.wait_for_timeout(50); await pg.screenshot(path='t/b_photon.png')
                if cover and wid=='he':
                    await pg.evaluate("V.cx=GP[0];V.cy=GP[1];V.z=7"); await pg.wait_for_timeout(50); await pg.screenshot(path='t/b_cover.png')
                await pg.wait_for_timeout(1200)
                print('cover' if cover else 'open ', wid, r, 'damage', await pg.evaluate("(H0-G.sides[0].tank.hp).toFixed(1)"))
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
