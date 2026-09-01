import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Plus, X } from "lucide-react";
import { useT } from "@/context/LanguageContext";
import { cn } from "@/lib/cn";
import { FILM_DURATION, FILM_FPS, FILM_SCENES, FILM_SOURCES } from "./heroFilm";
import { LandingLink } from "./LandingLink";
import { Observer, ScrollTrigger, gsap, prefersReducedMotion, useScrollApi } from "./motion";

type Direction = "down" | "up";
type Cover = { x: number; y: number; w: number; h: number; vw: number; vh: number };
type Reel = "fwd" | "rev";
/** one stretch of film to play: on the forward or the reversed cut, from..to in that cut's time */
type Segment = { reel: Reel; from: number; to: number };

const LAST = FILM_SCENES.length - 1;
// jump back a little before the hold ends so the media clock never shows the next flight
const LOOP_GUARD = 0.06;
const SEG_GUARD = 0.03;
const reverseTime = (t: number) => FILM_DURATION - 1 / FILM_FPS - t;

// Camera flights between scene a and scene b, as segments. Forward flights chain without cuts:
// the frame at the end of a hold equals its first frame (every motion in a hold is periodic),
// so after arriving at scene h the film can jump to the end of h's hold and fly on. Going back
// plays the same flights on a reversed cut of the film.
function flightPlan(from: number, to: number): Segment[] {
  const plan: Segment[] = [];
  if (to > from) {
    for (let h = from + 1; h <= to; h += 1) {
      const scene = FILM_SCENES[h];
      plan.push({ reel: "fwd", from: scene.flightFrom ?? scene.start, to: scene.start });
    }
  } else {
    for (let h = from; h > to; h -= 1) {
      const scene = FILM_SCENES[h];
      plan.push({ reel: "rev", from: reverseTime(scene.start), to: reverseTime(scene.flightFrom ?? scene.start) });
    }
  }
  return plan;
}

// Full-screen 3D world: one pre-rendered film (plus its reversed cut), five scenes. Scrolling
// (wheel, swipe, keys) steps through the scenes while the page is locked; the camera flies to the
// next scene, then that scene loops seamlessly. Past the last scene the page scrolls normally.
export function WorldHero() {
  const { t } = useT();
  const scroll = useScrollApi();
  const reduced = useMemo(prefersReducedMotion, []);
  const small = useMemo(() => window.innerWidth <= 900, []);

  const rootRef = useRef<HTMLElement>(null);
  const fwdRef = useRef<HTMLVideoElement>(null);
  const revRef = useRef<HTMLVideoElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const st = useRef({ step: 0, animating: false, atTop: true });
  const reel = useRef<{ queue: Segment[]; current: Segment | null; rate: number }>({ queue: [], current: null, rate: 1 });

  const [active, setActive] = useState(0);
  const [settled, setSettled] = useState(true);
  const [openSpot, setOpenSpot] = useState<number | null>(null);
  const [cover, setCover] = useState<Cover | null>(null);

  // map normalised film coordinates onto the object-fit: cover video box
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const vw = root.clientWidth;
      const vh = root.clientHeight;
      const s = Math.max(vw / FILM_SOURCES.width, vh / FILM_SOURCES.height);
      const w = FILM_SOURCES.width * s;
      const h = FILM_SOURCES.height * s;
      setCover({ x: (vw - w) * FILM_SOURCES.focusX, y: (vh - h) / 2, w, h, vw, vh });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const fwdEl = fwdRef.current;
    const revEl = revRef.current;
    const root = rootRef.current;
    if (!fwdEl || !revEl || !root) return;
    const fwd: HTMLVideoElement = fwdEl;
    const rev: HTMLVideoElement = revEl;
    const s = st.current;
    const r = reel.current;
    const layers = layerRefs.current;
    let cardTimeline: gsap.core.Timeline | null = null;
    let onFlightDone: (() => void) | null = null;
    let disposed = false;

    gsap.set(layers, { yPercent: 100, autoAlpha: 0 });
    gsap.set(layers[0], { yPercent: 0, autoAlpha: 1 });

    const video = (which: Reel) => (which === "fwd" ? fwd : rev);
    const show = (which: Reel) => {
      fwd.style.opacity = which === "fwd" ? "1" : "0";
      rev.style.opacity = which === "rev" ? "1" : "0";
      video(which === "fwd" ? "rev" : "fwd").pause();
    };

    // seek, wait for the frame, then reveal and play: the visible reel holds its last frame meanwhile
    function start(seg: Segment) {
      const v = video(seg.reel);
      r.current = seg;
      v.playbackRate = r.rate;
      let done = false;
      const go = () => {
        if (done || disposed || r.current !== seg) return;
        done = true;
        show(seg.reel);
        if (!reduced) void v.play().catch(() => undefined);
      };
      v.addEventListener("seeked", go, { once: true });
      window.setTimeout(go, 350);
      v.currentTime = seg.from;
    }

    function advance() {
      const next = r.queue.shift();
      if (next) {
        start(next);
        return;
      }
      const ended = r.current;
      r.current = null;
      r.rate = 1;
      fwd.playbackRate = 1;
      // the reversed cut ends on the hold's first frame; continue the hold on the forward cut
      if (ended?.reel === "rev") start({ reel: "fwd", from: FILM_SCENES[s.step].start, to: Infinity });
      onFlightDone?.();
      onFlightDone = null;
    }

    let raf = 0;
    const tick = () => {
      const seg = r.current;
      if (seg && seg.to !== Infinity) {
        const v = video(seg.reel);
        if (!v.seeking && v.currentTime >= seg.to - SEG_GUARD) advance();
      } else if (!reduced && !fwd.paused) {
        const scene = FILM_SCENES[s.step];
        if (fwd.currentTime >= scene.end - LOOP_GUARD || fwd.currentTime < scene.start - 0.5) fwd.currentTime = scene.start;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    function fly(from: number, to: number, done: () => void) {
      const scene = FILM_SCENES[to];
      if (reduced) {
        fwd.pause();
        show("fwd");
        fwd.currentTime = scene.start + 0.5;
        done();
        return;
      }
      const plan = flightPlan(from, to);
      if (plan[0].reel === "rev" && rev.readyState < 2) {
        // reversed cut not loaded yet: cut to the scene, softened by a quick wash
        r.queue = [];
        start({ reel: "fwd", from: scene.start, to: Infinity });
        gsap.fromTo(flashRef.current, { opacity: 0.55 }, { opacity: 0, duration: 0.6, ease: "power2.out" });
        done();
        return;
      }
      r.rate = plan.length > 1 ? 2 : 1;
      r.queue = plan.slice(1);
      onFlightDone = done;
      start(plan[0]);
    }

    function setScene(index: number) {
      s.step = index;
      setActive(index);
      gsap.set(layers, { yPercent: 100, autoAlpha: 0 });
      gsap.set(layers[index], { yPercent: 0, autoAlpha: 1 });
      r.queue = [];
      start({ reel: "fwd", from: FILM_SCENES[index].start + (reduced ? 0.5 : 0), to: Infinity });
    }

    function animate(next: number, direction: Direction) {
      if (s.animating || next === s.step || next < 0 || next > LAST) return;
      s.animating = true;
      if (!reduced) scroll.lock();
      setOpenSpot(null);
      setSettled(false);
      setActive(next);
      const from = s.step;
      const current = layers[from];
      const incoming = layers[next];
      s.step = next;
      let cardDone = false;
      let flightDone = false;
      const finish = () => {
        if (!cardDone || !flightDone || disposed) return;
        s.animating = false;
        setSettled(true);
        if (next === LAST) scroll.unlock();
      };
      fly(from, next, () => {
        flightDone = true;
        finish();
      });
      cardTimeline = gsap
        .timeline({
          defaults: { duration: reduced ? 0 : 1, ease: "power3.inOut" },
          onComplete() {
            cardDone = true;
            finish();
          },
        })
        .fromTo(current, { yPercent: 0, autoAlpha: 1 }, { yPercent: direction === "down" ? -100 : 100, autoAlpha: 0 })
        .fromTo(incoming, { yPercent: direction === "down" ? 100 : -100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1 }, "<");
    }

    function forward() {
      if (s.animating || !s.atTop) return;
      if (s.step >= LAST) {
        // locked again after scrolling back up to the top: let the page continue
        if (scroll.isLocked()) {
          scroll.unlock();
          scroll.to("#intro");
        }
        return;
      }
      animate(s.step + 1, "down");
    }

    function back() {
      if (s.animating || s.step <= 0 || !s.atTop) return;
      animate(s.step - 1, "up");
    }

    const jumpTo = (event: Event) => {
      const index = (event as CustomEvent<number>).detail;
      animate(index, index > s.step ? "down" : "up");
    };
    root.addEventListener("dd:scene", jumpTo);

    // the reversed cut is only needed for going back; fetch it once the forward film can play
    const loadReverse = () => {
      if (!rev.src) {
        rev.src = small ? FILM_SOURCES.sdReverse : FILM_SOURCES.hdReverse;
        rev.load();
      }
    };
    if (!reduced) fwd.addEventListener("canplaythrough", loadReverse, { once: true });

    const restored = window.scrollY > 4;
    if (restored) {
      // back/forward or a #hash landed below the hero: start on the last scene, unlocked
      s.atTop = false;
      setScene(LAST);
    } else {
      setScene(0);
    }

    const cleanups: (() => void)[] = [];
    if (!reduced) {
      const observer = Observer.create({
        target: window,
        type: "wheel,touch",
        wheelSpeed: -1,
        tolerance: 10,
        // hotspot cards keep their own wheel/touch so reading one never changes the scene
        onUp(self) {
          if (!(self.event.target as Element | null)?.closest?.("[data-hero-spot]")) forward();
        },
        onDown(self) {
          if (!(self.event.target as Element | null)?.closest?.("[data-hero-spot]")) back();
        },
      });
      const onKey = (event: KeyboardEvent) => {
        if (!s.atTop || !scroll.isLocked()) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest("input, textarea, select, [role='group']")) return;
        if (["ArrowDown", "PageDown", " "].includes(event.key)) {
          event.preventDefault();
          forward();
        } else if (["ArrowUp", "PageUp"].includes(event.key)) {
          event.preventDefault();
          back();
        }
      };
      window.addEventListener("keydown", onKey);
      const trigger = ScrollTrigger.create({
        trigger: root,
        start: "top top",
        end: "4px top",
        onLeave() {
          s.atTop = false;
        },
        onEnterBack() {
          s.atTop = true;
          scroll.to(0, true);
          scroll.lock();
        },
      });
      const lockRaf = requestAnimationFrame(() => {
        if (!restored) {
          scroll.to(0, true);
          scroll.lock();
        }
      });
      cleanups.push(() => {
        cancelAnimationFrame(lockRaf);
        observer.kill();
        trigger.kill();
        window.removeEventListener("keydown", onKey);
      });
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
      cardTimeline?.kill();
      gsap.killTweensOf(flashRef.current);
      r.queue = [];
      r.current = null;
      fwd.removeEventListener("canplaythrough", loadReverse);
      root.removeEventListener("dd:scene", jumpTo);
      s.animating = false;
      scroll.unlock();
    };
  }, [reduced, scroll, small]);

  function selectScene(index: number) {
    rootRef.current?.dispatchEvent(new CustomEvent("dd:scene", { detail: index }));
  }

  const scene = FILM_SCENES[active];
  const spots = cover
    ? scene.spots
        .map((spot, index) => ({ ...spot, index, left: cover.x + spot.x * cover.w, top: cover.y + spot.y * cover.h }))
        .filter((spot) => {
          if (spot.left < 24 || spot.left > cover.vw - 24 || spot.top < 88 || spot.top > cover.vh - 140) return false;
          // never under the scene card: full-width on phones, bottom-left column on wider screens
          return cover.vw < 640 ? spot.top < cover.vh - 430 : !(spot.left < 540 && spot.top > cover.vh - 480);
        })
    : [];

  return (
    <section ref={rootRef} className="dd-hero relative h-[100svh] min-h-[560px] w-full overflow-clip bg-dd-sand" aria-label={t("The DaakDash network in 3D")}>
      <video
        ref={fwdRef}
        style={{ objectPosition: `${FILM_SOURCES.focusX * 100}% 50%` }}
        className="absolute inset-0 h-full w-full object-cover"
        src={small ? FILM_SOURCES.sd : FILM_SOURCES.hd}
        poster={FILM_SOURCES.poster}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      />
      <video
        ref={revRef}
        style={{ objectPosition: `${FILM_SOURCES.focusX * 100}% 50%` }}
        className="absolute inset-0 h-full w-full object-cover opacity-0"
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      />
      <div ref={flashRef} className="pointer-events-none absolute inset-0 bg-dd-stone opacity-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-dd-ink/25 to-transparent" aria-hidden="true" />

      {/* hotspots */}
      <div className={cn("absolute inset-0 transition-opacity duration-500", settled ? "opacity-100" : "pointer-events-none opacity-0")}>
        {spots.map((spot) => {
          const open = openSpot === spot.index;
          const flip = spot.left > (cover?.vw ?? 0) - 320;
          return (
            <div key={`${scene.key}-${spot.index}`} className="absolute" style={{ left: spot.left, top: spot.top }} data-hero-spot>
              <button
                type="button"
                className={cn("dd-hotspot", open && "is-open")}
                aria-expanded={open}
                aria-label={open ? t("Close") : t(spot.title)}
                onClick={() => setOpenSpot(open ? null : spot.index)}
              >
                {open ? <X size={16} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
              </button>
              {open && (
                <div className={cn("dd-spot-card", flip && "is-flipped")} role="dialog" aria-label={t(spot.title)}>
                  <p className="text-[15px] font-medium text-dd-ink">{t(spot.title)}</p>
                  <p className="mt-1.5 text-[13px] leading-snug text-dd-ink/70">{t(spot.body)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* scene cards */}
      {FILM_SCENES.map((item, index) => {
        const Heading = index === 0 ? "h1" : "h2";
        return (
          <div
            key={item.key}
            ref={(el) => {
              layerRefs.current[index] = el;
            }}
            className="pointer-events-none absolute inset-0"
            style={{ visibility: index === 0 ? "inherit" : "hidden" }}
            aria-hidden={index !== active}
          >
            <div className="absolute bottom-[112px] left-4 right-4 sm:left-6 sm:right-auto md:bottom-[124px] lg:left-8">
              <div className="dd-glass pointer-events-auto w-full max-w-[460px] rounded-md p-5 sm:p-7">
                <Heading className="text-[30px] font-normal leading-[1.02] tracking-[-0.02em] text-dd-ink sm:text-[40px] lg:text-[44px]">
                  {t(item.title)}
                </Heading>
                <p className="mt-4 max-w-[380px] text-[14px] leading-[1.45] text-dd-ink/80 sm:text-[15px]">{t(item.body)}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <LandingLink href={item.primary.href} className="dd-pill dd-pill--solid">
                    {t(item.primary.label)}
                    <span className="dd-pill-arrow"><ArrowRight size={14} aria-hidden="true" /></span>
                  </LandingLink>
                  <LandingLink href={item.secondary.href} className="dd-pill">
                    {t(item.secondary.label)}
                  </LandingLink>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* numbered scene picker */}
      <div className="absolute inset-x-4 bottom-5 sm:inset-x-6 lg:inset-x-8">
        <div className="relative mb-3 hidden h-px bg-white/70 sm:block" aria-hidden="true">
          <div
            className="absolute inset-y-0 left-0 bg-dd-red transition-[width] duration-1000 ease-[cubic-bezier(.65,0,.35,1)]"
            style={{ width: `${(active / LAST) * 100}%` }}
          />
          {FILM_SCENES.map((item, index) => (
            <span
              key={item.key}
              className={cn("absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full", index <= active ? "bg-dd-red" : "bg-white")}
              style={{ left: `${(index / LAST) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex gap-1.5 sm:gap-2" role="group" aria-label={t("Explore our services")}>
            {FILM_SCENES.map((item, index) => {
              const Icon = item.icon;
              const isActive = index === active;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`${String(index + 1).padStart(2, "0")} ${t(item.label)}`}
                  onClick={() => selectScene(index)}
                  className={cn("dd-scene-pill", isActive && "is-active")}
                >
                  <span className="dd-scene-num">{String(index + 1).padStart(2, "0")}</span>
                  <span className="dd-scene-icon"><Icon size={15} strokeWidth={1.8} aria-hidden="true" /></span>
                  <span className="dd-scene-label">{t(item.label)}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <LandingLink href="#services" className="dd-pill dd-pill--solid hidden sm:inline-flex">
              {t("All services")}
              <span className="dd-pill-arrow"><ArrowRight size={14} aria-hidden="true" /></span>
            </LandingLink>
          </div>
        </div>
      </div>
    </section>
  );
}
