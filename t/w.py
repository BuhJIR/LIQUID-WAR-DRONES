import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='clear';G.pick.map='pair';G.pick.mode='drill';previewWorld();newMatch()")
        await pg.wait_for_timeout(800); await pg.evaluate("G.deployDone()"); await pg.wait_for_timeout(1500)
        for wid in ['he','rocket']:
            r=await pg.evaluate(f"""(()=>{{G.phase='play';G.cur=0;const S=G.sides[0];S.fired=false;S.ammo.rocket=9;const u=S.tank,e=G.sides[1].tank,[ex,ey]=unitPos(e),w=WEAPONS.get('{wid}');const s=solveShot(u,w,ex,ey,G.wind);u.aim=s.ang-u.body.GetAngle();u.aimT=null;u.power=s.pow;
              const [mx,my]=u.def.muzzle(u); window.PRED=simulate(mx,my,s.ang,w.cat==='rocket'?w.speed*(1+upLevel('barrel')*.05):muzzleSpeed(u,w)*s.pow,w.drag,G.wind,24,w.cat==='rocket'?{{burn:lerp(w.burnMin,w.burnMax,s.pow),thrust:w.thrust}}:null,1/60);
              window.EXP=[];if(!window._ex){{window._ex=1;const oe=explode;explode=function(x,y,w,o){{EXP.push([+x.toFixed(1),+y.toFixed(1),+Clock.t.toFixed(2)]);return oe.apply(this,arguments)}}}};window.T0=Clock.t;G.doFire(0,'{wid}');
              return JSON.stringify({{miss:+s.miss.toFixed(1),pow:+s.pow.toFixed(2),predEnd:[+PRED.x.toFixed(1),+PRED.y.toFixed(1),+PRED.t.toFixed(2)],enemy:[ex,ey].map(v=>+v.toFixed(1)),wind:G.wind}})}})()""")
            print(wid, r)
            for i in range(70):
                await pg.wait_for_timeout(400)
                if await pg.evaluate("EXP.length>0"): break
            print('  actual', await pg.evaluate("JSON.stringify(EXP.map(e=>[e[0],e[1],+(e[2]-T0).toFixed(2)]))"), 'hp', await pg.evaluate("G.sides[1].tank.hp|0"))
            await pg.evaluate("G.phase='review';G.pass()"); await pg.wait_for_timeout(2500)
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
