import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Colour grade for Ludlein Bay (runs after tone mapping): golden-hour warmth, a bit more
// contrast and saturation, teal shadows, vignette and light film grain.
export function createGradePass() {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float time; uniform float amount; varying vec2 vUv;
      float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        vec3 col = c.rgb;
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        // split toning: teal shadows, warm highlights
        vec3 shadow = vec3(0.86, 0.98, 1.08), high = vec3(1.08, 0.98, 0.86);
        vec3 toned = col * mix(shadow, high, smoothstep(0.15, 0.85, l));
        // saturation + S-curve contrast
        toned = mix(vec3(l), toned, 1.22);
        toned = clamp(toned, 0.0, 1.0);
        toned = toned * toned * (3.0 - 2.0 * toned) * 0.35 + toned * 0.65;
        // vignette + grain
        vec2 d = vUv - 0.5;
        float v = smoothstep(0.85, 0.25, length(d * vec2(1.1, 1.0)));
        toned *= mix(0.72, 1.0, v);
        toned += (rnd(vUv * 900.0) - 0.5) * 0.025;
        gl_FragColor = vec4(mix(col, toned, amount), c.a);
      }`
  });
}
