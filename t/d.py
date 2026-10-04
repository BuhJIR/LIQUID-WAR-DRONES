import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3000)
        await pg.evaluate("G.pick.weather='clear';G.pick.day='day';G.pick.map='valley';G.pick.foe='sub';previewWorld();newMatch()"); await pg.wait_for_timeout(1500)
        await pg.evaluate("""(()=>{const s=G.sides[1].tank,[x,y]=unitPos(s);window.SX=x;window.SUR=waterSurfaceAbove(x,y+SB.hy+.7);for(let i=0;i<160;i++)spawnParticle(P.fire,x+rnd(-12,12),SUR+rnd(1,4),0,0,0,rnd(25,30));window.H0=s.hp;})()""")
        for t in range(6):
            await pg.wait_for_timeout(1000)
            print(await pg.evaluate("(()=>{const s=G.sides[1].tank,[ux,uy]=unitPos(s);const {n,pos}=particleArrays(P.fire);let near=0,xs=[];for(let i=0;i<n;i++){const x=pos[i*2],y=pos[i*2+1];if(Math.abs(ux-x)<SB.hx+1&&y>uy&&y-uy<SB.hy+3.2*SC)near++; if(Math.abs(ux-x)<SB.hx+1) xs.push(+(y-uy).toFixed(1));}return JSON.stringify({near,dh:+(H0-s.hp).toFixed(1),top:+(SUR-uy).toFixed(1),ys:xs.slice(0,8)})})()"))
        print(errs); await b.close()
asyncio.run(main())
