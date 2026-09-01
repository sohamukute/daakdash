import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useScrollApi } from "./motion";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
};

// "#section" hrefs scroll smoothly within the landing page (releasing the hero lock);
// anything else is a router link.
export function LandingLink({ href, className, children, onNavigate }: Props) {
  const scroll = useScrollApi();
  if (!href.startsWith("#")) {
    return (
      <Link to={href} className={className} onClick={onNavigate}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onNavigate?.();
        scroll.unlock();
        scroll.to(href);
      }}
    >
      {children}
    </a>
  );
}
