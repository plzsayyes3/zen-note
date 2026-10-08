const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function hashCode(value=''){
  let h=0;
  for(let i=0;i<value.length;i++) h=((h<<5)-h+value.charCodeAt(i))|0;
  return Math.abs(h);
}

export class OverdriveController{
  constructor({canvas}){
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d',{alpha:true});
    this.enabled=false;
    this.bgmEnabled=false;
    this.particles=[];
    this.raf=0;
    this.lastFrame=0;
    this.lastDraw=0;
    this.w=innerWidth;
    this.h=innerHeight;
    this.hue=205;
    this.lastHitAt=0;
    this.audio=null;
    this.master=null;
    this.bgmTimer=0;
    this.bgmStep=0;
    this.resize=this.resize.bind(this);
    this.loop=this.loop.bind(this);
    addEventListener('resize',this.resize,{passive:true});
    this.resize();
  }

  setEnabled(value){
    this.enabled=!!value;
    if(!this.enabled){
      this.particles.length=0;
      if(this.raf){cancelAnimationFrame(this.raf);this.raf=0}
      this.ctx.clearRect(0,0,this.w,this.h);
      this.stopBgm();
    }
  }

  setBgmEnabled(value){
    this.bgmEnabled=!!value;
    if(!this.bgmEnabled)this.stopBgm();
  }

  resize(){
    this.w=Math.max(1,innerWidth);
    this.h=Math.max(1,innerHeight);
    this.canvas.width=this.w;
    this.canvas.height=this.h;
    this.canvas.style.width=this.w+'px';
    this.canvas.style.height=this.h+'px';
    this.ctx.setTransform(1,0,0,1,0,0);
  }

  hit(code='',now=Date.now()){
    if(!this.enabled)return;

    this.lastHitAt=now;
    const codeShift=(hashCode(String(code))%19)+7;
    this.hue=(this.hue+codeShift)%360;
    document.documentElement.style.setProperty('--od-hue',String(this.hue));

    const margin=34;
    const x=margin+Math.random()*Math.max(1,this.w-margin*2);
    const y=margin+Math.random()*Math.max(1,this.h-margin*2);
    this.spawnOne(x,y,this.hue);

    if(this.bgmEnabled)this.startBgm();
  }

  sentenceBurst(){}

  spawnOne(x,y,hue){
    const angle=Math.random()*Math.PI*2;
    const speed=18+Math.random()*32;
    const life=.18+Math.random()*.18;
    this.particles.push({
      x,y,px:x,py:y,
      vx:Math.cos(angle)*speed,
      vy:Math.sin(angle)*speed,
      life,max:life,
      r:.9+Math.random()*1.5,
      h:(hue-18+Math.random()*36+360)%360
    });

    if(this.particles.length>36)this.particles.splice(0,this.particles.length-36);
    if(!this.raf){
      this.lastFrame=performance.now();
      this.lastDraw=0;
      this.raf=requestAnimationFrame(this.loop);
    }
  }

  loop(ts){
    if(!this.enabled){this.raf=0;return}

    if(this.lastDraw&&ts-this.lastDraw<33){
      this.raf=requestAnimationFrame(this.loop);
      return;
    }

    const dt=Math.min(.05,(ts-this.lastFrame)/1000||0);
    this.lastFrame=ts;
    this.lastDraw=ts;

    const ctx=this.ctx;
    ctx.clearRect(0,0,this.w,this.h);

    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];
      p.life-=dt;
      if(p.life<=0){this.particles.splice(i,1);continue}

      p.px=p.x;p.py=p.y;
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      p.vx*=.96;p.vy*=.96;

      const alpha=clamp(p.life/p.max,0,1);
      ctx.fillStyle='hsla('+p.h+',100%,76%,'+(alpha*.78)+')';
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r*(.55+alpha*.45),0,Math.PI*2);
      ctx.fill();
    }

    if(this.particles.length){
      this.raf=requestAnimationFrame(this.loop);
    }else{
      ctx.clearRect(0,0,this.w,this.h);
      this.raf=0;
    }
  }

  ensureAudio(){
    if(this.audio)return true;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return false;
    this.audio=new AC();
    this.master=this.audio.createGain();
    this.master.gain.value=.12;
    this.master.connect(this.audio.destination);
    return true;
  }

  tone(freq,duration=.06,gain=.025,type='sine'){
    if(!this.audio||!this.master)return;
    const t=this.audio.currentTime;
    const o=this.audio.createOscillator();
    const g=this.audio.createGain();
    o.type=type;
    o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.006);
    g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(this.master);
    o.start(t);o.stop(t+duration+.02);
  }

  startBgm(){
    if(!this.enabled||!this.bgmEnabled||this.bgmTimer)return;
    if(!this.ensureAudio())return;
    this.audio.resume?.();
    this.bgmStep=0;
    this.bgmTimer=setInterval(()=>{
      if(!this.enabled||!this.bgmEnabled||Date.now()-this.lastHitAt>2500){
        this.stopBgm();
        return;
      }
      const roots=[55,65.41,73.42,82.41];
      const root=roots[this.bgmStep%roots.length];
      if(this.bgmStep%2===0)this.tone(root,.08,.022,'sine');
      this.bgmStep++;
    },220);
  }

  stopBgm(){
    if(this.bgmTimer){
      clearInterval(this.bgmTimer);
      this.bgmTimer=0;
    }
  }
}
