import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+str(e.stack)[:300]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.mode='hotseat';G.pick.map='pair';previewWorld();newMatch();G.deployDone();window.EX=[];const oe=explode;explode=function(x,y,...a){EX.push([x|0,y|0,+(Clock.t-T0).toFixed(2)]);return oe.call(this,x,y,...a)};window.T0=Clock.t;0")
        await pg.wait_for_timeout(1500)
        print(await pg.evaluate("(()=>{const u=G.sides[0].tank;return JSON.stringify({g:u.barrel.GetFixtureList().GetFilterData().get_groupIndex(),aim:u.aim.toFixed(2),real:(aimW(u)-u.body.GetAngle()).toFixed(2),pos:unitPos(u).map(v=>v|0)})})()"))
        await pg.evaluate("document.getElementById('cover').style.display='none';G.paused=false;G.phase='play';G.cur=0;const u=G.sides[0].tank;u.aim=0.3;")
        for k in range(4):
          await pg.wait_for_timeout(400)
          print(await pg.evaluate("(()=>{const u=G.sides[0].tank,j=u.barrelJ;let c=0;for(let e=u.barrel.GetContactList();e&&B.getPointer(e);e=e.get_next())c++;return JSON.stringify({ja:j.GetJointAngle().toFixed(2),ms:j.GetMotorSpeed().toFixed(2),mt:j.GetMotorTorque(60).toFixed(1),aw:u.barrel.IsAwake(),c,ph:G.phase,m:u.barrel.GetMass().toFixed(2)})})()"))
        print(await pg.evaluate("(()=>{const u=G.sides[0].tank;return JSON.stringify({aim:u.aim,real:(aimW(u)-u.body.GetAngle()).toFixed(2)})})()"))
        await pg.evaluate("window.T0=Clock.t;document.getElementById('cover').style.display='none';G.sides[0].fired=false;G.doFire(0,'he')"); print(await pg.evaluate('G.shots.map(s=>s.kind+":"+s.body.GetPosition().x.toFixed(1)).join()'))
        for k in range(6):
          await pg.wait_for_timeout(500)
          print(await pg.evaluate("JSON.stringify([EX,G.shots.filter(s=>s.body&&!s.dead).map(s=>[s.body.GetPosition().x|0,s.body.GetPosition().y|0])])"))
        await pg.screenshot(path='t/br.png')
        print('\n'.join(errs[:6])); await b.close()
asyncio.run(main())
