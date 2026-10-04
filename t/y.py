import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='clear';G.pick.day='day';G.pick.map='moon';G.pick.mode='hotseat';previewWorld()")
        await pg.wait_for_timeout(500); await pg.click('#bStart')
        q="(()=>{const u=G.sides[0].tank,[x,y]=unitPos(u),[ux,uy]=Grav.up(x,y),v=u.body.GetLinearVelocity(),I=G.sides[0].home;return JSON.stringify({ph:G.phase,paused:G.paused,pos:[+x.toFixed(1),+y.toFixed(1)],up:[+ux.toFixed(2),+uy.toFixed(2)],v:[+v.x.toFixed(1),+v.y.toFixed(1)],rot:+V.rot.toFixed(2),rotT:+V.rotT.toFixed(2),dCentre:+Math.hypot(x-I.x,y-I.y).toFixed(1),rim:+I.rimAt(Math.atan2(y-I.y,x-I.x)).toFixed(1)})})()"
        for i in range(5):
            await pg.wait_for_timeout(500); print(await pg.evaluate(q))
        await pg.click('#depGo'); await pg.wait_for_timeout(400); await pg.click('#coverGo')
        for i in range(3):
            await pg.wait_for_timeout(500); print('p2 deploy', await pg.evaluate(q))
        await pg.click('#depGo'); await pg.wait_for_timeout(400); await pg.click('#coverGo')
        for i in range(4):
            await pg.wait_for_timeout(500); print('play', await pg.evaluate(q))
        await pg.evaluate("(()=>{const [x,y]=unitPos(G.sides[0].tank);V.cx=x;V.cy=y;V.z=8})()"); await pg.wait_for_timeout(300); await pg.screenshot(path='t/y1.png')
        await pg.evaluate("(()=>{const [x,y]=unitPos(G.sides[0].tank);V.cx=x;V.cy=y;V.z=3})()"); await pg.wait_for_timeout(300); await pg.screenshot(path='t/y2.png')
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
