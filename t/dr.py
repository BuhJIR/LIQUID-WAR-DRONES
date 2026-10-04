import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844},has_touch=True)
        errs=[]; pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)+str(e.stack)[:300]))
        await pg.goto('file:///mnt/user-data/outputs/liquid-war-drones.html'); await pg.wait_for_timeout(3500)
        await pg.evaluate("G.pick.mode='duel';G.pick.map='pair';previewWorld();newMatch();0")
        print(await pg.evaluate("JSON.stringify({rocks:Nature.rocks.filter(r=>!r.buried).length,blocks:G.blocks.length,water:P.water.GetParticleCount()})"))
        await pg.evaluate("G.deployDone();document.getElementById('cover').hidden=true;G.paused=false;0")
        print(await pg.evaluate("JSON.stringify({rocks:Nature.rocks.filter(r=>!r.buried).length,blocks:G.blocks.map(b=>b.mat.name).join('|'),phase:G.phase})"))
        await pg.wait_for_timeout(4000)
        print(await pg.evaluate("JSON.stringify({oil:P.oil.GetParticleCount(),water:P.water.GetParticleCount(),awake:G.blocks.filter(b=>b.body.IsAwake()).length})"))
        print(await pg.evaluate("(()=>{let f=0,t=performance.now();return new Promise(r=>{function s(){f++;if(performance.now()-t<2000)requestAnimationFrame(s);else r(f/2)}requestAnimationFrame(s)})})()"),'fps')
        await pg.evaluate("if(G.phase==='play'&&G.cur===0)G.endTurn()")
        await pg.evaluate("const u=G.sides[0].tank;const [x,y]=unitPos(u);V.cx=x;V.cy=y;V.z=V.W/70")
        await pg.wait_for_timeout(300); await pg.screenshot(path='t/dr.png')
        # pan test
        print('inside', await pg.evaluate('(()=>{const {n,pos}=particleArrays(P.water);let c=0;for(let i=0;i<n;i++)if(Terrain.solid(pos[i*2],pos[i*2+1]))c++;return c+"/"+n})()'))
        print('before', await pg.evaluate('JSON.stringify([V.cx|0,V.cy|0])'))
        await pg.mouse.move(200,300); await pg.mouse.down(); await pg.mouse.move(260,380,steps=8); await pg.mouse.up()
        print('pan', await pg.evaluate("JSON.stringify([V.cx|0,V.cy|0])"))
        print('\n'.join(errs[:6])); await b.close()
asyncio.run(main())
