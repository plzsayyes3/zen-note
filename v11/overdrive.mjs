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
    this.raf=0;this.effectTimer=0;this.lastFrame=0;this.lastDraw=0;this.expireTimer=0;
    this.audio=null;this.master=null;this.bgmTimer=0;this.bgmStep=0;
    this.lastStageName='';this.lastEnergyBucket=-1;this.pendingHits=0;this.pendingStageIndex=0;this.edgeFlip=false;
    this.w=innerWidth;this.h=innerHeight;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize=this.resize.bind(this);this.loop=this.loop.bind(this);this.flushHitEffects=this.flushHitEffects.bind(this);
    addEventListener('resize',this.resize,{passive:true});this.resize();
  }
  setEnabled(value){
    this.enabled=!!value;
    if(!this.enabled){
      this.combo=0;this.lastHitAt=0;this.pendingHits=0;this.particles.length=0;
      clearTimeout(this.expireTimer);clearTimeout(this.effectTimer);this.effectTimer=0;this.stopBgm();
      if(this.raf){cancelAnimationFrame(this.raf);this.raf=0}
      this.ctx.clearRect(0,0,this.w,this.h);this.paintState(true);
    }
  }
  setBgmEnabled(value){this.bgmEnabled=!!value;if(!this.bgmEnabled)this.stopBgm()}
  resize(){
    this.w=Math.max(1,innerWidth);this.h=Math.max(1,innerHeight);
    this.canvas.width=this.w;this.canvas.height=this.h;this.canvas.style.width=this.w+'px';this.canvas.style.height=this.h+'px';
    this.ctx.setTransform(1,0,0,1,0,0);
  }
  hit(now=Date.now()){
    if(!this.enabled)return;
    this.combo=(!this.lastHitAt||now-this.lastHitAt>2500)?1:this.combo+1;this.lastHitAt=now;
    const stage=overdriveStage(this.combo);
    this.pendingStageIndex=STAGES.indexOf(stage);this.pendingHits=Math.min(10,this.pendingHits+1);
    if(!this.effectTimer)this.effectTimer=setTimeout(this.flushHitEffects,66);
    clearTimeout(this.expireTimer);
    this.expireTimer=setTimeout(()=>{if(Date.now()-this.lastHitAt>=2450){this.combo=0;this.paintState(true);this.stopBgm()}},2520);
    if(this.bgmEnabled)this.startBgm();
  }
  edgePoint(seed=0){
    this.edgeFlip=!this.edgeFlip;
    const margin=26,span=Math.max(60,this.h-margin*2);
    const y=margin+((this.combo*37+seed*71)%span);
    return {x:this.edgeFlip?margin:this.w-margin,y};
  }
  flushHitEffects(){
    this.effectTimer=0;if(!this.enabled||!this.pendingHits)return;
    const stage=STAGES[this.pendingStageIndex]||STAGES[0],hits=this.pendingHits;this.pendingHits=0;
    this.paintState(false,this.pendingStageIndex);
    const point=this.edgePoint(hits),count=this.reduced?1:Math.min(5,1+this.pendingStageIndex+Math.floor(hits/3));
    this.spawn(point.x,point.y,count,stage.hue,false);
  }
  sentenceBurst(){
    if(!this.enabled)return;
    const stage=overdriveStage(this.combo),stageIndex=STAGES.indexOf(stage);
    const left={x:28,y:this.h*.5},right={x:this.w-28,y:this.h*.5};
    const count=this.reduced?4:10+stageIndex*3;
    this.spawn(left.x,left.y,count,stage.hue,true);this.spawn(right.x,right.y,count,stage.hue,true);
    if(!this.reduced){
      this.frame?.animate([{filter:'brightness(1)'},{filter:'brightness(2.05) saturate(1.4)',offset:.25},{filter:'brightness(1)'}],{duration:460,easing:'ease-out'});
    }
    if(this.bgmEnabled)this.chord(stage);
  }
  paintState(force=false,stageIndex=null){
    const stage=stageIndex===null?overdriveStage(this.combo):STAGES[stageIndex],idx=STAGES.indexOf(stage);
    const nextMin=STAGES[idx+1]?.min||120,energy=clamp((this.combo-stage.min)/Math.max(12,nextMin-stage.min),0,1);
    const bucket=Math.floor((idx/4*.72+energy*.28)*6);
    if(force||stage.name!==this.lastStageName||bucket!==this.lastEnergyBucket){
      document.documentElement.style.setProperty('--od-hue',String(stage.hue));
      document.documentElement.style.setProperty('--od-energy',(bucket/6).toFixed(3));
      this.lastStageName=stage.name;this.lastEnergyBucket=bucket;
    }
    this.comboEl.textContent=this.combo?'×'+this.combo:'';this.stageEl.textContent=this.combo?stage.name:'';this.hud.style.opacity=this.combo?'1':'0';
  }
  spawn(x,y,count,hue,burst){
    for(let i=0;i<count;i++){
      const inward=x<this.w/2?1:-1;
      const a=(Math.random()-.5)*(burst?1.5:.9),speed=(burst?90:42)+Math.random()*(burst?150:80);
      const life=(burst?.28:.14)+Math.random()*(burst?.34:.22);
      this.particles.push({x,y,px:x,py:y,vx:Math.cos(a)*speed*inward,vy:Math.sin(a)*speed,life,max:life,r:(burst?1.1:.7)+Math.random()*1.8,h:(hue-18+Math.random()*64+360)%360});
    }
    if(this.particles.length>72)this.particles.splice(0,this.particles.length-72);
    if(!this.raf){this.lastFrame=performance.now();this.lastDraw=0;this.raf=requestAnimationFrame(this.loop)}
  }
  loop(ts){
    if(!this.enabled){this.raf=0;return}
    if(this.lastDraw&&ts-this.lastDraw<33){this.raf=requestAnimationFrame(this.loop);return}
    const dt=Math.min(.05,(ts-this.lastFrame)/1000||0);this.lastFrame=ts;this.lastDraw=ts;
    const ctx=this.ctx;ctx.clearRect(0,0,this.w,this.h);ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue}
      p.px=p.x;p.py=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.978;p.vy*=.978;
      const alpha=clamp(p.life/p.max,0,1);
      ctx.strokeStyle='hsla('+p.h+',100%,70%,'+(alpha*.34)+')';ctx.lineWidth=Math.max(.5,p.r*.55);
      ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(p.x,p.y);ctx.stroke();
      ctx.fillStyle='hsla('+p.h+',100%,78%,'+(alpha*.72)+')';ctx.beginPath();ctx.arc(p.x,p.y,p.r*alpha,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    if(this.particles.length)this.raf=requestAnimationFrame(this.loop);else{ctx.clearRect(0,0,this.w,this.h);this.raf=0}
  }
  ensureAudio(){
    if(this.audio)return true;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
    this.audio=new AC();this.master=this.audio.createGain();this.master.gain.value=.16;this.master.connect(this.audio.destination);return true;
  }
  tone(freq,duration=.08,gain=.05,type='sine',delay=0){
    if(!this.audio||!this.master)return;
    const t=this.audio.currentTime+delay,o=this.audio.createOscillator(),g=this.audio.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);
  }
  startBgm(){
    if(!this.enabled||!this.bgmEnabled||this.bgmTimer)return;if(!this.ensureAudio())return;this.audio.resume?.();
    this.bgmStep=0;this.tickBgm();this.bgmTimer=setInterval(()=>this.tickBgm(),170);
  }
  stopBgm(){if(this.bgmTimer){clearInterval(this.bgmTimer);this.bgmTimer=0}}
  tickBgm(){
    if(!this.enabled||!this.bgmEnabled)return this.stopBgm();
    const stage=overdriveStage(this.combo),level=STAGES.indexOf(stage),step=this.bgmStep++%16,roots=[55,65.41,73.42,82.41],root=roots[Math.min(level,3)];
    if(step%4===0)this.tone(root,.1,.036,'sine');
    if(level>=1&&step%4===2)this.tone(root*2,.045,.012,'triangle');
    if(level>=3&&step%4===1)this.tone(root*3,.045,.010,'sawtooth');
  }
  chord(stage){
    if(!this.ensureAudio()||!this.bgmEnabled)return;this.audio.resume?.();
    const level=STAGES.indexOf(stage),root=[110,130.81,146.83,164.81,196][level]||110;
    [0,7,12].forEach((semi,i)=>this.tone(root*Math.pow(2,semi/12),.16,.018,'triangle',i*.02));
  }
}
