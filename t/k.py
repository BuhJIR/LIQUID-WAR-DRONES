import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        for w,h in [(390,844),(360,640)]:
            pg=await b.new_page(viewport={'width':w,'height':h},has_touch=True)
            await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(2500)
            await pg.evaluate("G.pick.map='valley';G.pick.foe='tank';G.pick.mode='hotseat';previewWorld();newMatch()"); await pg.wait_for_timeout(1500)
            r=await pg.evaluate("[...document.querySelectorAll('#bottom .stick,#bottom .lever,#bFire,.chip')].filter(e=>e.offsetParent).map(e=>{const r=e.getBoundingClientRect();return [e.id||e.className, Math.round(r.left), Math.round(r.right)]}).filter(x=>x[2]>innerWidth||x[1]<0)")
            print(w, 'overflow:', r)
            await pg.screenshot(path=f't/k{w}.png', clip={'x':0,'y':h-240,'width':w,'height':240})
        await b.close()
asyncio.run(main())
