const fs=require('fs');global.Chess=require('chess.js').Chess;
const [,,inp,out]=process.argv;
const lines=fs.existsSync(inp)?fs.readFileSync(inp,'utf8').trim().split('\n').filter(Boolean):[];
const seen=new Set();const bank=[];
for(const l of lines){let r;try{r=JSON.parse(l)}catch(e){continue}
 const key=r.fen.split(' ').slice(0,2).join(' ');if(seen.has(key))continue;seen.add(key);
 const g=new Chess();if(!g.load(r.fen))continue;
 // verify sol legal
 let ok=true;const gg=new Chess(r.fen);for(const u of r.sol){if(!gg.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]||'q'})){ok=false;break}}if(!ok)continue;
 // verify pre+last reproduces fen
 let pre=r.pre,last=r.last;if(pre){const gp=new Chess(pre);const m=gp.move({from:last.slice(0,2),to:last.slice(2,4),promotion:last[4]||'q'});if(!m||gp.fen().split(' ').slice(0,4).join(' ')!==r.fen.split(' ').slice(0,4).join(' ')){pre=null;last=null;}}
 const o={i:bank.length,f:r.fen,s:r.sol.join(' '),t:r.themes.join(','),r:r.rating};if(pre){o.p=pre;o.l=last;if(r.preBest)o.b=r.preBest;}
 bank.push(o);}
fs.writeFileSync(out,'window.PUZZLE_BANK='+JSON.stringify(bank)+';\n');
const th={};bank.forEach(b=>b.t.split(',').forEach(t=>th[t]=(th[t]||0)+1));
console.log('puzzles',bank.length,JSON.stringify(th));
const rs=bank.map(b=>b.r).sort((a,b)=>a-b);console.log('rating p10/50/90',rs[Math.floor(rs.length*.1)],rs[Math.floor(rs.length*.5)],rs[Math.floor(rs.length*.9)]);
