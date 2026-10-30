/** Groups items by key, keeping their order within each group (`Map.groupBy` is ES2024). */
export const groupBy = <Item, Key>(
  items: readonly Item[],
  keyOf: (item: Item) => Key,
): ReadonlyMap<Key, readonly Item[]> => {
  const groups = new Map<Key, Item[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [item]);
    } else {
      group.push(item);
    }
  }
  return groups;
};
