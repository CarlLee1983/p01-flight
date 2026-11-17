"""Deterministic sprite import/rigging, not runtime rendering. Pillow is tooling only.
Inputs are original imagegen PNGs retained outside Git. Preserve alpha and rig
visual muzzle columns to existing combat coordinates; no model parameters change.
"""
from pathlib import Path
import hashlib,json
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT.parent
SPECS={
 'hook':('enemy-hook-metal',(192,168),[0,460,880,1340],[0,60,132,192],(30,1145),(4,164)),
 'brake':('enemy-brake-metal',(192,168),[0,430,920,1341],[0,60,132,192],(83,1106),(4,164)),
 'patrol':('enemy-patrol-metal',(416,304),[0,230,1235,1468],[0,52,364,416],(9,1017),(8,280)),
 'cannon':('boss-cannon-metal',(128,192),None,None,(0,1536),(0,192)),
 'broken':('boss-cannon-broken-metal',(128,192),None,None,(0,1536),(0,192)),
 'escort':('enemy-escort-metal',(280,176),None,None,None,None),
 'gunship':('enemy-gunship-metal',(224,196),None,None,None,None),
}
report=[]
for name,(key,size,sx,dx,sy,dy) in SPECS.items():
 path=SOURCE/f'metal-{name}.png'; im=Image.open(path).convert('RGBA')
 out=Image.new('RGBA',size)
 if sx:
  for i in range(len(sx)-1):
   strip=im.crop((sx[i],sy[0],sx[i+1],sy[1])).resize((dx[i+1]-dx[i],dy[1]-dy[0]),Image.Resampling.LANCZOS)
   out.paste(strip,(dx[i],dy[0]))
 else:
  if name in ['escort','gunship']:
   # Keep the central gun mouth at its existing logical combat origin.
   # Full coherent silhouette remains one sprite; image below muzzle gets padding.
   target=(140,168) if name=='escort' else (112,166)
   mouth=(im.width/2,im.height*.85) if name=='escort' else (im.width/2,im.height*.975)
   scale_y=target[1]/mouth[1]
   scaled=im.resize((size[0],round(im.height*scale_y)),Image.Resampling.LANCZOS)
   out.paste(scaled,(0,0))
  else: out=im.resize(size,Image.Resampling.LANCZOS)
 dest=ROOT/'public/assets/original'/f'{key}.webp'
 out.save(dest,'WEBP',quality=92,method=6,exact=True)
 report.append({'key':key,'source':path.name,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceSize':im.size,'size':size,'columnRig':{'source':sx,'destination':dx,'sourceY':sy,'destinationY':dy} if sx else None,'file':str(dest.relative_to(ROOT)),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
(ROOT/'docs/metal-sprite-import.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
