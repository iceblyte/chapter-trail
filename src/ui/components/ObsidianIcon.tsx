/**
 * ObsidianIcon — a lucide icon rendered through Obsidian's setIcon,
 * shared by the panel header and the domain-card header buttons so
 * every icon in the panel follows the same mechanism.
 */
import { setIcon } from "obsidian";
import { useEffect, useRef } from "react";

export function ObsidianIcon(props: { name: string }): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    setIcon(ref.current, props.name);
  }, [props.name]);
  return <span ref={ref} className="ct-ob-icon" />;
}
