"use client";

import {
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";

type GlowColor = {
  h: number;
  s: number;
  l: number;
};

type BorderGlowStyle = CSSProperties & Record<`--${string}`, string | number>;

type AnimateValueOptions = {
  start?: number;
  end?: number;
  duration?: number;
  delay?: number;
  ease?: (value: number) => number;
  onUpdate: (value: number) => void;
  onEnd?: () => void;
};

type CachedCardRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PointerMotionState = {
  frameId: number;
  currentAngle: number;
  currentEdge: number;
  targetAngle: number;
  targetEdge: number;
};

export type BorderGlowProps = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "className" | "style"
> & {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  href?: string;
  style?: CSSProperties;
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
  fillOpacity?: number;
};

const GRADIENT_POSITIONS = [
  "80% 55%",
  "69% 34%",
  "8% 6%",
  "41% 38%",
  "86% 85%",
  "82% 18%",
  "51% 4%",
];

const GRADIENT_KEYS = [
  "--gradient-one",
  "--gradient-two",
  "--gradient-three",
  "--gradient-four",
  "--gradient-five",
  "--gradient-six",
  "--gradient-seven",
] as const;

const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];
const HOVER_EDGE_FLOOR = 40;
const POINTER_EASE = 0.18;
const POINTER_SETTLE_THRESHOLD = 0.08;

function parseHSL(hslStr: string): GlowColor {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);

  if (!match) {
    return { h: 242, s: 78, l: 70 };
  }

  return {
    h: Number.parseFloat(match[1]),
    s: Number.parseFloat(match[2]),
    l: Number.parseFloat(match[3]),
  };
}

function buildGlowVars(glowColor: string, intensity: number): BorderGlowStyle {
  const { h, s, l } = parseHSL(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ["", "-60", "-50", "-40", "-30", "-20", "-10"];
  const vars: BorderGlowStyle = {};

  for (let i = 0; i < opacities.length; i += 1) {
    vars[`--glow-color${keys[i]}`] =
      `hsl(${base} / ${Math.min(opacities[i] * intensity, 100)}%)`;
  }

  return vars;
}

function buildGradientVars(colors: string[]): BorderGlowStyle {
  const vars: BorderGlowStyle = {};
  const fallbackColors = colors.length > 0 ? colors : ["#111827", "#737373", "#d4d4d4"];

  for (let i = 0; i < 7; i += 1) {
    const color = fallbackColors[Math.min(COLOR_MAP[i], fallbackColors.length - 1)];
    vars[GRADIENT_KEYS[i]] =
      `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${color} 0px, transparent 50%)`;
  }

  vars["--gradient-base"] = `linear-gradient(${fallbackColors[0]} 0 100%)`;

  return vars;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInCubic(value: number) {
  return value * value * value;
}

function getShortestAngleDelta(currentAngle: number, targetAngle: number) {
  return ((targetAngle - currentAngle + 540) % 360) - 180;
}

function normalizeAngle(angle: number) {
  return (angle + 360) % 360;
}

function animateValue({
  start = 0,
  end = 100,
  duration = 1000,
  delay = 0,
  ease = easeOutCubic,
  onUpdate,
  onEnd,
}: AnimateValueOptions) {
  let frameId = 0;
  const startAt = performance.now() + delay;
  const timeoutId = window.setTimeout(() => {
    function tick() {
      const elapsed = performance.now() - startAt;
      const progress = Math.min(elapsed / duration, 1);

      onUpdate(start + (end - start) * ease(progress));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      } else {
        onEnd?.();
      }
    }

    frameId = window.requestAnimationFrame(tick);
  }, delay);

  return () => {
    window.clearTimeout(timeoutId);
    window.cancelAnimationFrame(frameId);
  };
}

export function BorderGlow({
  children,
  as: Component = "article",
  className = "",
  edgeSensitivity = 28,
  glowColor = "220 9 34",
  backgroundColor = "#ffffff",
  borderRadius = 8,
  glowRadius = 22,
  glowIntensity = 0.42,
  coneSpread = 20,
  animated = true,
  colors = ["#111827", "#737373", "#d4d4d4"],
  fillOpacity = 0.16,
  style: styleProp,
  ...restProps
}: BorderGlowProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const cachedRectRef = useRef<CachedCardRect | null>(null);
  const motionRef = useRef<PointerMotionState>({
    frameId: 0,
    currentAngle: 45,
    currentEdge: 0,
    targetAngle: 45,
    targetEdge: 0,
  });

  const cacheCardRect = useCallback(() => {
    const card = cardRef.current;

    if (!card) {
      return null;
    }

    const rect = card.getBoundingClientRect();
    cachedRectRef.current = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };

    return cachedRectRef.current;
  }, []);

  const getEdgeProximity = useCallback(
    (rect: CachedCardRect, x: number, y: number) => {
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      let kx = Infinity;
      let ky = Infinity;

      if (dx !== 0) {
        kx = cx / Math.abs(dx);
      }

      if (dy !== 0) {
        ky = cy / Math.abs(dy);
      }

      return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    },
    [],
  );

  const getCursorAngle = useCallback(
    (rect: CachedCardRect, x: number, y: number) => {
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = x - cx;
      const dy = y - cy;

      if (dx === 0 && dy === 0) {
        return 0;
      }

      const radians = Math.atan2(dy, dx);
      const degrees = radians * (180 / Math.PI) + 90;

      return degrees < 0 ? degrees + 360 : degrees;
    },
    [],
  );

  const tickPointerMotion = useCallback(() => {
    const card = cardRef.current;
    const motion = motionRef.current;

    if (!card) {
      motion.frameId = 0;
      return;
    }

    const edgeDelta = motion.targetEdge - motion.currentEdge;
    const angleDelta = getShortestAngleDelta(motion.currentAngle, motion.targetAngle);

    motion.currentEdge += edgeDelta * POINTER_EASE;
    motion.currentAngle = normalizeAngle(motion.currentAngle + angleDelta * POINTER_EASE);

    if (
      Math.abs(edgeDelta) < POINTER_SETTLE_THRESHOLD &&
      Math.abs(angleDelta) < POINTER_SETTLE_THRESHOLD
    ) {
      motion.currentEdge = motion.targetEdge;
      motion.currentAngle = motion.targetAngle;
    }

    card.style.setProperty("--edge-proximity", `${motion.currentEdge.toFixed(3)}`);
    card.style.setProperty("--cursor-angle", `${motion.currentAngle.toFixed(3)}deg`);

    if (
      motion.currentEdge !== motion.targetEdge ||
      motion.currentAngle !== motion.targetAngle
    ) {
      motion.frameId = window.requestAnimationFrame(tickPointerMotion);
    } else {
      motion.frameId = 0;
    }
  }, []);

  const startPointerMotion = useCallback(() => {
    const motion = motionRef.current;

    if (motion.frameId === 0) {
      motion.frameId = window.requestAnimationFrame(tickPointerMotion);
    }
  }, [tickPointerMotion]);

  const setPointerTarget = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const rect = cachedRectRef.current ?? cacheCardRect();

      if (!rect) {
        return;
      }

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const edge = getEdgeProximity(rect, x, y) * 100;
      const angle = getCursorAngle(rect, x, y);
      const motion = motionRef.current;

      motion.targetEdge = Math.max(edge, HOVER_EDGE_FLOOR);
      motion.targetAngle = angle;
      startPointerMotion();
    },
    [cacheCardRect, getCursorAngle, getEdgeProximity, startPointerMotion],
  );

  const handlePointerEnter = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const card = cardRef.current;

      if (!card) {
        return;
      }

      card.classList.add("hover-active");
      cacheCardRect();
      setPointerTarget(event);
    },
    [cacheCardRect, setPointerTarget],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      setPointerTarget(event);
    },
    [setPointerTarget],
  );

  const handlePointerLeave = useCallback(() => {
    const card = cardRef.current;
    const motion = motionRef.current;

    cachedRectRef.current = null;
    motion.targetEdge = 0;

    if (card) {
      card.classList.remove("hover-active");
    }

    startPointerMotion();
  }, [startPointerMotion]);

  useEffect(() => {
    const card = cardRef.current;

    if (!animated || !card) {
      return undefined;
    }

    const cleanupCallbacks: Array<() => void> = [];
    const angleStart = 110;
    const angleEnd = 465;

    card.classList.add("sweep-active");
    card.style.setProperty("--cursor-angle", `${angleStart}deg`);

    cleanupCallbacks.push(
      animateValue({
        duration: 420,
        end: 70,
        onUpdate: (value) => card.style.setProperty("--edge-proximity", `${value}`),
      }),
    );
    cleanupCallbacks.push(
      animateValue({
        ease: easeInCubic,
        duration: 850,
        end: 50,
        onUpdate: (value) => {
          card.style.setProperty(
            "--cursor-angle",
            `${(angleEnd - angleStart) * (value / 100) + angleStart}deg`,
          );
        },
      }),
    );
    cleanupCallbacks.push(
      animateValue({
        ease: easeOutCubic,
        delay: 850,
        duration: 800,
        start: 50,
        end: 100,
        onUpdate: (value) => {
          card.style.setProperty(
            "--cursor-angle",
            `${(angleEnd - angleStart) * (value / 100) + angleStart}deg`,
          );
        },
      }),
    );
    cleanupCallbacks.push(
      animateValue({
        ease: easeInCubic,
        delay: 1150,
        duration: 760,
        start: 70,
        end: 0,
        onUpdate: (value) => card.style.setProperty("--edge-proximity", `${value}`),
        onEnd: () => card.classList.remove("sweep-active"),
      }),
    );

    return () => {
      cleanupCallbacks.forEach((cleanup) => cleanup());
      card.classList.remove("sweep-active");
    };
  }, [animated]);

  useEffect(() => {
    return () => {
      const frameId = motionRef.current.frameId;

      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  const style: BorderGlowStyle = {
    ...styleProp,
    "--card-bg": backgroundColor,
    "--edge-sensitivity": edgeSensitivity,
    "--border-radius": `${borderRadius}px`,
    "--glow-padding": `${glowRadius}px`,
    "--cone-spread": coneSpread,
    "--fill-opacity": fillOpacity,
    ...buildGlowVars(glowColor, glowIntensity),
    ...buildGradientVars(colors),
  };

  return (
    <Component
      {...restProps}
      ref={cardRef}
      className={`border-glow-card ${className}`.trim()}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      style={style}
    >
      <span className="edge-light" />
      <div className="border-glow-inner">{children}</div>
    </Component>
  );
}
