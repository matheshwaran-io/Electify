"use client";

import * as React from "react";
import { animate, useReducedMotion } from "framer-motion";
import { transition } from "@/lib/motion";

interface AnimatedCounterProps {
  value: number;
}

export function AnimatedCounter({ value }: AnimatedCounterProps) {
  const nodeRef = React.useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    if (reduceMotion) {
      node.textContent = value.toLocaleString();
      return;
    }

    const controls = animate(0, value, {
      ...transition.value,
      onUpdate(v) {
        node.textContent = Math.round(v).toLocaleString();
      },
    });

    return () => controls.stop();
  }, [value, reduceMotion]);

  return <span ref={nodeRef}>0</span>;
}
