import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:400]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='clear';G.pick.day='day';G.pick.map='moon';G.pick.mode='drill';previewWorld();newMatch();G.deployDone()")
        await pg.wait_for_timeout(6000)
        print(await pg.evaluate("(()=>{const u=G.sides[0].tank,[x,y]=unitPos(u),I=G.sides[0].home;return JSON.stringify({onHome:islandOf(x,y)===I,d:+Math.hypot(x-I.x,y-I.y).toFixed(1),rim:+I.rimAt(Math.atan2(y-I.y,x-I.x)).toFixed(1),spray:Geo.fx.length,real:[P.water.GetParticleCount(),P.oil.GetParticleCount(),P.lava.GetParticleCount(),P.steam.GetParticleCount()]})})()"))
        v=await pg.evaluate("(()=>{const v=Geo.vents[0];return [v.x,v.y]})()")
        await pg.evaluate(f"V.cx={v[0]};V.cy={v[1]};V.z=6"); await pg.wait_for_timeout(200); await pg.screenshot(path='t/gy.png')
        print('\n'.join(errs[:6])); await b.close()
asyncio.run(main())
