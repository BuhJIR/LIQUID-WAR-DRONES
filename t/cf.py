import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3000)
        print(await pg.evaluate("""JSON.stringify({cf:typeof B.JSContactFilter, keys:B.JSContactFilter?Object.getOwnPropertyNames(B.JSContactFilter.prototype):null, wset:typeof P.world.SetContactFilter, cl:Object.keys(B).filter(k=>/Filter|Listener/.test(k))})"""))
        await b.close()
asyncio.run(main())
