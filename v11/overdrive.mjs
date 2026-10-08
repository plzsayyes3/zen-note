const STAGES = [
  {name:'IDLE', min:0, hue:205},
  {name:'BOOST', min:8, hue:192},
  {name:'RUSH', min:24, hue:282},
  {name:'FEVER', min:52, hue:332},
  {name:'OVERDRIVE', min:92, hue:42}
];

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function overdriveStage(combo){
  let stage=STAGES[0];
  for(const candidate of STAGES) if(combo>=candidate.min) stage=candidate;
  return stage;
}

export class OverdriveController{
  constructor({editor,canvas,hud,comboEl,stageEl}){
    this.editor=editor;this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});
    this.hud=hud;this.comboEl=comboEl;this.stageEl=stageEl;this.frame=document.querySelector('.frame');
    this.enabled=false;this.bgmEnabled=false;this.combo=0;this.lastHitAt=0;this.particles=[];
    this.raf=0;this.effectRaf=0;this.lastFrame=0;this.expireTimer=0;this.audio=null;this.master=null;this.bgmTimer=0;this.bgmStep=0;
    this.lastStageName='';this.lastEnergyBucket=-1;this.lastPoint=null;this.pendingHits=0;this.pendingStageIndex=0;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize=this.resize.bind(this);this.loop=this.loop.bind(this);this.flushHitEffects=this.flushHitEffects.bind(this);
    this.createCaretMirror();
    addEventListener('resize',this.resize,{passive:true});this.resize();
  }
  createCaretMirror(){
    this.mirror=document.createElement('div');this.mirrorText=document.createTextNode('');this.marker=document.createElement('span');
    this.marker.textContent='\u200b';this.mirror.append(this.mirrorText,this.marker);
    Object.assign(this.mirror.style,{position:'fixed',left:'-12000px',top:'0',height:'auto',visibility:'hidden',pointerEvents:'none',whiteSpace:'pre-wrap',overflow:'hidden',overflowWrap:'break-word',wordBreak:'break-word'});
    document.body.appendChild(this.mirror);
  }
  syncCaretMirror(){
    const style=getComputedStyle(this.editor),rect=this.editor.getBoundingClientRect(),m=this.mirror.style;
    m.width=rect.width+'px';m.boxSizing=style.boxSizing;m.fontFamily=style.fontFamily;m.fontSize=style.fontSize;
    m.fontWeight=style.fontWeight;m.fontStyle=style.fontStyle;m.lineHeight=style.lineHeight;m.letterSpacing=style.letterSpacing;
    m.paddingTop=style.paddingTop;m.paddingRight=style.paddingRight;m.paddingBottom=style.paddingBottom;m.paddingLeft=style.paddingLeft;
    m.borderTopWidth=style.borderTopWidth;m.borderRightWidth=style.borderRightWidth;m.borderBottomWidth=style.borderBottomWidth;m.borderLeftWidth=style.borderLeftWidth;
    m.borderStyle='solid';m.textAlign=style.textAlign;m.textIndent=style.textIndent;m.tabSize=style.tabSize;
    this.editorRect=rect;this.lineHeight=parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.9||64;
  }
  setEnabled(value){
    this.enabled=!!value;
    if(!this.enabled){
      this.combo=0;this.lastHitAt=0;this.pendingHits=0;this.particles.length=0;clearTimeout(this.expireTimer);this.stopBgm();
      if(this.raf){cancelAnimationFrame(this.raf);this.raf=0}if(this.effectRaf){cancelAnimationFrame(this.effectRaf);this.effectRaf=0}
      this.ctx.clearRect(0,0,innerWidth,innerHeight);this.paintState(true);
    }else{
      this.syncCaretMirror();
    }
  }
  setBgmEnabled(value){this.bgmEnabled=!!value;if(!this.bgmEnabled)this.stopBgm()}
  resize(){
    const dpr=Math.min(1.5,devicePixelRatio||1),w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
    this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
    this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.syncCaretMirror();
  }
  caretPoint(){
    const pos=this.editor.selectionStart||0;
    this.mirrorText.data=this.editor.value.slice(0,pos);
    const mirrorRect=this.mirror.getBoundingClientRect(),markerRect=this.marker.getBoundingClientRect();
    const rect=this.editor.getBoundingClientRect();
    const x=clamp(rect.left+(markerRect.left-mirrorRect.left)-this.editor.scrollLeft,rect.left+4,rect.right-4);
    const y=clamp(rect.top+(markerRect.top-mirrorRect.top)-this.editor.scrollTop+this.lineHeight*.55,rect.top+8,rect.bottom-8);
    return {x,y};
  }
  hit(now=Date.now()){
    if(!this.enabled)return;
    this.combo=(!this.lastHitAt||now-this.lastHitAt>2500)?1:this.combo+1;this.lastHitAt=now;
    const stage=overdriveStage(this.combo),stageIndex=STAGES.indexOf(stage);
    this.pendingHits=Math.min(8,this.pendingHits+1);this.pendingStageIndex=stageIndex;
    if(!this.effectRaf)this.effectRaf=requestAnimationFrame(this.flushHitEffects);
    clearTimeout(this.expireTimer);this.expireTimer=setTimeout(()=>{if(Date.now()-this.lastHitAt>=2450){this.combo=0;this.paintState(true);this.stopBgm()}},2520);
    if(this.bgmEnabled)this.startBgm();
  }
  flushHitEffects(){
    this.effectRaf=0;if(!this.enabled||!this.pendingHits)return;
    const stage=STAGES[this.pendingStageIndex]||STAGES[0],hits=this.pendingHits;this.pendingHits=0;
    this.paintState(false,this.pendingStageIndex);
    this.lastPoint=this.caretPoint();
    const count=this.reduced?1:Math.min(8,1+this.pendingStageIndex+Math.ceil(hits/2));
    this.spawn(this.lastPoint.x,this.lastPoint.y,count,stage.hue,false);
  }
  sentenceBurst(){
    if(!this.enabled)return;
    const stage=overdriveStage(this.combo),stageIndex=STAGES.indexOf(stage),point=this.caretPoint();
    this.lastPoint=point;
    this.spawn(point.x,point.y,this.reduced?8:24+stageIndex*5,stage.hue,true);
    if(!this.reduced){
      this.frame?.animate([{filter:'brightness(1)'},{filter:'brightness(2.2) saturate(1.45)',offset:.25},{filter:'brightness(1)'}],{duration:520,easing:'ease-out'});
      this.editor.animate([{filter:'brightness(1)'},{filter:'brightness(1.35)',offset:.3},{filter:'brightness(1)'}],{duration:300,easing:'ease-out'});
    }
    if(this.bgmEnabled)this.chord(stage);
  }
  paintState(force=false,stageIndex=null){
    const stage=stageIndex===null?overdriveStage(this.combo):STAGES[stageIndex],idx=STAGES.indexOf(stage);
    const nextMin=STAGES[idx+1]?.min||120,energy=clamp((this.combo-stage.min)/Math.max(12,nextMin-stage.min),0,1);
    const bucket=Math.floor((idx/4*.72+energy*.28)*12);
    if(force||stage.name!==this.lastStageName||bucket!==this.lastEnergyBucket){
      document.documentElement.style.setProperty('--od-hue',String(stage.hue));
      document.documentElement.style.setProperty('--od-energy',(bucket/12).toFixed(3));
      this.lastStageName=stage.name;this.lastEnergyBucket=bucket;
    }
    this.comboEl.textContent=this.combo?'×'+this.combo:'';this.stageEl.textContent=this.combo?stage.name:'';this.hud.style.opacity=this.combo?'1':'0';
  }
  spawn(x,y,count,hue,burst){
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2,speed=(burst?100:45)+Math.random()*(burst?220:110),life=(burst?.32:.17)+Math.random()*(burst?.46:.30);
      this.particles.push({x,y,px:x,py:y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life,max:life,r:(burst?1.15:.7)+Math.random()*2.2,h:(hue-22+Math.random()*78+360)%360});
    }
    if(this.particles.length>180)this.particles.splice(0,this.particles.length-180);
    if(!this.raf){this.lastFrame=performance.now();this.raf=requestAnimationFrame(this.loop)}
  }
  loop(ts){
    if(!this.enabled){this.raf=0;return}
    const dt=Math.min(.034,(ts-this.lastFrame)/1000||0);this.lastFrame=ts;
    const ctx=this.ctx,w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue}
      p.px=p.x;p.py=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.982;p.vy=p.vy*.982+28*dt;
      const alpha=clamp(p.life/p.max,0,1);
      ctx.strokeStyle='hsla('+p.h+',100%,70%,'+(alpha*.40)+')';ctx.lineWidth=Math.max(.5,p.r*.6);
      ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(p.x,p.y);ctx.stroke();
      ctx.fillStyle='hsla('+p.h+',100%,78%,'+(alpha*.82)+')';ctx.beginPath();ctx.arc(p.x,p.y,p.r*alpha,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    if(this.particles.length)this.raf=requestAnimationFrame(this.loop);else{ctx.clearRect(0,0,w,h);this.raf=0}
  }
  ensureAudio(){
    if(this.audio)return true;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
    this.audio=new AC();this.master=this.audio.createGain();this.master.gain.value=.18;this.master.connect(this.audio.destination);return true;
  }
  tone(freq,duration=.08,gain=.05,type='sine',delay=0){
    if(!this.audio||!this.master)return;
    const t=this.audio.currentTime+delay,o=this.audio.createOscillator(),g=this.audio.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);
  }
  startBgm(){
    if(!this.enabled||!this.bgmEnabled||this.bgmTimer)return;if(!this.ensureAudio())return;this.audio.resume?.();
    this.bgmStep=0;this.tickBgm();this.bgmTimer=setInterval(()=>this.tickBgm(),140);
  }
  stopBgm(){if(this.bgmTimer){clearInterval(this.bgmTimer);this.bgmTimer=0}}
  tickBgm(){
    if(!this.enabled||!this.bgmEnabled)return this.stopBgm();
    const stage=overdriveStage(this.combo),level=STAGES.indexOf(stage),step=this.bgmStep++%16,roots=[55,65.41,73.42,82.41],root=roots[Math.min(level,3)];
    if(step%4===0)this.tone(root,.11,.042,'sine');
    if(level>=1&&step%4===2)this.tone(root*2,.05,.014,'triangle');
    if(level>=2&&step%4===1){const seq=[0,7,12,19][step%4];this.tone(root*Math.pow(2,seq/12)*2,.06,.013,'sawtooth')}
    if(level>=4&&step%4===3)this.tone(root*4,.04,.012,'square');
  }
  chord(stage){
    if(!this.ensureAudio()||!this.bgmEnabled)return;this.audio.resume?.();
    const level=STAGES.indexOf(stage),root=[110,130.81,146.83,164.81,196][level]||110;
    [0,7,12].forEach((semi,i)=>this.tone(root*Math.pow(2,semi/12),.18,.02,'triangle',i*.02));
  }
}
