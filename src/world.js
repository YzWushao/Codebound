const rounded = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
export class World {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.level = null; this.state = null;
    this.time = 0; this.position = { x: 0, y: 0 }; this.target = { x: 0, y: 0 };
    this.resize = new ResizeObserver(() => this.size()); this.resize.observe(canvas);
    const animate = time => { this.time = time; this.draw(); this.frame = requestAnimationFrame(animate); };
    this.frame = requestAnimationFrame(animate);
  }
  size() {
    const box = this.canvas.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio, 2);
    this.canvas.width = Math.round(box.width * dpr); this.canvas.height = Math.round(box.height * dpr);
    this.width = box.width; this.height = box.height; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  set(level, state, reset = false) {
    this.level = level; this.state = state; this.target = state.player;
    if (reset) this.position = { ...state.player };
  }
  draw() {
    if (!this.level || !this.width) return;
    const c = this.ctx, w = this.width, h = this.height;
    c.clearRect(0, 0, w, h);
    const bg = c.createRadialGradient(w * .5, h * .4, 0, w * .5, h * .4, w * .8);
    bg.addColorStop(0, '#1c2d31'); bg.addColorStop(1, '#10191e'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#8ccabb08'; c.lineWidth = 1;
    for (let x = (w % 32) / 2; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    for (let i = 0; i < 24; i++) {
      c.fillStyle = `rgba(151,208,180,${.15 + .12 * Math.sin(this.time / 1700 + i)})`;
      c.fillRect((i * 149 + 23) % w, (i * 83 + 17) % h, i % 4 === 0 ? 2 : 1, 2);
    }
    const rows = this.level.map.length, cols = this.level.map[0].length;
    const tile = Math.min((w - 76) / cols, (h - 76) / rows, 62);
    const ox = (w - cols * tile) / 2, oy = (h - rows * tile) / 2;
    const isWall = (x, y) => !this.level.map[y] || this.level.map[y][x] === '#';
    c.save();
    this.level.map.forEach((row, y) => [...row].forEach((cell, x) => {
      const tx = ox + x * tile, ty = oy + y * tile;
      if (cell === '#') {
        const adjacent = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => !isWall(x + dx, y + dy) && x+dx>=0 && x+dx<cols && y+dy>=0 && y+dy<rows);
        if (!adjacent) return;
        c.fillStyle = '#203333'; rounded(c, tx + 4, ty + 8, tile - 8, tile - 9, 8); c.fill();
        c.fillStyle = '#2a4240'; rounded(c, tx + 4, ty + 2, tile - 8, tile - 10, 8); c.fill();
        c.fillStyle = '#3a5a4d'; rounded(c, tx + 8, ty + 5, tile - 16, 5, 3); c.fill();
        if ((x + y) % 3 === 0) {
          c.fillStyle = '#6b9b6b'; rounded(c, tx + tile * .32, ty + tile * .3, tile * .25, tile * .17, 3); c.fill();
          c.fillStyle = '#8fa971'; c.fillRect(tx + tile * .43, ty + tile * .24, 3, 5);
        }
      } else {
        c.fillStyle = '#16272b'; rounded(c, tx + 1, ty + 4, tile - 2, tile - 1, 8); c.fill();
        c.fillStyle = '#314448'; rounded(c, tx + 1, ty, tile - 2, tile - 3, 8); c.fill();
        c.strokeStyle = '#55707155'; c.stroke();
        c.fillStyle = '#536466'; c.fillRect(tx + 8, ty + 8, 2, 2); c.fillRect(tx + tile - 11, ty + tile - 14, 2, 2);
        if (cell === 'S') {
          c.fillStyle = '#9d8fdc25'; rounded(c, tx + 7, ty + 7, tile - 14, tile - 18, 6); c.fill();
          c.strokeStyle = '#b7a2ff70'; c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]);
        }
        if (cell === 'G') this.goal(c, tx, ty, tile);
      }
    }));
    for (const battery of this.state.batteries) this.battery(c, ox + battery.x * tile, oy + battery.y * tile, tile);
    this.position.x += (this.target.x - this.position.x) * .19;
    this.position.y += (this.target.y - this.position.y) * .19;
    this.robot(c, ox + (this.position.x + .5) * tile, oy + (this.position.y + .5) * tile, tile);
    c.restore();
    c.fillStyle = '#78918e'; c.font = '10px Consolas, monospace'; c.textAlign = 'left';
    c.fillText('CAMPUS / SECTOR ' + String(this.level.chapter).toUpperCase(), 22, h - 20);
    c.textAlign = 'right'; c.fillStyle = '#a8c2ad'; c.fillText('BYTE SYSTEMS · ONLINE', w - 22, h - 20);
  }
  goal(c, x, y, tile) {
    const pulse = .6 + .15 * Math.sin(this.time / 450);
    c.save(); c.shadowColor = '#bde982'; c.shadowBlur = 22 * pulse;
    c.fillStyle = '#bde98228'; rounded(c, x + 5, y + 4, tile - 10, tile - 12, 8); c.fill();
    c.strokeStyle = '#c7ef7b'; c.lineWidth = 1.5; rounded(c, x + 10, y + 9, tile - 20, tile - 22, 5); c.stroke();
    const cx = x + tile / 2, cy = y + tile / 2 - 3;
    c.beginPath(); c.moveTo(cx - 5, cy - 5); c.lineTo(cx + 2, cy - 5); c.lineTo(cx + 2, cy - 9); c.lineTo(cx + 9, cy); c.lineTo(cx + 2, cy + 9); c.lineTo(cx + 2, cy + 5); c.lineTo(cx - 5, cy + 5); c.stroke(); c.restore();
  }
  battery(c, x, y, tile) {
    const f = Math.sin(this.time / 500 + x) * 3;
    c.save(); c.translate(x + tile / 2, y + tile / 2 - 4 + f);
    c.shadowColor = '#ffcc76'; c.shadowBlur = 16; c.fillStyle = '#ffcf7f';
    rounded(c, -8, -10, 16, 22, 4); c.fill(); c.fillRect(-3, -13, 6, 4);
    c.shadowBlur = 0; c.fillStyle = '#7a5127'; c.beginPath(); c.moveTo(2,-6); c.lineTo(-4,2); c.lineTo(0,2); c.lineTo(-2,8); c.lineTo(5,0); c.lineTo(1,0); c.closePath(); c.fill(); c.restore();
  }
  robot(c, x, y, tile) {
    const scale = tile / 56; const bob = Math.sin(this.time / 600) * 1.6;
    c.save(); c.translate(x, y); c.scale(scale, scale);
    c.fillStyle = '#0005'; c.beginPath(); c.ellipse(0, 12, 19, 7, 0, 0, Math.PI*2); c.fill();
    c.translate(0, -3 + bob); c.fillStyle = '#6e698f'; rounded(c,-17,2,12,13,4); c.fill(); rounded(c,5,2,12,13,4); c.fill();
    c.fillStyle = '#9383c9'; rounded(c,-22,-11,44,30,9); c.fill();
    c.fillStyle = '#d5c9f5'; rounded(c,-22,-18,44,31,9); c.fill();
    c.fillStyle = '#111d25'; rounded(c,-16,-13,32,19,6); c.fill();
    c.fillStyle = '#c7ef7b'; c.shadowColor = '#c7ef7b'; c.shadowBlur=7;
    rounded(c,-10,-7,6,7,2); c.fill(); rounded(c,4,-7,6,7,2); c.fill(); c.shadowBlur=0;
    c.strokeStyle='#b0a3d8'; c.lineWidth=2; c.beginPath(); c.moveTo(0,-18); c.lineTo(0,-26); c.stroke();
    c.fillStyle='#c7ef7b'; c.beginPath(); c.arc(0,-28,3,0,Math.PI*2); c.fill();
    c.fillStyle='#ffffff80'; rounded(c,-15,-17,13,3,2); c.fill(); c.restore();
  }
  dispose() { cancelAnimationFrame(this.frame); this.resize.disconnect(); }
}
