const PALETTE = [
  [248,252,255],
  [83,226,255],
  [255,92,207],
  [255,224,92]
];

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

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

  hit(_code='',now=Date.now()){
    if(!this.enabled)return;
    this.lastHitAt=now;

    const margin=34;
    const x=margin+Math.random()*Math.max(1,this.w-margin*2);
    const y=margin+Math.random()*Math.max(1,this.h-margin*2);
    const count=4+Math.floor(Math.random()*3);
    this.spawnBurst(x,y,count);

    if(this.bgmEnabled)this.startBgm();
  }

  sentenceBurst(){}

  spawnBurst(x,y,count){
    for(let i=0;i<count;i++){
      const angle=Math.random()*Math.PI*2;
      const speed=34+Math.random()*74;
      const life=.14+Math.random()*.16;
      const color=PALETTE[Math.floor(Math.random()*PALETTE.length)];

      this.particles.push({
        x,y,
        vx:Math.cos(angle)*speed,
        vy:Math.sin(angle)*speed,
        life,max:life,
        r:1.4+Math.random()*2.4,
        color
      });
    }

    if(this.particles.length>84)this.particles.splice(0,this.particles.length-84);

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
    ctx.save();
    ctx.globalCompositeOperation='lighter';

    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];
      p.life-=dt;
      if(p.life<=0){this.particles.splice(i,1);continue}

      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
      p.vx*=.94;
      p.vy*=.94;

      const alpha=clamp(p.life/p.max,0,1);
      const [r,g,b]=p.color;

      ctx.fillStyle='rgba('+r+','+g+','+b+','+(alpha*.94)+')';
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r*(.7+alpha*.3),0,Math.PI*2);
      ctx.fill();

      if(alpha>.55){
        ctx.fillStyle='rgba(255,255,255,'+((alpha-.55)*.72)+')';
        ctx.beginPath();
        ctx.arc(p.x,p.y,Math.max(.65,p.r*.38),0,Math.PI*2);
        ctx.fill();
      }
    }

    ctx.restore();

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
