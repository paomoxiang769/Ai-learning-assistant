"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import type { Geometry } from "ogl";

const MAX_COLORS = 8;

type FlowDirection = "up" | "down" | "left" | "right";

type RGB = [number, number, number];

type Uniform<T> = {
  value: T;
};

type FerrofluidUniforms = {
  iResolution: Uniform<[number, number, number]>;
  iMouse: Uniform<[number, number]>;
  iTime: Uniform<number>;
  uColor0: Uniform<RGB>;
  uColor1: Uniform<RGB>;
  uColor2: Uniform<RGB>;
  uColor3: Uniform<RGB>;
  uColor4: Uniform<RGB>;
  uColor5: Uniform<RGB>;
  uColor6: Uniform<RGB>;
  uColor7: Uniform<RGB>;
  uColorCount: Uniform<number>;
  uMouseColor: Uniform<RGB>;
  uFlow: Uniform<[number, number]>;
  uSpeed: Uniform<number>;
  uScale: Uniform<number>;
  uTurbulence: Uniform<number>;
  uFluidity: Uniform<number>;
  uRimWidth: Uniform<number>;
  uSharpness: Uniform<number>;
  uShimmer: Uniform<number>;
  uGlow: Uniform<number>;
  uOpacity: Uniform<number>;
  uMouseEnabled: Uniform<number>;
  uMouseStrength: Uniform<number>;
  uMouseRadius: Uniform<number>;
};

type FerrofluidProps = {
  className?: string;
  colors?: string[];
  dpr?: number;
  flowDirection?: FlowDirection;
  fluidity?: number;
  glow?: number;
  mixBlendMode?: React.CSSProperties["mixBlendMode"];
  mouseDampening?: number;
  mouseInteraction?: boolean;
  mouseRadius?: number;
  mouseStrength?: number;
  opacity?: number;
  paused?: boolean;
  rimWidth?: number;
  scale?: number;
  sharpness?: number;
  shimmer?: number;
  speed?: number;
  turbulence?: number;
};

function hexToRGB(hex: string): RGB {
  const c = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;

  return [r, g, b];
}

function prepColors(input?: string[]) {
  const base = (input && input.length ? input : ["#ffffff", "#ffffff", "#ffffff"]).slice(
    0,
    MAX_COLORS,
  );
  const count = base.length;
  const arr: RGB[] = [];

  for (let i = 0; i < MAX_COLORS; i += 1) {
    arr.push(hexToRGB(base[Math.min(i, base.length - 1)]));
  }

  const avg: RGB = [0, 0, 0];

  for (let i = 0; i < count; i += 1) {
    avg[0] += arr[i][0];
    avg[1] += arr[i][1];
    avg[2] += arr[i][2];
  }

  avg[0] /= count;
  avg[1] /= count;
  avg[2] /= count;

  return { arr, count, avg };
}

function flowVec(direction: FlowDirection): [number, number] {
  switch (direction) {
    case "up":
      return [0, 1];
    case "left":
      return [-1, 0];
    case "right":
      return [1, 0];
    case "down":
    default:
      return [0, -1];
  }
}

const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
precision highp float;

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

uniform vec3  uMouseColor;
uniform vec2  uFlow;
uniform float uSpeed;
uniform float uScale;
uniform float uTurbulence;
uniform float uFluidity;
uniform float uRimWidth;
uniform float uSharpness;
uniform float uShimmer;
uniform float uGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;

varying vec2 vUv;

#define PI 3.14159265

vec3 palette(float h) {
  int count = uColorCount;
  if (count < 1) count = 1;
  int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
  if (idx <= 0) return uColor0;
  if (idx == 1) return uColor1;
  if (idx == 2) return uColor2;
  if (idx == 3) return uColor3;
  if (idx == 4) return uColor4;
  if (idx == 5) return uColor5;
  if (idx == 6) return uColor6;
  return uColor7;
}

float hash(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float smin(float a, float b, float k) {
  float r = exp2(-a / k) + exp2(-b / k);
  return -k * log2(r);
}

float sinlerp(float a, float b, float w) {
  return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);
}

float vn(vec2 p, float s, float seed) {
  vec2 cellp = floor(p / s);
  vec2 relp = mod(p, s);
  float g1 = hash(vec3(cellp, seed));
  float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed));
  float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed));
  float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed));
  float bx = sinlerp(g1, g2, relp.x / s);
  float tx = sinlerp(g4, g3, relp.x / s);
  return sinlerp(bx, tx, relp.y / s);
}

float dbn(vec2 p, float s, float seed) {
  float o = s / 2.0;
  float n0 = vn(p, s, seed);
  float n1 = vn(p + vec2(o, o), s, seed + 0.1);
  float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
  float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
  float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);
  return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float ref = 700.0 / max(uScale, 0.05);
  vec2 p = fragCoord / iResolution.y * ref;

  float spd = 200.0 * uSpeed;
  float t = iTime;

  vec2 dir = uFlow;
  vec2 perp = vec2(-dir.y, dir.x);

  float distort1 = vn(p + perp * (t * spd), 60.0, 10.0) * 50.0 * uTurbulence;
  float distort2 = vn(p - perp * (t * spd), 120.0, 15.0) * 100.0 * uTurbulence;

  float peaks = dbn(p + distort1 + dir * (t * spd * 0.5), 40.0, 1.0);
  float peaks2 = dbn(p + distort2 - dir * (t * spd * 0.5), 40.0, 0.0);

  float mapeaks = smin(peaks, peaks2, max(uFluidity, 0.001));

  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mp = iMouse / iResolution.y * ref;
    float md = length(p - mp) / ref;
    float rr = max(uMouseRadius, 0.02);
    mGlow = exp(-md * md / (rr * rr)) * uMouseStrength;
  }

  float band = (uRimWidth - abs((mapeaks - 0.4) * 2.0)) * 5.0;
  float ltn = clamp(band - vn(p + dir * (t * spd * 0.5), 60.0, 12.0) * uShimmer, 0.0, 1.0);
  ltn = pow(ltn, uSharpness) * uGlow;
  ltn *= clamp(1.0 - mGlow, 0.0, 1.0);

  float h = clamp(0.5 + (peaks - peaks2) * 0.8, 0.0, 1.0);
  vec3 col = palette(h);

  vec3 outc = col * ltn;
  float a = clamp(max(outc.r, max(outc.g, outc.b)), 0.0, 1.0);
  fragColor = vec4(outc, a * uOpacity);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

function callIfFn(obj: unknown, key: "remove" | "destroy") {
  if (!obj || typeof obj !== "object") {
    return;
  }

  const fn = (obj as Record<string, unknown>)[key];

  if (typeof fn === "function") {
    fn.call(obj);
  }
}

export default function Ferrofluid({
  className,
  colors = ["#ffffff", "#f5f5f5", "#d4d4d4"],
  dpr,
  flowDirection = "down",
  fluidity = 0.1,
  glow = 1.6,
  mixBlendMode,
  mouseDampening = 0.15,
  mouseInteraction = true,
  mouseRadius = 0.35,
  mouseStrength = 0.8,
  opacity = 0.45,
  paused = false,
  rimWidth = 0.18,
  scale = 1.6,
  sharpness = 2.5,
  shimmer = 1.3,
  speed = 0.35,
  turbulence = 0.85,
}: FerrofluidProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const programRef = useRef<Program | null>(null);
  const meshRef = useRef<Mesh<Geometry, Program> | null>(null);
  const geometryRef = useRef<Triangle | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const mouseTargetRef = useRef<[number, number]>([0, 0]);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const renderer = new Renderer({
      alpha: true,
      antialias: true,
      dpr: dpr ?? (window.devicePixelRatio || 1),
    });
    rendererRef.current = renderer;

    const gl = renderer.gl;
    const canvas = gl.canvas;

    gl.clearColor(0, 0, 0, 0);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const { arr, count, avg } = prepColors(colors);
    const uniforms: FerrofluidUniforms = {
      iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
      iMouse: { value: [0, 0] },
      iTime: { value: 0 },
      uColor0: { value: arr[0] },
      uColor1: { value: arr[1] },
      uColor2: { value: arr[2] },
      uColor3: { value: arr[3] },
      uColor4: { value: arr[4] },
      uColor5: { value: arr[5] },
      uColor6: { value: arr[6] },
      uColor7: { value: arr[7] },
      uColorCount: { value: count },
      uMouseColor: { value: avg },
      uFlow: { value: flowVec(flowDirection) },
      uSpeed: { value: speed },
      uScale: { value: scale },
      uTurbulence: { value: turbulence },
      uFluidity: { value: fluidity },
      uRimWidth: { value: rimWidth },
      uSharpness: { value: sharpness },
      uShimmer: { value: shimmer },
      uGlow: { value: glow },
      uOpacity: { value: opacity },
      uMouseEnabled: { value: mouseInteraction ? 1 : 0 },
      uMouseStrength: { value: mouseStrength },
      uMouseRadius: { value: mouseRadius },
    };

    const program = new Program(gl, { fragment, uniforms, vertex });
    const geometry = new Triangle(gl);
    const mesh = new Mesh(gl, { geometry, program });

    programRef.current = program;
    geometryRef.current = geometry;
    meshRef.current = mesh;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];
    };

    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sc = renderer.dpr || 1;
      const x = (event.clientX - rect.left) * sc;
      const y = (rect.height - (event.clientY - rect.top)) * sc;

      mouseTargetRef.current = [x, y];

      if (mouseDampening <= 0) {
        uniforms.iMouse.value = [x, y];
      }
    };

    if (mouseInteraction) {
      canvas.addEventListener("pointermove", onPointerMove);
    }

    const loop = (time: number) => {
      rafRef.current = requestAnimationFrame(loop);
      uniforms.iTime.value = time * 0.001;

      if (mouseDampening > 0) {
        if (!lastTimeRef.current) {
          lastTimeRef.current = time;
        }

        const dt = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;
        const tau = Math.max(0.0001, mouseDampening);
        const factor = Math.min(1, 1 - Math.exp(-dt / tau));
        const target = mouseTargetRef.current;
        const current = uniforms.iMouse.value;

        current[0] += (target[0] - current[0]) * factor;
        current[1] += (target[1] - current[1]) * factor;
      } else {
        lastTimeRef.current = time;
      }

      if (!paused && programRef.current && meshRef.current) {
        renderer.render({ scene: meshRef.current });
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      if (mouseInteraction) {
        canvas.removeEventListener("pointermove", onPointerMove);
      }

      resizeObserver.disconnect();

      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }

      callIfFn(programRef.current, "remove");
      callIfFn(geometryRef.current, "remove");
      callIfFn(meshRef.current, "remove");
      callIfFn(rendererRef.current, "destroy");

      programRef.current = null;
      geometryRef.current = null;
      meshRef.current = null;
      rendererRef.current = null;
    };
  }, [
    colors,
    dpr,
    flowDirection,
    fluidity,
    glow,
    mouseDampening,
    mouseInteraction,
    mouseRadius,
    mouseStrength,
    opacity,
    paused,
    rimWidth,
    scale,
    sharpness,
    shimmer,
    speed,
    turbulence,
  ]);

  return (
    <div
      ref={containerRef}
      className={`ferrofluid-container ${className ?? ""}`}
      style={mixBlendMode ? { mixBlendMode } : undefined}
    />
  );
}
