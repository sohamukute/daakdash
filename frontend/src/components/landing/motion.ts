import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger, Observer);

export { gsap, Observer, ScrollTrigger };

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type ScrollApi = {
  lock(): void;
  unlock(): void;
  isLocked(): boolean;
  to(target: string | number | HTMLElement, immediate?: boolean): void;
};

export const ScrollContext = createContext<ScrollApi | null>(null);

export function useScrollApi() {
  const api = useContext(ScrollContext);
  if (!api) throw new Error("useScrollApi must be used inside the landing ScrollContext");
  return api;
}

const LOCK_CLASS = "dd-scroll-locked";
const HEADER_OFFSET = -64;

// Lenis smooth scrolling driven by the GSAP ticker so ScrollTrigger stays in sync.
// The hero locks the page while the visitor steps through the 3D scenes; a lock requested
// before Lenis exists (child effects run first) is applied as soon as it is created.
export function useSmoothScroll(): ScrollApi {
  const lenisRef = useRef<Lenis | null>(null);
  const lockedRef = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9 });
    lenisRef.current = lenis;
    if (lockedRef.current) lenis.stop();
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useEffect(() => () => document.documentElement.classList.remove(LOCK_CLASS), []);

  return useMemo<ScrollApi>(
    () => ({
      lock() {
        lockedRef.current = true;
        document.documentElement.classList.add(LOCK_CLASS);
        lenisRef.current?.stop();
      },
      unlock() {
        lockedRef.current = false;
        document.documentElement.classList.remove(LOCK_CLASS);
        lenisRef.current?.start();
      },
      isLocked() {
        return lockedRef.current;
      },
      to(target, immediate = false) {
        const lenis = lenisRef.current;
        if (lenis) {
          lenis.scrollTo(target, { immediate, offset: typeof target === "number" ? 0 : HEADER_OFFSET, duration: 1.2 });
          return;
        }
        const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
        const top = typeof el === "number" ? el : el ? el.getBoundingClientRect().top + window.scrollY + HEADER_OFFSET : 0;
        window.scrollTo({ top, behavior: immediate || prefersReducedMotion() ? "auto" : "smooth" });
      },
    }),
    [],
  );
}
