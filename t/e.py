import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3000)
        for mp,aim in [('island',.35),('island',.0),('valley',.35)]:
            await pg.evaluate(f"G.pick.weather='clear';G.pick.map='{mp}';G.pick.foe='tank';previewWorld();newMatch()"); await pg.wait_for_timeout(1200)
            await pg.evaluate(f"const u=G.sides[0].tank;u.aim={aim};u.power=1;window.X0=u.def.muzzle(u)[0];window.Y0=u.def.muzzle(u)[1];G.doFire(0,'flamer')")
            mx=0;dy=0
            for i in range(10):
                await pg.wait_for_timeout(300)
                r=await pg.evaluate("(()=>{const {n,pos}=particleArrays(P.fire);let m=0,d=0;for(let i=0;i<n;i++){if(pos[i*2]-X0>m){m=pos[i*2]-X0;d=pos[i*2+1]-Y0}}return [m,d]})()")
                if r[0]>mx: mx,dy=r
            print(mp,aim,'reach',round(mx,1),'dy',round(dy,1))
        await b.close()
asyncio.run(main())
