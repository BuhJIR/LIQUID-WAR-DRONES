import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+str(e.stack)[:400]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        print(await pg.evaluate("""(()=>{const jd=new B.b2DistanceJointDef();const ks=[];for(const k in jd)if(/stiff|damp|Length/.test(k))ks.push(k);P.V2.Set(0,-1);jd.localAxisA=P.V2;const a=jd.localAxisA;return JSON.stringify({ks,ax:[a.x,a.y],hz:(jd.frequencyHz=2,jd.frequencyHz)})})()"""))
        await pg.evaluate("G.pick.mode='hotseat';G.pick.map='pair';previewWorld();newMatch();0")
        print(await pg.evaluate("""(()=>{const u=G.sides[0].tank,h=u.body.GetPosition();return JSON.stringify(u.veh.joints.filter(j=>j.t==='w').map(j=>{const q=j.b.b.GetPosition(),A=j.j.GetAnchorA(),Bq=j.j.GetAnchorB();return [+(q.x-h.x).toFixed(2),+(q.y-h.y).toFixed(2),+(A.x-Bq.x).toFixed(2),+(A.y-Bq.y).toFixed(2)]}))})()"""))
        print('\n'.join(errs[:8])); await b.close()
asyncio.run(main())
