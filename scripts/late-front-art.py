"""Deterministic original SVG scenery and enemy sprites for Stage 04/05."""
from pathlib import Path
from random import Random

OUT=Path(__file__).resolve().parents[1]/"public"/"assets"/"original"
rng=Random(41126)
def svg(name,w,h,content,defs=""):
    (OUT/(name+".svg")).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><defs>{defs}</defs>{content}</svg>\n',encoding="utf8")
def p(d,c,s="#172839",w=2):
    return f'<path d="{d}" fill="{c}" stroke="{s}" stroke-width="{w}" stroke-linejoin="round"/>'
def rect(x,y,w,h,c,r=0):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{c}"/>'
def dot(x,y,r,c,a=1):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" opacity="{a}"/>'
alloy='<linearGradient id="steel" x2="1" y2="1"><stop stop-color="#d8ebec"/><stop offset=".27" stop-color="#829baf"/><stop offset=".57" stop-color="#263c53"/><stop offset=".74" stop-color="#597b89"/><stop offset="1" stop-color="#17222e"/></linearGradient><radialGradient id="core"><stop stop-color="#fff4d1"/><stop offset=".45" stop-color="#ffc375"/><stop offset=".74" stop-color="#c66943"/><stop offset="1" stop-color="#603448"/></radialGradient>'
gate=p("M13 58 2 31 26 16l8 14 13-16h18l13 16 8-14 24 15-11 27-18-4-8 26H39l-8-26Z","url(#steel)")
gate+=p("M29 44l11-14h32l11 14-11 25H40Z","#162939","#a7c6ce")+p("M42 36h28l7 12-10 14H45L35 48Z","url(#core)","#e6aa65")
gate+=p("M15 31l4 11 11-3M97 31l-4 11-11-3M41 72h30","none","#e6aa65")+rect(50,72,12,11,"#ffc785",3)
svg("boss-ascent-gate",112,92,gate,alloy)
for dead in [False,True]:
    b=p("M3 16 8 4h20l5 12-3 21H6Z" if not dead else "M4 22 6 5h21l4 13-7-1-5 12-14 3Z","url(#steel)" if not dead else "#536375")
    b+=p("M13 9h10l2 14-7 12-7-12Z","url(#core)" if not dead else "#603f36","#aa816c")
    svg("boss-ascent-scrap" if dead else "boss-ascent-cell",36,42,b,alloy)
orb="".join(p(d,"url(#steel)","#172036",3) for d in (
    "M15 69 51 51 83 51 68 65 24 82 8 79Z","M111 45 153 46 180 28 186 46 161 67 119 65Z",
    "M81 34 86 4h16l9 32-9 12Z","M65 83 62 101 51 108 41 101l7-25Z","M126 83l16 9 6 13-9 7-17-8Z"))
orb+=p("M67 40 94 28l30 12 16 25-14 27-32 19-31-15-15-30Z","#31455d","#96c5cd",3)
orb+=p("M73 48l21-11 24 11 12 18-13 22-23 13-25-13-11-22Z","#131c39","#657e9c")
orb+=p("M94 45l15 10 10 16-13 16-13 6-18-13-6-14 13-14Z","#9874ea","#ddc0ff")+dot(94,68,11,"#dbcaed")+dot(94,68,7,"#fff0fc")
orb+=rect(37,98,10,5,"#a5fafa",2)+rect(141,98,10,5,"#a5fafa",2)+p("M20 73l35-12M155 56l20-15M93 9l2 19","none","#a1e3e5")
svg("boss-orbital-lattice",188,122,orb,alloy)
for dead in [False,True]:
    b=p("M2 12 13 3h14l6 9-8 12H10Z" if not dead else "M1 10l11-7 8 2-2 8 13-2-7 11-14 3Z","url(#steel)" if not dead else "#455569")
    b+=rect(11,9,14,9,"#b4f8f2" if not dead else "#a87558",3)+rect(15,10,7,6,"#f2f8ff" if not dead else "#67473d",2)
    svg("boss-orbital-scrap" if dead else "boss-orbital-node",35,28,b,alloy)
b=p("M5 46 14 20 34 19l8-11h20l9 11 20 1 8 25-17 17-17-7H39l-20 7Z","url(#steel)","#26354a",3)
b+=p("M21 35h62l-15 13H36Z","#71454a","#d0ad80")+p("M36 48l8-15h16l8 15-8 18H43Z","#26334b","#70a7b6")+rect(47,50,10,20,"#ffd48b",4)
svg("enemy-ascent-interceptor",104,76,b,alloy)
factory=rect(0,0,360,640,"url(#land)")
for x in [34,115,244,324]:
    factory+=rect(x-6,0,12,640,"#273847")+rect(x,0,2,640,"#7c8080")
for y in [48,208,368,528]:
    factory+=rect(0,y,360,28,"#303b49")+f'<path d="M0 {y+14}h360" stroke="#cf9c70" stroke-dasharray="11 7" opacity=".62"/>'
    for x in [9,95,216,303]:
        factory+=p(f"M{x} {y+40}h48l7 9v50H{x}Z",rng.choice(["#516471","#425564","#5c6c75"]),"#253541")
        for j in range(6):factory+=rect(x+6,y+49+j*7,39,1,"#798b92")
        factory+=rect(x+8,y+92,23,8,"#253643")+rect(x+13,y+94,16,2,"#ad987a")
    factory+=p(f"M151 {y+36}h59l13 27-14 39h-58l-16-39Z","#303f53","#89989a")
    factory+=f'<circle cx="180" cy="{y+68}" r="21" fill="#293949" stroke="#ad9781" stroke-width="2" stroke-dasharray="12 3"/>'
for _ in range(430):
    factory+=dot(rng.randrange(360),rng.randrange(640),rng.choice([.35,.65,1]),rng.choice(["#bed2bd","#172b33","#d9b18d"]),.18)
svg("front-ascent-industry",360,640,factory,'<linearGradient id="land"><stop stop-color="#344957"/><stop offset=".48" stop-color="#52636e"/><stop offset="1" stop-color="#2d4452"/></linearGradient>')
cloud=rect(0,0,360,640,"url(#sky)")
for y in range(0,640,80):
    for cx in [-12,368]:
        for _ in range(4):
            x=cx+rng.randrange(-35,36);cy=y+rng.randrange(-33,34);rx=rng.randrange(40,87);ry=rng.randrange(15,48)
            for yy in [cy-640,cy,cy+640]:
                cloud+=f'<ellipse cx="{x}" cy="{yy}" rx="{rx}" ry="{ry}" fill="url(#plume)"/>'
svg("front-ascent-cloud",360,640,cloud,'<linearGradient id="sky"><stop stop-color="#284761"/><stop offset=".5" stop-color="#203457"/><stop offset="1" stop-color="#314263"/></linearGradient><radialGradient id="plume"><stop stop-color="#e5d7d8" stop-opacity=".67"/><stop offset=".62" stop-color="#a4bdcc" stop-opacity=".24"/><stop offset="1" stop-color="#879abe" stop-opacity="0"/></radialGradient>')
stars=rect(0,0,360,640,"url(#space)")
for _ in range(240):
    stars+=dot(rng.randrange(360),rng.randrange(640),rng.choice([.35,.55,.85,1.2]),rng.choice(["#bacfeb","#f8e8cb","#9db8ee"]),rng.uniform(.16,.64))
sp='<linearGradient id="space"><stop stop-color="#172944"/><stop offset=".55" stop-color="#100f26"/><stop offset="1" stop-color="#20152c"/></linearGradient><radialGradient id="planet"><stop stop-color="#c7a89d"/><stop offset=".71" stop-color="#4d9da9"/><stop offset=".88" stop-color="#24597a"/><stop offset="1" stop-color="#152d4a"/></radialGradient>'
planet=stars+'<ellipse cx="-280" cy="318" rx="425" ry="294" fill="url(#planet)" stroke="#8bbdd8" stroke-width="2"/><ellipse cx="-282" cy="318" rx="429" ry="298" fill="none" stroke="#7ebbdc" opacity=".36"/><path d="M0 148c78 20 126 75 136 152M0 460c71-11 118-85 137-145M0 264c44-28 84-9 128 26" stroke="#adc1ce" opacity=".14" fill="none" stroke-width="16"/>'
svg("front-orbit-limb",360,640,planet,sp)
scrap=stars
for x,y,rot,z in [(8,100,-24,1.3),(340,40,25,1.1),(51,386,-33,.75),(326,460,-15,1.3),(9,610,38,.8)]:
    for q in [y-640,y,y+640]:
        scrap+=f'<g transform="translate({x} {q}) rotate({rot}) scale({z})" opacity=".76">'
        scrap+=p("M-36-88h60l13 21-16 30 12 32-8 76-21 13-9-26-22-14 3-49-11-52Z","#293751","#738899")
        scrap+=p("M-30-77h49l7 14-13 16 7 20-6 27-10-11-16 11-8-32-2-22Z","#242b49","#455d77")
        for j in range(6):scrap+=rect(-22,-58+j*9,32,3,"#698799")
        scrap+=p("M-29 15 24 24l-3 41-14 10L-9 42l-13 2Z","#293654","#8093a0")+rect(-8,17,21,6,"#7bb5c9",2)+"</g>"
for _ in range(34):
    x=rng.choice([rng.randrange(106),rng.randrange(255,360)]); y=rng.randrange(16,624); r=rng.randrange(3,9)
    scrap+=p(f"M{x} {y}l{r} -2 -1 {r} -{r} -1z","#56687b","none")
svg("front-orbit-wreck",360,640,scrap,sp)
