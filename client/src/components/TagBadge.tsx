import type { Tag } from "../api/types";

// Renders a tag as a colored pill. The tag's stored hex color is used for a
// tinted background/border while keeping text readable in both themes.
export default function TagBadge({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
      style={{
        backgroundColor: `${tag.color}1a`,
        color: tag.color,
        boxShadow: `inset 0 0 0 1px ${tag.color}40`,
      }}
    >
      {tag.icon && <span aria-hidden="true">{tag.icon}</span>}
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full text-current opacity-60 hover:opacity-100"
          aria-label={`Remove ${tag.name} tag`}
        >
          ×
        </button>
      )}
    </span>
  );
}
