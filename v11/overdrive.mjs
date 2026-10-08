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
    this.hud=hud;this.comboEl=comboEl;this.stageEl=stageEl;
    this.enabled=false;this.bgmEnabled=false;this.combo=0;this.lastHitAt=0;this.particles=[];
    this.raf=0;this.lastFrame=performance.now();this.audio=null;this.master=null;this.bgmTimer=0;this.bgmStep=0;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize=this.resize.bind(this);this.loop=this.loop.bind(this);
    addEventListener('resize',this.resize,{passive:true});this.resize();this.raf=requestAnimationFrame(this.loop);
  }
  setEnabled(value){
    this.enabled=!!value;
    if(!this.enabled){this.combo=0;this.lastHitAt=0;this.particles.length=0;this.stopBgm();this.paintState(0);}
  }
  setBgmEnabled(value){
    this.bgmEnabled=!!value;
    if(!this.bgmEnabled)this.stopBgm();
  }
  resize(){
    const dpr=Math.min(2,devicePixelRatio||1),w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
    this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
    this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  caretPoint(){
    const rect=this.editor.getBoundingClientRect(),style=getComputedStyle(this.editor);
    const fs=parseFloat(style.fontSize)||36,lh=parseFloat(style.lineHeight)||fs*1.9;
    const before=this.editor.value.slice(0,this.editor.selectionStart||0),rawLines=before.split('\n');
    const charW=fs*.58,charsPerLine=Math.max(4,Math.floor(rect.width/charW));
    let visualRow=0,col=0;
    for(let i=0;i<rawLines.length;i++){
      const len=Array.from(rawLines[i]).length;
      if(i===rawLines.length-1){visualRow+=Math.floor(len/charsPerLine);col=len%charsPerLine;}
      else visualRow+=Math.max(1,Math.ceil((len+1)/charsPerLine));
    }
    const padTop=parseFloat(style.paddingTop)||0;
    return {
      x:clamp(rect.left+col*charW+4,rect.left+4,rect.right-4),
      y:clamp(rect.top+padTop+visualRow*lh-this.editor.scrollTop+lh*.55,rect.top+8,rect.bottom-8)
    };
  }
  hit(now=Date.now()){
    if(!this.enabled)return;
    this.combo=(!this.lastHitAt||now-this.lastHitAt>2500)?1:this.combo+1;
    this.lastHitAt=now;
    const stage=overdriveStage(this.combo),stageIndex=STAGES.indexOf(stage);
    this.paintState(stageIndex);
    const point=this.caretPoint(),count=this.reduced?2:5+stageIndex*4;
    this.spawn(point.x,point.y,count,stage.hue,false);
    document.body.classList.remove('od-hit');void document.body.offsetWidth;document.body.classList.add('od-hit');
    clearTimeout(this.hitTimer);this.hitTimer=setTimeout(()=>document.body.classList.remove('od-hit'),110);
    if(this.bgmEnabled)this.startBgm();
  }
  sentenceBurst(){
    if(!this.enabled)return;
    const stage=overdriveStage(this.combo),point=this.caretPoint();
    this.spawn(point.x,point.y,this.reduced?12:72+STAGES.indexOf(stage)*14,stage.hue,true);
    document.body.classList.remove('od-sentence');void document.body.offsetWidth;document.body.classList.add('od-sentence');
    clearTimeout(this.sentenceTimer);this.sentenceTimer=setTimeout(()=>document.body.classList.remove('od-sentence'),720);
    if(this.bgmEnabled)this.chord(stage);
  }
  paintState(stageIndex){
    const stage=STAGES[stageIndex]||STAGES[0],energy=clamp((this.combo-stage.min)/Math.max(12,(STAGES[stageIndex+1]?.min||120)-stage.min),0,1);
    document.documentElement.style.setProperty('--od-hue',String(stage.hue));
    document.documentElement.style.setProperty('--od-energy',(stageIndex/4*.72+energy*.28).toFixed(3));
    this.comboEl.textContent=this.combo?'×'+this.combo:'';
    this.stageEl.textContent=this.combo?stage.name:'';
    this.hud.style.opacity=this.combo?'1':'0';
  }
  spawn(x,y,count,hue,burst){
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2,speed=(burst?120:55)+Math.random()*(burst?300:170);
      const life=(burst?.45:.25)+Math.random()*(burst?.75:.5);
      this.particles.push({x,y,px:x,py:y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life,max:life,r:(burst?1.4:.8)+Math.random()*3.2,h:(hue-24+Math.random()*88+360)%360});
    }
    if(this.particles.length>700)this.particles.splice(0,this.particles.length-700);
  }
  loop(ts){
    const dt=Math.min(.034,(ts-this.lastFrame)/1000||0);this.lastFrame=ts;
    const ctx=this.ctx,w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);
    if(this.enabled){
      if(this.combo&&Date.now()-this.lastHitAt>2500){
        this.combo=0;this.paintState(0);this.stopBgm();
      }
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(let i=this.particles.length-1;i>=0;i--){
        const p=this.particles[i];p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue}
        p.px=p.x;p.py=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;p.vy=p.vy*.985+34*dt;
        const alpha=clamp(p.life/p.max,0,1);
        ctx.strokeStyle='hsla('+p.h+',100%,68%,'+(alpha*.56)+')';ctx.lineWidth=Math.max(.6,p.r*.7);
        ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(p.x,p.y);ctx.stroke();
        ctx.fillStyle='hsla('+p.h+',100%,76%,'+alpha+')';ctx.beginPath();ctx.arc(p.x,p.y,p.r*alpha,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    this.raf=requestAnimationFrame(this.loop);
  }
  ensureAudio(){
    if(this.audio)return true;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
    this.audio=new AC();this.master=this.audio.createGain();this.master.gain.value=.22;this.master.connect(this.audio.destination);return true;
  }
  tone(freq,duration=.08,gain=.05,type='sine',delay=0){
    if(!this.audio||!this.master)return;
    const t=this.audio.currentTime+delay,o=this.audio.createOscillator(),g=this.audio.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);
  }
  startBgm(){
    if(!this.enabled||!this.bgmEnabled||this.bgmTimer)return;
    if(!this.ensureAudio())return;
    this.audio.resume?.();
    this.bgmStep=0;this.tickBgm();this.bgmTimer=setInterval(()=>this.tickBgm(),100);
  }
  stopBgm(){if(this.bgmTimer){clearInterval(this.bgmTimer);this.bgmTimer=0}}
  tickBgm(){
    if(!this.enabled||!this.bgmEnabled)return this.stopBgm();
    const stage=overdriveStage(this.combo),level=STAGES.indexOf(stage),step=this.bgmStep++%16;
    const roots=[55,65.41,73.42,82.41],root=roots[Math.min(level,3)];
    if(step%4===0)this.tone(root,.12,.05,'sine');
    if(step%2===0)this.tone(880+(step%4)*110,.025,.011,'square');
    if(level>=1&&step%4===2)this.tone(root*2,.055,.018,'triangle');
    if(level>=2&&step%2===1){const seq=[0,7,12,19][step%4];this.tone(root*Math.pow(2,seq/12)*2,.07,.017,'sawtooth')}
    if(level>=3&&step%4===3)this.tone(root*4,.045,.015,'square');
    if(level>=4&&step%2===0)this.tone(root*Math.pow(2,[12,19,24,31][step%4]/12),.06,.015,'sawtooth');
  }
  chord(stage){
    if(!this.ensureAudio()||!this.bgmEnabled)return;this.audio.resume?.();
    const level=STAGES.indexOf(stage),root=[110,130.81,146.83,164.81,196][level]||110;
    [0,4,7,12].forEach((semi,i)=>this.tone(root*Math.pow(2,semi/12),.22,.025,'triangle',i*.018));
  }
}
