import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.mode='hotseat';G.pick.map='pair';previewWorld();newMatch();G.deployDone();document.getElementById('cover').hidden=true;G.paused=false;G.phase='play';0")
        await pg.wait_for_timeout(2000)
        await pg.evaluate("""(()=>{const u=G.sides[0].tank,[x,y]=unitPos(u),[ux,uy]=Grav.up(x,y);for(let i=0;i<60;i++){const s=(Math.random()-.5)*6;spawnParticle(P.water,x+uy*s+ux*3.5,y-ux*s+uy*3.5,0,0,WATER_FLAGS())}window.MV=0;const st=physicsStep;})()""")
        mx=0
        for k in range(30):
            await pg.wait_for_timeout(100)
            v=await pg.evaluate("(()=>{const v=G.sides[0].tank.body.GetLinearVelocity();return Math.hypot(v.x,v.y)})()")
            mx=max(mx,v)
        print('max speed with 60 drops under', round(mx,2))
        await b.close()
asyncio.run(main())
