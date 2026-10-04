import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3000)
        await pg.evaluate("G.pick.weather='clear';G.pick.day='dusk';G.pick.map='valley';G.pick.foe='sub';previewWorld();newMatch()"); await pg.wait_for_timeout(1500)
        await pg.evaluate("const u=G.sides[0].tank;u.aim=.35;u.power=1;window.X0=u.def.muzzle(u)[0];UI.weapon='flamer';G.doFire(0,'flamer')")
        mx=0
        for i in range(8):
            await pg.wait_for_timeout(400)
            m=await pg.evaluate("(()=>{const {n,pos}=particleArrays(P.fire);let m=0;for(let i=0;i<n;i++)m=Math.max(m,pos[i*2]-X0);return m})()"); mx=max(mx,m)
        print('flamer reach m', round(mx,1))
        await pg.evaluate("const [x,y]=unitPos(G.sides[0].tank);V.cx=x+30;V.cy=y-5;V.z=4")
        await pg.screenshot(path='t/f1.png')
        # oil on the lake right above the sub
        await pg.evaluate("""(()=>{G.phase='play';G.frozen=false;const s=G.sides[1].tank,[x,y]=unitPos(s);window.SX=x;window.SUR=waterSurfaceAbove(x,y+SB.hy+.7);for(let i=0;i<160;i++)spawnParticle(P.fire,x+rnd(-9,9),SUR+rnd(2,6),rnd(-2,2),0,0,rnd(20,30));window.H0=s.hp;})()""")
        for t in [1500,3000,3000]:
            await pg.wait_for_timeout(t)
            print(await pg.evaluate("(()=>{const {n,pos}=particleArrays(P.fire);let on=0,under=0,dry=0;for(let i=0;i<n;i++){const x=pos[i*2],y=pos[i*2+1];if(Math.abs(x-SX)>40)continue;if(Water.wet(x,y))under++;else if(Water.wet(x,y-.45))on++;else dry++;}const s=G.sides[1].tank;return JSON.stringify({on,under,dry,subHp:+(H0-s.hp).toFixed(1),depth:+(SUR-unitPos(s)[1]).toFixed(1)})})()"))
        await pg.evaluate("V.cx=SX;V.cy=SUR;V.z=6")
        await pg.wait_for_timeout(100); await pg.screenshot(path='t/f2.png')
        print(errs); await b.close()
asyncio.run(main())
