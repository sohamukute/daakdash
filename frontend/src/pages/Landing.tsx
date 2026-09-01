import { useEffect, useRef } from "react";
import { IntroSection } from "@/components/landing/IntroSection";
import { ScrollContext, ScrollTrigger, gsap, prefersReducedMotion, useSmoothScroll } from "@/components/landing/motion";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { WorldHero } from "@/components/landing/WorldHero";
import "@/components/landing/landing.css";

export function Landing() {
  const scroll = useSmoothScroll();
  const rootRef = useRef<HTMLDivElement>(null);

  // scroll reveals: [data-reveal] rises in, [data-split] headings wipe up from a mask
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      gsap.set(reveals, { y: 48, autoAlpha: 0 });
      ScrollTrigger.batch(reveals, {
        start: "top 88%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.08, ease: "power3.out" }),
      });
      gsap.utils.toArray<HTMLElement>("[data-split]").forEach((el) => {
        gsap.fromTo(
          el,
          { yPercent: 18, autoAlpha: 0, clipPath: "inset(0% 0% 100% 0%)" },
          {
            yPercent: 0,
            autoAlpha: 1,
            clipPath: "inset(0% 0% -12% 0%)",
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          },
        );
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <ScrollContext.Provider value={scroll}>
      <div ref={rootRef} className="dd-landing">
        <SiteHeader />
        <main>
          <WorldHero />
          <IntroSection />
          <ServicesSection />
        </main>
        <SiteFooter />
      </div>
    </ScrollContext.Provider>
  );
}
