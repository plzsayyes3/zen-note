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
    this.raf=0;this.lastFrame=0;this.expireTimer=0;this.audio=null;this.master=null;this.bgmTimer=0;this.bgmStep=0;
    this.lastStageName='';this.lastEnergyBucket=-1;this.lastPoint=null;this.hitCount=0;this.metrics=null;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize=this.resize.bind(this);this.loop=this.loop.bind(this);
    addEventListener('resize',this.resize,{passive:true});this.resize();
  }
  setEnabled(value){
    this.enabled=!!value;
    if(!this.enabled){
      this.combo=0;this.lastHitAt=0;this.particles.length=0;clearTimeout(this.expireTimer);this.stopBgm();
      if(this.raf){cancelAnimationFrame(this.raf);this.raf=0}
      this.ctx.clearRect(0,0,innerWidth,innerHeight);this.paintState(true);
    }
  }
  setBgmEnabled(value){this.bgmEnabled=!!value;if(!this.bgmEnabled)this.stopBgm()}
  resize(){
    const dpr=Math.min(1.5,devicePixelRatio||1),w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
    this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
    this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';this.ctx.setTransform(dpr,0,0,dpr,0,0);
    const rect=this.editor.getBoundingClientRect(),style=getComputedStyle(this.editor),fs=parseFloat(style.fontSize)||36;
    this.metrics={rect,fs,lh:parseFloat(style.lineHeight)||fs*1.9,padTop:parseFloat(style.paddingTop)||0,charW:fs*.58};
  }
  caretPoint(){
    const m=this.metrics||{rect:this.editor.getBoundingClientRect(),fs:36,lh:68,padTop:0,charW:21};
    const pos=this.editor.selectionStart||0,text=this.editor.value;
    const lineStart=text.lastIndexOf('\n',Math.max(0,pos-1))+1;
    const col=Math.min(80,Array.from(text.slice(lineStart,pos)).length);
    const charsPerLine=Math.max(4,Math.floor(m.rect.width/m.charW));
    const x=clamp(m.rect.left+(col%charsPerLine)*m.charW+4,m.rect.left+4,m.rect.right-4);
    const y=clamp(m.rect.top+m.rect.height*.5,m.rect.top+12,m.rect.bottom-12);
    return {x,y};
  }
  hit(now=Date.now()){
    if(!this.enabled)return;
    this.combo=(!this.lastHitAt||now-this.lastHitAt>2500)?1:this.combo+1;this.lastHitAt=now;this.hitCount++;
    const stage=overdriveStage(this.combo),stageIndex=STAGES.indexOf(stage);
    this.paintState(false,stageIndex);
    const shouldSample=!this.lastPoint||this.hitCount%4===1;
    if(shouldSample)this.lastPoint=this.caretPoint();
    const point=this.lastPoint,count=this.reduced?1:2+stageIndex;
    this.spawn(point.x,point.y,count,stage.hue,false);
    clearTimeout(this.expireTimer);this.expireTimer=setTimeout(()=>{if(Date.now()-this.lastHitAt>=2450){this.combo=0;this.paintState(true);this.stopBgm()}},2520);
    if(this.bgmEnabled)this.startBgm();
  }
  sentenceBurst(){
    if(!this.enabled)return;
    const stage=overdriveStage(this.combo),stageIndex=STAGES.indexOf(stage),point=this.lastPoint||this.caretPoint();
    this.spawn(point.x,point.y,this.reduced?8:28+stageIndex*6,stage.hue,true);
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
      const a=Math.random()*Math.PI*2,speed=(burst?100:45)+Math.random()*(burst?240:120),life=(burst?.34:.18)+Math.random()*(burst?.5:.34);
      this.particles.push({x,y,px:x,py:y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life,max:life,r:(burst?1.2:.7)+Math.random()*2.4,h:(hue-22+Math.random()*78+360)%360});
    }
    if(this.particles.length>220)this.particles.splice(0,this.particles.length-220);
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
      ctx.strokeStyle='hsla('+p.h+',100%,70%,'+(alpha*.42)+')';ctx.lineWidth=Math.max(.5,p.r*.6);
      ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(p.x,p.y);ctx.stroke();
      ctx.fillStyle='hsla('+p.h+',100%,78%,'+(alpha*.86)+')';ctx.beginPath();ctx.arc(p.x,p.y,p.r*alpha,0,Math.PI*2);ctx.fill();
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
