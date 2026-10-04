import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3000)
        for wx in ['clear','rain','fog']:
          res=[]
          for ang in [.5,.8,1.0,1.2]:
            await pg.evaluate(f"G.pick.weather='{wx}';G.pick.map='valley';G.pick.foe='tank';G.pick.mode='drill';previewWorld();newMatch();window.EXP=[];const oe=explode;explode=function(x,y,w,o){{EXP.push([+x.toFixed(0),+y.toFixed(0),+(y-Terrain.topAt(x)).toFixed(1),Water.wet(x,y)]);return oe.apply(this,arguments)}};0")
            await pg.wait_for_timeout(500)
            await pg.evaluate(f"G.speed=3;const u=G.sides[0].tank;u.aim={ang};u.power=1;G.doFire(0,'he')")
            await pg.wait_for_timeout(5000)
            res.append((ang, await pg.evaluate("JSON.stringify(EXP)")))
          print(wx, res)
        await b.close()
asyncio.run(main())
