import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.mode='duel';G.pick.map='pair';previewWorld();newMatch();G.deployDone();0")
        await pg.evaluate("G.phase='play';G.cur=1;G.sides[1].ctrl='human';const u=G.sides[1].tank,[,,px,py]=u.def.muzzle(u),[ux,uy]=Grav.up(px,py);u.aim=Math.atan2(uy,ux)-u.body.GetAngle()+0.5;u.power=1;window.PX=[px,py];G.doFire(1,'flamer')")
        for k in range(8):
            await pg.wait_for_timeout(1000)
            print(await pg.evaluate("(()=>{const {n,pos,vel}=particleArrays(P.fire);let mx=0,near=0,sv=0;for(let i=0;i<n;i++){const d=Math.hypot(pos[i*2]-PX[0],pos[i*2+1]-PX[1]);mx=Math.max(mx,d);if(d<9)near++;sv+=Math.hypot(vel[i*2],vel[i*2+1])}const u=G.sides[1].tank,[mx2,my2]=u.def.muzzle(u),[cx,cy]=unitPos(u),o=[];for(let i=0;i<n&&o.length<12;i++){const d=Math.hypot(pos[i*2]-cx,pos[i*2+1]-cy);if(d<3.4)o.push([+(pos[i*2]-cx).toFixed(1),+(pos[i*2+1]-cy).toFixed(1),+Math.hypot(vel[i*2],vel[i*2+1]).toFixed(1)])}return JSON.stringify({hp:u.hp|0,muz:[+(mx2-cx).toFixed(1),+(my2-cy).toFixed(1)],o})})()"))
        await b.close()
asyncio.run(main())
