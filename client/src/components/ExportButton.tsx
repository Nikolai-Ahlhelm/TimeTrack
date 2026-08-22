import { api } from "../api/client";
import type { Filters } from "./FilterBar";

export default function ExportButton({ filters }: { filters: Filters }) {
  const href = api.entries.exportCsvUrl({
    from: filters.from || undefined,
    to: filters.to || undefined,
    q: filters.q || undefined,
    sort: filters.sort,
  });

  return (
    <a href={href} download className="btn-secondary inline-flex items-center">
      Export CSV
    </a>
  );
}
