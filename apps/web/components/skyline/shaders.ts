// A single full-screen draw combines four registered views of the city.
export const skylineVertex = /* glsl */ `
  uniform vec2 uExtent;
  uniform float uScroll;
  uniform float uStreet;
  varying vec2 vScreen;
  varying vec2 vHills;
  varying vec2 vCity;
  varying vec2 vRoofs;
  vec2 layerUv(vec2 point, float depth) {
    float zoom = mix(1.0, projectionMatrix[0][0] * 1.14, depth);
    vec2 pan = -viewMatrix[3].xy * depth;
    return vec2(.59,.32) * (1.0-uExtent) + ((point-.5)/zoom + .5 + pan)*uExtent;
  }
  void main() {
    vScreen = uv;
    vHills = layerUv(uv,.08);
    vCity = layerUv(uv,.58);
    vRoofs = layerUv(uv,1.0);
    gl_Position = vec4(position.xy,0.0,1.0);
  }
`;

export const skylineFragment = /* glsl */ `
  uniform sampler2D uHills, uCity, uRoofs, uStreetImage;
  uniform vec2 uSize, uPointer;
  uniform float uHeat, uScroll, uStreet, uPhase, uTravel, uStreetAspect;
  varying vec2 vScreen, vHills, vCity, vRoofs;
  const vec3 navy = vec3(10.,26.,44.) / 255.;
  const vec3 gold = vec3(201.,167.,123.) / 255.;
  vec3 atmosphere(float height) {
    float horizon = smoothstep(.12,.95,1.-height+.28*uScroll);
    return mix(navy,gold,.34*horizon);
  }
  vec3 edgeInk(float offset) {
    float glow = .5+.5*cos(6.28318*(uPhase+offset));
    return mix(gold,vec3(.96,.90,.83),glow*.66);
  }
  void main() {
    vec3 air = atmosphere(vScreen.y);
    vec3 hills = texture2D(uHills,vHills).rgb;
    vec4 city = texture2D(uCity,vCity);
    vec4 roofs = texture2D(uRoofs,vRoofs);
    if (abs(uTravel) > .0001)
      roofs = mix(roofs,texture2D(uRoofs,vRoofs-vec2(uTravel,0.0)),.22);
    float outline = smoothstep(.07,.2,city.r-city.b) * smoothstep(.65,.88,city.r);
    city.rgb = mix(city.rgb,edgeInk(floor(vCity.x*52.0)*.091),outline*.91);
    vec3 panorama = mix(hills,air,.27+.25*uScroll);
    panorama = mix(panorama,city.rgb+air*.08,city.a);
    panorama = mix(panorama,mix(roofs.rgb,air,.13),roofs.a);
    float streetRatio = uSize.x/uSize.y/uStreetAspect;
    vec2 crop = vec2(min(1.0,streetRatio),min(1.0,1.0/streetRatio));
    vec2 streetUv = vec2(.53,.46)*(1.0-crop) + ((vScreen-.5)/mix(1.12,1.0,uStreet)+.5)*crop;
    vec3 street = texture2D(uStreetImage,streetUv).rgb;
    vec3 color = mix(panorama,mix(street,air,.09),uStreet);
    float radius = clamp(uSize.x*.14,105.0,210.0);
    float halo = 1.0-smoothstep(0.0,radius,length((vScreen-uPointer)*uSize));
    float surface = mix(.10 + .90*max(city.a,roofs.a),.88,uStreet);
    float luminance = dot(color,vec3(.25,.60,.15));
    vec3 highlight = gold * (.80 + luminance * .60);
    gl_FragColor = vec4(mix(color,highlight,halo*uHeat*surface*.88),1.0);
  }
`;
