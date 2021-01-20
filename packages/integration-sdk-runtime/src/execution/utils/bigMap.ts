export class BigMap<K, V> {
  private maps: Map<K, V>[] = [new Map<K, V>()];

  readonly maximumMapKeySpace: number;

  constructor(maximumMapKeySpace: number) {
    this.maximumMapKeySpace = maximumMapKeySpace;
  }

  set(key: K, value: V): Map<K, V> {
    const map = this.maps[this.maps.length - 1];

    if (map.size === this.maximumMapKeySpace) {
      const newMap = new Map<K, V>();
      const result = newMap.set(key, value);
      this.maps.push(newMap);
      return result;
    } else {
      return map.set(key, value);
    }
  }

  has(key: K) {
    return mapForKey(this.maps, key) !== undefined;
  }

  get(key: K) {
    return valueForKey(this.maps, key);
  }

  getMapsLength() {
    return this.maps.length;
  }
}

function mapForKey<K, V>(maps: Map<K, V>[], key: K): Map<K, V> | undefined {
  for (let index = maps.length - 1; index >= 0; index--) {
    const map = maps[index];

    if (map.has(key)) {
      return map;
    }
  }
}

function valueForKey<K, V>(maps: Map<K, V>[], key: K): V | undefined {
  for (let index = maps.length - 1; index >= 0; index--) {
    const map = maps[index];
    const value = map.get(key);

    if (value !== undefined) {
      return value;
    }
  }
}
