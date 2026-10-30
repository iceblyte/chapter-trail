/**
 * ObsidianIcon — a lucide icon rendered through Obsidian's setIcon,
 * shared by the panel header and the domain-card header buttons so
 * every icon in the panel follows the same mechanism. An optional
 * tooltip attaches Obsidian's own styled hover tooltip (instant,
 * unlike a native title attribute).
 */
import { setIcon, setTooltip } from "obsidian";
import { useEffect, useRef } from "react";

export function ObsidianIcon(props: { name: string; tooltip?: string }): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    setIcon(ref.current, props.name);
  }, [props.name]);

  useEffect(() => {
    if (!ref.current) return;
    if (props.tooltip) setTooltip(ref.current, props.tooltip);
  }, [props.tooltip]);

  return <span ref={ref} className="ct-ob-icon" />;
}
