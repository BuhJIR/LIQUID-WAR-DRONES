import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.mode='hotseat';G.pick.map='pair';previewWorld();newMatch();0")
        print(await pg.evaluate("""(()=>{const ps=P.water;const o={n:ps.GetParticleCount(),bc:typeof ps.GetBodyContacts,bcc:typeof ps.GetBodyContactCount,st:typeof ps.GetStuckCandidates};const d=new B.b2ParticleSystemDef();const ks=[];for(const k in d)if(k.startsWith('set_'))ks.push(k.slice(4));o.ks=ks.join(',');o.flags=Object.keys(B).filter(k=>/^b2_.*Particle$/.test(k)).join(',');if(ps.GetBodyContactCount){o.cnt=ps.GetBodyContactCount();const c=ps.GetBodyContacts();o.c=Object.keys(Object.getPrototypeOf(c)).slice(0,30).join(',')}return JSON.stringify(o)})()"""))
        await b.close()
asyncio.run(main())
