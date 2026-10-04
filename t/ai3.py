import asyncio,sys
from playwright.async_api import async_playwright
JS_NEAR = """window.NEAR=(x,y)=>{const o=[];for(const r of Nature.rocks){if(r.buried)continue;const p=r.body.GetPosition();if(Math.hypot(p.x-x,p.y-y)<10)o.push('rock')}for(const L of Lamps.list){if(!L.body)continue;const p=L.body.GetPosition();if(Math.hypot(p.x-x,p.y-y)<10)o.push('lamp')}for(const k of G.blocks){if(!k.alive)continue;const p=k.body.GetPosition();if(Math.hypot(p.x-x,p.y-y)<10)o.push('blk')}for(const u of G.units){if(!u.alive)continue;const p=unitPos(u);if(Math.hypot(p[0]-x,p[1]-y)<10)o.push('unit'+u.side)}o.push(Terrain.solid(x,y)?'soil':'air');return o};
window.EX=[];window.DM=[];const du=damageUnit;damageUnit=function(u,d,src,...a){if(u.side===1&&u.def.main)DM.push([src,+d.toFixed(1),G.cur,G.phase]);return du.call(this,u,d,src,...a)};const oe=explode;explode=function(x,y,...a){if(G.cur===1)EX.push([x|0,y|0,NEAR(x,y).join(',')]);return oe.call(this,x,y,...a)};0"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        for seed in range(int(sys.argv[1])):
            pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
            errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
            await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3000)
            await pg.evaluate("G.pick.mode='duel';G.pick.ai='assault';G.pick.map='pair';previewWorld();newMatch();G.deployDone();"+JS_NEAR)
            for i in range(80):
                await pg.wait_for_timeout(500)
                r=await pg.evaluate("(()=>{if(G.cur===0&&G.phase==='play')G.endTurn(); if(G.phase==='review')G.pass(); return EX.length})()")
                if r: break
            print(await pg.evaluate("JSON.stringify({ex:EX,ai:unitPos(G.sides[1].tank).map(v=>v|0),hp:G.sides.map(s=>s.tank.hp|0),dm:DM.slice(0,8)})"), errs[:2])
            await pg.close()
        await b.close()
asyncio.run(main())
