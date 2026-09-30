import type { CSSProperties, ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Lift on hover (default). Disable inside tilt containers. */
  hover?: boolean;
  as?: "div" | "section" | "li" | "article";
};

/** Floating glassmorphism card — layered soft shadows, blur, translucent border. */
export function GlassCard({
  children,
  className = "",
  style,
  hover = true,
  as: Tag = "div",
}: GlassCardProps) {
  return (
    <Tag className={`glass-card ${hover ? "glass-card-hover" : ""} ${className}`} style={style}>
      {children}
    </Tag>
  );
}
