import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.mode='duel';G.pick.ai='assault';G.pick.map='moon';previewWorld();newMatch();G.deployDone();G.speed=3;window.DL=[];const du=damageUnit;damageUnit=function(u,d,src,sil){if(u.def&&u.def.main&&u.side===1)DL.push([G.turn,G.cur,src,+d.toFixed(1)]);return du.apply(this,arguments)};const df=G.doFire;G.doFire=function(s,w,o){DL.push(['fire',s,w]);return df.apply(this,arguments)};0")
        for i in range(14):
            await pg.wait_for_timeout(2500)
            st=await pg.evaluate("(()=>{if(G.cur===0&&G.phase==='play')G.endTurn(); if(G.phase==='review')G.pass(); return JSON.stringify({t:G.turn,ph:G.phase,hp:G.sides.map(s=>Math.round(s.tank.hp))})})()")
            if i%3==0 or '"over"' in st: print(st)
            if '"over"' in st: break
        print(await pg.evaluate("(()=>{const a={};for(const e of DL){const k=e.slice(0,3).join(':');a[k]=(a[k]||0)+(typeof e[3]==='number'?e[3]:1)}return JSON.stringify(a)})()"))
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
