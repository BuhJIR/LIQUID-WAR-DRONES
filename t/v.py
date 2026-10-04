import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='clear';G.pick.day='day';G.pick.map='pair';G.pick.mode='drill';previewWorld();newMatch()")
        await pg.wait_for_timeout(800); await pg.evaluate("G.deployDone()"); await pg.wait_for_timeout(1200)
        # aim with the AI solver at the enemy, fire HE, trace
        for wid in ['he','rocket']:
            r=await pg.evaluate(f"""(()=>{{G.phase='play';G.cur=0;const S=G.sides[0];S.fired=false;S.ammo.rocket=9;const u=S.tank,e=G.sides[1].tank,[ex,ey]=unitPos(e),w=WEAPONS.get('{wid}');const t=performance.now();const s=solveShot(u,w,ex,ey,G.wind);const ms=performance.now()-t;u.aim=s.ang-u.body.GetAngle();u.aimT=null;u.power=s.pow;window.EXP=window.EXP||[];if(!window._ex){{window._ex=1;const oe=explode;explode=function(x,y,w,o){{EXP.push([+x.toFixed(0),+y.toFixed(0)]);return oe.apply(this,arguments)}}}};EXP.length=0;G.doFire(0,'{wid}');return JSON.stringify({{solveMs:Math.round(ms),miss:+s.miss.toFixed(1),ang:+(s.ang*57.3).toFixed(0),pow:+s.pow.toFixed(2),enemy:[ex,ey].map(Math.round)}})}})()""")
            print(wid, r)
            for i in range(14):
                await pg.wait_for_timeout(500)
                st=await pg.evaluate("JSON.stringify({shots:G.shots.filter(s=>s.body).map(s=>s.body.GetPosition()).map(p=>[Math.round(p.x),Math.round(p.y)]),exp:EXP,ph:G.phase,hp:G.sides[1].tank.hp|0})")
                if i%2==0: print(' ',st)
                if i==3: await pg.screenshot(path=f't/v_{wid}.png')
                if '"ph":"review"' in st: break
            await pg.evaluate("if(G.phase==='review')G.pass()"); await pg.wait_for_timeout(1500)
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
