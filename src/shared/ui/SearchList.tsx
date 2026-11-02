import type { ReactNode } from "react";
import { Autocomplete, Header, ListBox, ListBoxItem, ListBoxSection } from "react-aria-components";

import type { MenuEntry } from "./PointMenu";
import { SearchField } from "./SearchField";

import styles from "./SearchList.module.css";

export interface ListSection {
  readonly id: string;
  /** The section's heading; leave out for a section with none. */
  readonly title?: string | undefined;
  readonly entries: readonly MenuEntry[];
}

interface SearchListProps {
  /** Names the list. */
  readonly label: string;
  readonly searchLabel: string;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly sections: readonly ListSection[];
  readonly onAction: (id: string) => void;
}

function Section({ section }: { readonly section: ListSection }): ReactNode {
  return (
    <ListBoxSection
      id={section.id}
      className={styles.section}
      {...(section.title === undefined ? {} : { "aria-label": section.title })}
    >
      {section.title === undefined ? undefined : (
        <Header className={styles.header}>{section.title}</Header>
      )}
      {section.entries.map((entry) => (
        <ListBoxItem key={entry.id} id={entry.id} textValue={entry.label} className={styles.item}>
          {entry.label}
        </ListBoxItem>
      ))}
    </ListBoxSection>
  );
}

/**
 * A search field over a list, as in a command palette: focus stays in the field, the arrow keys
 * move through the list and Enter picks. The caller does the filtering, from `query`.
 */
export function SearchList({
  label,
  searchLabel,
  query,
  onQueryChange,
  sections,
  onAction,
}: Readonly<SearchListProps>): ReactNode {
  return (
    <Autocomplete inputValue={query} onInputChange={onQueryChange}>
      <div className={styles.search}>
        <SearchField
          label={searchLabel}
          value={query}
          onChange={onQueryChange}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- a just-opened search popover puts focus in its field
          autoFocus
        />
      </div>
      <ListBox
        aria-label={label}
        className={styles.list}
        onAction={(key) => {
          onAction(String(key));
        }}
      >
        {sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}
      </ListBox>
    </Autocomplete>
  );
}
