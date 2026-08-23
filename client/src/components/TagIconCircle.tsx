import type { Tag } from "../api/types";

// Compact colored-circle representation of a tag, used where full pills
// don't fit (e.g. calendar day cells). Shows the tag's icon if set, else
// falls back to its first letter.
export default function TagIconCircle({ tag, size = "sm" }: { tag: Tag; size?: "sm" | "md" }) {
  const dimension = size === "sm" ? "h-4 w-4 text-[9px]" : "h-5 w-5 text-[10px]";
  return (
    <span
      title={tag.name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none text-white ${dimension}`}
      style={{ backgroundColor: tag.color }}
    >
      {tag.icon || tag.name.charAt(0).toUpperCase()}
    </span>
  );
}
