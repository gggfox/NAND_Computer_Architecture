import type { ReactNode } from "react";

import { m } from "~/i18n/paraglide/messages";
import { FilterChip, SearchField } from "~/shared/ui";

import type { LibraryFilter } from "../domain/library-search";

import styles from "./LibraryPanel.module.css";

const STAR = "★";

interface LibrarySearchProps {
  readonly filter: LibraryFilter;
  readonly onChange: (filter: LibraryFilter) => void;
  /** Every tag in the project, one filter chip each. */
  readonly tags: readonly string[];
}

const toggled = (tags: ReadonlySet<string>, tag: string, on: boolean): ReadonlySet<string> => {
  const next = new Set(tags);
  if (on) {
    next.add(tag);
  } else {
    next.delete(tag);
  }
  return next;
};

/** The search box, then ★ "Starred", then one filter chip per tag. */
export function LibrarySearch({ filter, onChange, tags }: LibrarySearchProps): ReactNode {
  return (
    <>
      <SearchField
        label={m.library_search()}
        value={filter.query}
        onChange={(query) => {
          onChange({ ...filter, query });
        }}
      />
      <div className={styles.filters}>
        <FilterChip
          icon={STAR}
          isSelected={filter.starred}
          onChange={(starred) => {
            onChange({ ...filter, starred });
          }}
        >
          {m.library_filter_starred()}
        </FilterChip>
        {tags.map((tag) => (
          <FilterChip
            key={tag}
            isSelected={filter.tags.has(tag)}
            onChange={(on) => {
              onChange({ ...filter, tags: toggled(filter.tags, tag, on) });
            }}
          >
            {tag}
          </FilterChip>
        ))}
      </div>
    </>
  );
}
