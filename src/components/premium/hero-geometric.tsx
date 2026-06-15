"use client";

/* eslint-disable react/no-unknown-property */
import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-namespace */
declare module "react" {
    namespace JSX {
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        interface IntrinsicElements extends ThreeElements { }
    }
}
/* eslint-enable @typescript-eslint/no-namespace */

// --- Shader Code (Simplex noise WebGL background) ---
const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor1;
uniform vec3 uColor2;
varying vec2 vUv;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))
  + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    vec2 uv = vUv;

    // Animated noise
    float noise1 = snoise(uv * 2.0 + vec2(uTime * 0.04, uTime * 0.02)) * 0.3;
    float noise2 = snoise(uv * 3.5 + vec2(-uTime * 0.03, uTime * 0.05)) * 0.15;
    float noise = noise1 + noise2;

    // Smooth diagonal gradient
    float diagonal = (uv.x * 0.6 + uv.y * 0.4);
    float gradient = clamp(diagonal + noise, 0.0, 1.0);

    // Blend colors
    vec3 color = mix(uColor1, uColor2, gradient);

    // Soft radial fade — brighten center
    float radial = 1.0 - length(uv - vec2(0.5, 0.5)) * 0.6;
    color = mix(color, color + vec3(0.04), clamp(radial, 0.0, 1.0));

    // Bottom-left corner white fade
    float cornerFade = smoothstep(0.0, 0.35, length(uv - vec2(0.0, 0.0)));
    color = mix(vec3(1.0), color, cornerFade);

    gl_FragColor = vec4(color, 1.0);
}
`;

// --- Geometric overlay shapes (inspired by the reference) ---
interface GeomShape {
    id: number;
    size: number;
    rotate: number;
    top: string;
    left: string;
    opacity: number;
    duration: number;
    delay: number;
}

const SHAPES: GeomShape[] = [
    { id: 1, size: 600, rotate: 45,  top: "-10%",  left: "65%",  opacity: 0.15, duration: 18, delay: 0 },
    { id: 2, size: 400, rotate: 135, top: "55%",   left: "-5%",  opacity: 0.10, duration: 22, delay: 4 },
    { id: 3, size: 320, rotate: 20,  top: "70%",   left: "70%",  opacity: 0.08, duration: 28, delay: 2 },
    // Shapes 4 & 5 hidden on mobile via className — they clutter small screens
    { id: 4, size: 220, rotate: 60,  top: "15%",   left: "30%",  opacity: 0.06, duration: 20, delay: 8 },
    { id: 5, size: 180, rotate: 80,  top: "40%",   left: "85%",  opacity: 0.09, duration: 25, delay: 6 },
];

// IDs that should only show on larger screens
const DESKTOP_ONLY_SHAPE_IDS = new Set([4, 5]);

function GeometricOverlay({ reducedMotion }: { reducedMotion: boolean }) {
    if (reducedMotion) return null;
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {SHAPES.map((s) => (
                <motion.div
                    key={s.id}
                    className={DESKTOP_ONLY_SHAPE_IDS.has(s.id) ? "hidden md:block absolute border border-current" : "absolute border border-current"}
                    style={{
                        width: s.size,
                        height: s.size,
                        top: s.top,
                        left: s.left,
                        rotate: s.rotate,
                        opacity: s.opacity,
                        color: "rgba(255,255,255,0.8)",
                    }}
                    animate={{
                        rotate: [s.rotate, s.rotate + 360],
                        scale: [1, 1.04, 1],
                    }}
                    transition={{
                        rotate: { duration: s.duration, ease: "linear", repeat: Infinity },
                        scale: { duration: s.duration / 2, ease: "easeInOut", repeat: Infinity, delay: s.delay },
                    }}
                />
            ))}
        </div>
    );
}

// --- WebGL Gradient Plane ---
const GradientPlane = ({
    color1,
    color2,
    speed = 1
}: {
    color1: string;
    color2: string;
    speed?: number
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(1000, 1000) },
            uColor1: { value: new THREE.Color(color1) },
            uColor2: { value: new THREE.Color(color2) },
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [color1, color2]
    );

    useFrame((state) => {
        const { clock, size } = state;
        uniforms.uTime.value = clock.getElapsedTime() * speed;
        uniforms.uResolution.value.set(size.width, size.height);
        uniforms.uColor1.value.set(color1);
        uniforms.uColor2.value.set(color2);
    });

    return (
        <mesh ref={meshRef} scale={[2, 2, 1]}>
            <planeGeometry args={[2, 2]} />
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                transparent={true}
                depthWrite={false}
                depthTest={false}
            />
        </mesh>
    );
};

// --- Main Component ---
interface HeroGeometricProps {
    title1?: string;
    title2?: string;
    description?: string;
    className?: string;
    color1?: string;
    color2?: string;
    speed?: number;
    children?: React.ReactNode;
}

export default function HeroGeometric({
    title1,
    title2,
    description,
    color1 = "#3B82F6",
    color2 = "#F0F9FF",
    speed = 1,
    className,
    children,
}: HeroGeometricProps) {
    const [mounted, setMounted] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        setMounted(true);
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setPrefersReducedMotion(mq.matches);
        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    const hasText = title1 || title2 || description;

    return (
        <div
            className={cn(
                // No containerType:size — it causes 0-height on mobile Safari
                "relative w-full min-h-screen flex flex-col items-center overflow-hidden bg-white dark:bg-slate-950",
                className
            )}
        >
            {/* ── WebGL animated background (skipped if prefers-reduced-motion) ── */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                {mounted && !prefersReducedMotion && (
                    <Canvas
                        camera={{ position: [0, 0, 1] }}
                        // Lower DPR on mobile to save GPU
                        dpr={[1, typeof window !== "undefined" && window.devicePixelRatio > 2 ? 2 : 1.5]}
                        gl={{ antialias: false, alpha: true }}
                    >
                        <GradientPlane color1={color1} color2={color2} speed={speed} />
                    </Canvas>
                )}
                {/* CSS gradient fallback when WebGL is skipped */}
                {(!mounted || prefersReducedMotion) && (
                    <div
                        className="absolute inset-0"
                        style={{ background: `linear-gradient(135deg, ${color1}cc, ${color2}99)` }}
                    />
                )}
            </div>

            {/* ── Geometric overlay shapes ── */}
            <GeometricOverlay reducedMotion={prefersReducedMotion} />

            {/* ── Noise grain overlay ── */}
            <div
                className="absolute inset-0 z-[1] pointer-events-none"
                style={{
                    opacity: 0.025,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* ── Content ── */}
            <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center px-6 py-12 md:py-20">
                <div className="w-full max-w-[1200px] mx-auto flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20">

                    {/* Left / Top: headline */}
                    {hasText && (
                        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-[620px]">

                            {/* Badge */}
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.05, ease: "easeOut" }}
                                className="mb-6 md:mb-8"
                            >
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest border border-white/30 bg-white/20 backdrop-blur-sm text-white/80 dark:text-white/70 dark:border-white/10 dark:bg-white/5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                    Electify Platform
                                </span>
                            </motion.div>

                            {/* Title 1 */}
                            {title1 && (
                                <div className="overflow-hidden mb-1 md:mb-2">
                                    <motion.h1
                                        initial={{ y: "105%", opacity: 0 }}
                                        animate={{ y: "0%", opacity: 1 }}
                                        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                                        className={cn(
                                            "pb-[0.08em] font-bold tracking-tighter leading-[0.96]",
                                            "text-[clamp(2.5rem,10vw,5.5rem)]",
                                            "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                                        )}
                                    >
                                        <span className="italic font-light opacity-90">{title1}</span>
                                    </motion.h1>
                                </div>
                            )}

                            {/* Title 2 */}
                            {title2 && (
                                <div className="overflow-hidden mb-6 md:mb-8">
                                    <motion.h1
                                        initial={{ y: "105%", opacity: 0 }}
                                        animate={{ y: "0%", opacity: 1 }}
                                        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.28 }}
                                        className={cn(
                                            "pb-[0.08em] font-extrabold tracking-tighter leading-[0.96]",
                                            "text-[clamp(2.5rem,10vw,5.5rem)]",
                                            "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                                        )}
                                    >
                                        {title2}
                                    </motion.h1>
                                </div>
                            )}

                            {/* Description */}
                            {description && (
                                <motion.p
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
                                    className="text-sm md:text-base lg:text-lg leading-relaxed text-white/75 dark:text-white/60 font-normal max-w-[480px]"
                                >
                                    {description}
                                </motion.p>
                            )}
                        </div>
                    )}

                    {/* Right / Bottom: form / children */}
                    {children && (
                        <div className="flex-shrink-0 w-full max-w-md">
                            <motion.div
                                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                                className="w-full"
                            >
                                {children}
                            </motion.div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
