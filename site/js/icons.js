const SAT_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
<g fill='#fff'>
<rect x='20' y='18' width='8' height='12' rx='1.5'/>
<rect x='22.5' y='12' width='3' height='6'/>
<circle cx='24' cy='10' r='3'/>
<rect x='4' y='19.5' width='14' height='9' rx='1'/>
<rect x='30' y='19.5' width='14' height='9' rx='1'/>
<rect x='18' y='22.5' width='2' height='3'/>
<rect x='28' y='22.5' width='2' height='3'/>
<rect x='22.5' y='30' width='3' height='5'/>
<path d='M18 38 L24 34 L30 38 Z'/>
</g>
</svg>`;

const DISH_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
<g fill='#fff'>
<ellipse cx='19' cy='23' rx='8.5' ry='15' transform='rotate(45 19 23)'/>
<rect x='18' y='21.4' width='16' height='2.6' rx='1.3' transform='rotate(-45 18 22.7)'/>
<circle cx='31.5' cy='10.5' r='3.2'/>
<rect x='20.5' y='29' width='3.2' height='14'/>
<rect x='13' y='42' width='18' height='3.6' rx='1.6'/>
</g>
</svg>`;

// White glyphs, tinted at runtime by billboard.color, so the CZML carries no
// dependency on files under a static directory.
const uri = svg => "data:image/svg+xml;base64," + btoa(svg);

export const SAT_ICON = uri(SAT_SVG);
export const DISH_ICON = uri(DISH_SVG);
