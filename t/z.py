import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='haze';G.pick.day='dusk';G.pick.map='moon';G.pick.mode='drill';previewWorld();newMatch();G.deployDone()")
        await pg.wait_for_timeout(1200)
        for wid,aim,pw in [('flamer',.5,1),('rocket',.9,.7),('laser',.3,1)]:
            await pg.evaluate(f"G.phase='play';G.cur=0;const S=G.sides[0];S.fired=false;UI.weapon='{wid}';UI.refresh();const u=S.tank;u.aim={aim};u.power={pw}")
            await pg.click('#bFire', force=True)
            await pg.wait_for_timeout(1300); await pg.screenshot(path=f't/z_{wid}.png')
            await pg.wait_for_timeout(2500)
        ms=await pg.evaluate("(()=>{const t0=performance.now();for(let i=0;i<120;i++)physicsStep(STEP);return (performance.now()-t0)/120})()")
        rms=await pg.evaluate("(()=>{const t0=performance.now();for(let i=0;i<30;i++)render();return (performance.now()-t0)/30})()")
        print('ms/step',round(ms,2),'ms/render',round(rms,2), await pg.evaluate("JSON.stringify({w:P.water.GetParticleCount(),f:P.fire.GetParticleCount(),d:P.dirt.GetParticleCount(),s:P.smoke.GetParticleCount(),c:P.cloud.GetParticleCount()})"))
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
