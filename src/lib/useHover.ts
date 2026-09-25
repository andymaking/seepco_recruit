"use client";
import { useState } from "react";

/**
 * Replicates the design's `style-hover` attribute: spread `hoverProps` onto an
 * element and merge `hovered ? hoverStyle : {}` into its style.
 *
 *   const { hovered, hoverProps } = useHover()
 *   <div {...hoverProps} style={{ ...base, ...(hovered ? { background: '#F8FAFC' } : {}) }} />
 */
export function useHover() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    hoverProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
  };
}
