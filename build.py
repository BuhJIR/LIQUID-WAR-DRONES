import glob
js=''.join(open(f).read() for f in sorted(glob.glob('src/*.js')))
sh=open('shell.html').read()
out=sh.replace('/*@@JS@@*/',open('wasm.js').read()+js)
open('/mnt/user-data/outputs/liquid-war-drones.html','w').write(out); print(len(out))
