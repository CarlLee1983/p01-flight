"""Offline asset import: preserve alpha and rig only source columns/rows to declared sockets."""
from pathlib import Path
from PIL import Image
import hashlib,json
ROOT=Path(__file__).resolve().parents[2];raw=ROOT/'next-generated';data=json.loads((raw/'sources.json').read_text())
specs={
 'canyon-boss':('boss-canyon',(480,248),None),
 'polar-boss':('boss-polar',(480,248),None),
 'enemy-outrider':('enemy-outrider',(224,176),([0,555,1101,1111],[0,88,168,176])),
 'enemy-bomber':('enemy-bomber',(352,216),([0,491,972,983],[0,108,208,216])),
 'truck-base':('missile-truck-base',(288,288),None),
 'truck-launcher':('missile-truck-head',(192,192),([0,627,1076,1254],[0,96,176,192])),
 'flak-head':('flak-head',(192,192),([0,627,1221,1254],[0,96,176,192])),
 **{k:(k,(720,1080),None) for k in ['polar-river','polar-bridge','polar-mine','polar-dam','polar-reservoir']}}
report=[]
for source,(key,size,rig) in specs.items():
 p=raw/(source+'.png');im=Image.open(p).convert('RGBA' if not source.startswith('polar-') or source=='polar-boss' else 'RGB')
 if rig:
  out=Image.new('RGBA',size);sy,dy=rig
  for i in range(len(sy)-1):out.paste(im.crop((0,sy[i],im.width,sy[i+1])).resize((size[0],dy[i+1]-dy[i]),Image.Resampling.LANCZOS),(0,dy[i]))
 else:out=im.resize(size,Image.Resampling.LANCZOS)
 dest=ROOT/'public/assets/original'/(key+'.webp');out.save(dest,'WEBP',quality=91,method=6,exact=True)
 report.append({'key':key,'path':'assets/original/'+dest.name,'width':size[0],'height':size[1],'source':p.name,'sourceBlob':data['blobs'][source],'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceSize':im.size,'rowRig':rig,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bytes':dest.stat().st_size,'tool':'builtin image_gen','prompt':data['prompts'][source]})
(ROOT/'docs/next-fronts-art-sources.json').write_text(json.dumps(report,indent=2)+'\n');print({'assets':len(report),'bytes':sum(x['bytes'] for x in report)})
