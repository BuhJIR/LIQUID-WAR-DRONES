import asyncio,json,sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+' '+str(e.stack)[:500]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate(f"G.pick.mode='duel';G.pick.ai='assault';G.pick.map='{sys.argv[1]}';previewWorld();newMatch();G.deployDone();window.PL=[];const op=AI.plan.bind(AI);AI.plan=async function(...a){{const t=performance.now();const r=await op(...a);PL.push([G.turn,r&&r.w.id,r&&r.grade,r&&r.miss!=null?+r.miss.toFixed(1):null,Math.round(performance.now()-t)]);return r}};window.EX=[];const oe=explode;explode=function(x,y,...a){{if(G.cur===1)EX.push([x|0,y|0]);return oe.call(this,x,y,...a)}};const oa=AI.traverse.bind(AI);0")
        for i in range(24):
            await pg.wait_for_timeout(2500)
            st=await pg.evaluate("(()=>{if(G.cur===0&&G.phase==='play')G.endTurn(); if(G.phase==='review')G.pass(); return JSON.stringify({t:G.turn,ph:G.phase,hp:G.sides.map(s=>Math.round(s.tank.hp)),p:G.sides.map(s=>unitPos(s.tank).map(v=>v|0))})})()")
            if True or '"over"' in st: print(st)
            if '"over"' in st: break
        print(await pg.evaluate("JSON.stringify(PL)"))
        print(await pg.evaluate("JSON.stringify({ex:EX,li:G.lastImpact[1],near:(()=>{const o=[];P.bodyMap.forEach((v,k)=>{const b=v.blk?v.blk.body:(v.u?v.u.body:null)});for(const r of Nature.rocks){const p=r.body.GetPosition();if(Math.hypot(p.x-289,p.y-123)<8)o.push(["rock",p.x|0,p.y|0])}for(const L of Lamps.list){const p=L.body?L.body.GetPosition():L;if(Math.hypot(p.x-289,p.y-123)<8)o.push(["lamp",p.x|0,p.y|0])}for(const k of G.blocks){const p=k.body.GetPosition();if(Math.hypot(p.x-289,p.y-123)<8)o.push(["blk",p.x|0,p.y|0,k.alive])}return o})(),own:G.blocks.filter(k=>{const p=k.body.GetPosition(),[x,y]=unitPos(G.sides[1].tank);return Math.hypot(p.x-x,p.y-y)<40}).map(k=>k.alive?Math.round(k.hp/k.maxHp*100):-1)})"))
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
