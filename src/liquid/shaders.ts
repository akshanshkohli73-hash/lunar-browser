export const vertexShader = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
void main(){vUv=vec2(aPosition.x,1.0-aPosition.y);gl_Position=vec4(aPosition*2.0-1.0,0.0,1.0);}
`;
export const fragmentShader = `#version 300 es
precision highp float;
uniform sampler2D uBackground;
uniform vec4 uRect;
uniform vec4 uScene;
uniform vec4 uRadii;
uniform vec4 uMaterial; // opacity, blur, saturation, refraction
uniform vec4 uOptics; // curvature, edge lensing, specular, border
uniform vec3 uTint;
uniform vec3 uDeform; // bend x/y, press
uniform vec2 uPointer;
uniform float uDark;
uniform float uReflection;
uniform float uElasticity;
uniform float uShade;
uniform float uBackgroundBlur;
uniform float uSamples;
uniform float uView;
uniform float uContain;
in vec2 vUv;
out vec4 fragColor;
float shape(vec2 p, vec2 halfSize){
  float radius=p.x>0.0?(p.y>0.0?uRadii.z:uRadii.y):(p.y>0.0?uRadii.w:uRadii.x);
  radius=min(radius,min(halfSize.x,halfSize.y));
  vec2 q=abs(p)-halfSize+radius;
  return min(max(q.x,q.y),0.0)+length(max(q,0.0))-radius;
}
vec3 background(vec2 world){
  vec2 uv=(world-uScene.xy)/max(vec2(1.0),uScene.zw);
  if(uContain>0.5 && (min(uv.x,uv.y)<0.0 || max(uv.x,uv.y)>1.0))return mix(vec3(0.94,0.97,0.92),vec3(0.08,0.16,0.13),uDark);
  vec2 stepUV=vec2(max(uMaterial.y+uBackgroundBlur,0.0))/max(vec2(1.0),uScene.zw)*0.36;
  vec3 color=texture(uBackground,clamp(uv,0.0,1.0)).rgb;
  if(stepUV.x>0.00001){
    vec3 axes=texture(uBackground,clamp(uv+vec2(stepUV.x,0.0),0.0,1.0)).rgb+texture(uBackground,clamp(uv-vec2(stepUV.x,0.0),0.0,1.0)).rgb+texture(uBackground,clamp(uv+vec2(0.0,stepUV.y),0.0,1.0)).rgb+texture(uBackground,clamp(uv-vec2(0.0,stepUV.y),0.0,1.0)).rgb;
    if(uSamples<8.0)color=(color*2.0+axes)/6.0;
    else{
      vec3 diagonals=texture(uBackground,clamp(uv+stepUV,0.0,1.0)).rgb+texture(uBackground,clamp(uv-stepUV,0.0,1.0)).rgb+texture(uBackground,clamp(uv+vec2(stepUV.x,-stepUV.y),0.0,1.0)).rgb+texture(uBackground,clamp(uv+vec2(-stepUV.x,stepUV.y),0.0,1.0)).rgb;
      color=color*0.25+axes*0.125+diagonals*0.0625;
      if(uSamples>10.0){vec2 f=stepUV*1.75;vec3 farAxes=texture(uBackground,clamp(uv+vec2(f.x,0.0),0.0,1.0)).rgb+texture(uBackground,clamp(uv-vec2(f.x,0.0),0.0,1.0)).rgb+texture(uBackground,clamp(uv+vec2(0.0,f.y),0.0,1.0)).rgb+texture(uBackground,clamp(uv-vec2(0.0,f.y),0.0,1.0)).rgb;color=color*0.8+farAxes*0.05;}
    }
  }
  return color*(1.0-uShade);
}
void main(){
  vec2 size=uRect.zw, p=(vUv-0.5)*size;
  vec2 normalized=p/max(size*0.5,vec2(1.0));
  float edgeBand=1.0-smoothstep(0.35,1.0,1.0-max(abs(normalized.x),abs(normalized.y)));
  vec2 bent=p-uDeform.xy*uElasticity*5.0*edgeBand*(1.0-normalized*normalized);
  bent/=vec2(1.0+uDeform.z*uElasticity*min(0.018,2.0/max(size.x,1.0)),1.0-uDeform.z*uElasticity*0.035);
  vec2 halfSize=max(vec2(1.0),size*0.5-1.2);
  float distance=shape(bent,halfSize);
  float coverage=1.0-smoothstep(-0.7,0.7,distance);
  if(coverage<=0.0){fragColor=vec4(0.0);return;}
  float edge=1.0-smoothstep(0.0,max(7.0,min(size.x,size.y)*0.18),-distance);
  vec2 gradient=vec2(shape(bent+vec2(0.75,0.0),halfSize)-shape(bent-vec2(0.75,0.0),halfSize),shape(bent+vec2(0.0,0.75),halfSize)-shape(bent-vec2(0.0,0.75),halfSize));
  vec2 outward=gradient/max(length(gradient),0.001);
  vec2 slope=outward*edge*(0.4+uOptics.x*2.2)+normalized*uOptics.x*0.2;
  vec3 normal=normalize(vec3(slope,1.0));
  vec2 world=uRect.xy+vUv*size;
  float centerCurve=dot(normalized,normalized)*0.22*uOptics.x;
  vec2 lens=outward*pow(edge,1.7)*uOptics.y+normalized*centerCurve;
  vec2 displacement=lens*uMaterial.w*(14.0+uOptics.x*64.0);
  if(uView>0.5)displacement=vec2(0.0);
  vec3 color=background(world+displacement);
  if(uView<0.5){
    float luminance=dot(color,vec3(0.2126,0.7152,0.0722));
    color=mix(vec3(luminance),color,uMaterial.z);
    vec3 paper=mix(vec3(0.945,0.969,0.918),vec3(0.086,0.18,0.153),uDark);
    float wash=clamp((uMaterial.x-0.6)/0.4,0.0,1.0);
    color=mix(color,mix(paper,uTint,0.06),0.10+wash*wash*0.90);
    // Bound text contrast even over bright/dark video flashes; no random theme changes.
    luminance=dot(color,vec3(0.2126,0.7152,0.0722));
    if(uDark>0.5)color*=min(1.0,0.28/max(luminance,0.001));
    else color=mix(color,paper,clamp((0.60-luminance)/max(0.001,dot(paper,vec3(0.2126,0.7152,0.0722))-luminance),0.0,1.0));
    vec3 light=normalize(vec3(vec2(-0.4,-0.65)+uPointer*0.45,0.8));
    vec3 halfway=normalize(light+vec3(0.0,0.0,1.0));
    float spec=pow(max(dot(normal,halfway),0.0),58.0);
    float fresnel=pow(1.0-normal.z,2.5);
    float rim=(spec*0.28+fresnel*0.16)*uOptics.z*uReflection;
    rim+=fresnel*uOptics.w*0.045;
    color+=mix(vec3(0.96,1.0,0.91),uTint,0.25)*rim;
    color=clamp(color,0.0,1.0);
  }
  fragColor=vec4(color*coverage,coverage);
}
`;
