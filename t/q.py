import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        pg.on('console',lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' else None)
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(4000)
        await pg.screenshot(path='t/r_menu.png')
        print(errs[:5])
        for mp in ['pair','chain','moon']:
            t0=await pg.evaluate(f"(()=>{{const t=performance.now();G.pick.weather='clear';G.pick.day='day';G.pick.map='{mp}';G.pick.mode='hotseat';previewWorld();return performance.now()-t}})()")
            await pg.wait_for_timeout(2500)
            info=await pg.evaluate("JSON.stringify({w:P.water.GetParticleCount(),rocks:Nature.rocks.length,grass:Grass.nodes.length,M:Math.round(Grav.M),K:+Grav.K.toFixed(3)})")
            print(mp,'build ms',round(t0),info)
            await pg.screenshot(path=f't/r_{mp}.png')
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
