import { mkdir, writeFile } from 'node:fs/promises';
// Rasterize the project's code-bracket mark into a standard Windows ICO.
const size=256, pixels=Buffer.alloc(size*size*4), segments=[[24,20,13,32],[13,32,24,44],[40,20,51,32],[51,32,40,44],[35,18,29,46]];
function distance(x,y,[ax,ay,bx,by]){const t=Math.max(0,Math.min(1,((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)));return Math.hypot(x-ax-t*(bx-ax),y-ay-t*(by-ay));}
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 let a=0,red=0,green=0,blue=0;
 for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){
  const px=(x+(sx+.5)/4)*64/size,py=(y+(sy+.5)/4)*64/size;
  const qx=Math.max(15-px,0,px-49),qy=Math.max(15-py,0,py-49);
  if(Math.hypot(qx,qy)>13)continue;
  const ink=segments.some(line=>distance(px,py,line)<2.2),color=ink?[20,32,26]:[199,239,123];
  red+=color[0];green+=color[1];blue+=color[2];a++;
 }
 const offset=((size-1-y)*size+x)*4;pixels[offset]=a?blue/a:0;pixels[offset+1]=a?green/a:0;pixels[offset+2]=a?red/a:0;pixels[offset+3]=Math.round(a/16*255);
}
const maskSize=Math.ceil(size/32)*4*size, dib=Buffer.alloc(40+pixels.length+maskSize);
dib.writeUInt32LE(40,0);dib.writeInt32LE(size,4);dib.writeInt32LE(size*2,8);dib.writeUInt16LE(1,12);dib.writeUInt16LE(32,14);dib.writeUInt32LE(pixels.length,20);pixels.copy(dib,40);
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=size;header[7]=size;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(dib.length,14);header.writeUInt32LE(22,18);
await mkdir('build',{recursive:true});await writeFile('build/icon.ico',Buffer.concat([header,dib]));console.log('Codebound 图标已生成。');
