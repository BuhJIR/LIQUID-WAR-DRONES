import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:300]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.screenshot(path='t/a_menu.png')
        for mp in ['valley','ridge','island']:
            await pg.evaluate(f"G.pick.weather='clear';G.pick.day='day';G.pick.map='{mp}';G.pick.foe='sub';G.pick.mode='hotseat';previewWorld();newMatch()")
            w0=await pg.evaluate("P.water.GetParticleCount()")
            await pg.wait_for_timeout(6000)
            print(mp,'water',w0,'->',await pg.evaluate("P.water.GetParticleCount()"),'sub wet',await pg.evaluate("subWet(G.sides[1].tank)"), 'units', await pg.evaluate("JSON.stringify(G.units.filter(u=>u.alive).map(u=>[u.type,unitPos(u).map(Math.round)]))"))
            await pg.evaluate("V.z=V.minZ();V.cx=WORLD_W/2;V.cy=WORLD_H*.35"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=f't/a_{mp}.png')
        # barrel in hull frame: tilt the tank, compare muzzle direction
        print(await pg.evaluate("(()=>{const u=G.sides[0].tank;u.aim=0.5;const a=u.body.GetAngle(),[mx,my,px,py]=u.def.muzzle(u);return JSON.stringify({hull:a.toFixed(3),world:Math.atan2(my-py,mx-px).toFixed(3),expect:(0.5+a).toFixed(3)})})()"))
        print('\n'.join(errs[:6])); await b.close()
asyncio.run(main())
