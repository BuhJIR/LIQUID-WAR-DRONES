import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:400]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.weather='clear';G.pick.map='pair';G.pick.mode='drill';previewWorld();newMatch();G.deployDone()")
        await pg.wait_for_timeout(1500)
        for wid in ['rocket','he']:
            print(wid, await pg.evaluate(f"""(()=>{{G.phase='play';G.cur=0;const S=G.sides[0];S.fired=false;S.fireAt=null;S.ammo.rocket=9;const u=S.tank,[ex,ey]=unitPos(G.sides[1].tank),w=WEAPONS.get('{wid}');const s=solveShot(u,w,ex,ey,G.wind);u.aim=s.ang-u.body.GetAngle();u.aimT=null;u.power=s.pow;
              window.EXP=[];if(!window._e){{window._e=1;const oe=explode;explode=function(x,y,w,o,d){{EXP.push([x|0,y|0,+(Clock.t-T0).toFixed(1)]);return oe.apply(this,arguments)}}}};window.T0=Clock.t;window.H0=G.sides[1].tank.hp;G.doFire(0,'{wid}');return JSON.stringify({{miss:+s.miss.toFixed(1),enemy:[ex|0,ey|0]}})}})()"""))
            for i in range(40):
                await pg.wait_for_timeout(500)
                if await pg.evaluate("EXP.length>0"): break
            print('  impact', await pg.evaluate("JSON.stringify(EXP)"), 'dmg', await pg.evaluate("(H0-G.sides[1].tank.hp)|0"), 'phase', await pg.evaluate("G.phase"))
            await pg.wait_for_timeout(11000); await pg.evaluate("if(G.phase==='review')G.pass()"); await pg.wait_for_timeout(1500)
        print('\n'.join(errs[:6])); await b.close()
asyncio.run(main())
