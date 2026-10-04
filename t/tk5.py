import asyncio
from playwright.async_api import async_playwright
Q="""(()=>{const u=G.sides[0].tank,h=u.body.GetPosition(),a=u.body.GetAngle();let mx=0;for(const j of u.veh.joints){if(j.t!=='r')continue;const A=j.j.GetAnchorA(),B2=j.j.GetAnchorB();mx=Math.max(mx,Math.hypot(A.x-B2.x,A.y-B2.y))}const L=u.veh.byRole.link.map(p=>{const q=p.b.GetPosition(),dx=q.x-h.x,dy=q.y-h.y;return [+(dx*Math.cos(-a)-dy*Math.sin(-a)).toFixed(1),+(dx*Math.sin(-a)+dy*Math.cos(-a)).toFixed(1)]});return JSON.stringify({sep:+mx.toFixed(2),L:L.slice(0,43:=0)})})()"""
Q=Q.replace("L.slice(0,43:=0)","L")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.mode='hotseat';G.pick.map='pair';previewWorld();newMatch();0")
        print(await pg.evaluate(Q))
        await pg.evaluate("G.deployDone();document.getElementById('cover').hidden=true;G.paused=false;G.phase='play'")
        await pg.wait_for_timeout(1500)
        print(await pg.evaluate(Q))
        await b.close()
asyncio.run(main())
