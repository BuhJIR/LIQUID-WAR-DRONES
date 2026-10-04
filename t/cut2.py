import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.map='pair';G.pick.mode='drill';previewWorld();newMatch();G.deployDone()")
        await pg.wait_for_timeout(500)
        print(await pg.evaluate("""(()=>{const r={malloc:typeof B._malloc,heap:!!B.HEAPF32,set:typeof (new B.b2PolygonShape())._Set,set2:typeof (new B.b2PolygonShape()).Set};
          const u=G.sides[0].tank,[x,y]=unitPos(u);const blk=spawnBlock('chalk',x,y+30,2.2,2.2);const p=blk.body.GetPosition();
          try{r.poly=JSON.stringify(slicePoly(blockWorldPoly(blk),p.x+.3,p.y,0.2,1));r.cut=cutBlock(blk,p.x+.3,p.y,0.2,1);}catch(e){r.err=String(e)+e.stack}
          r.polys=G.blocks.filter(b=>b.alive&&b.poly).length;return JSON.stringify(r)})()"""))
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
