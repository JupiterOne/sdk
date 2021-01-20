export class BigMap<T> {
  private maps: Map<string, T>[] = [new Map<string, T>()];

  readonly maximumMapKeySpace: number;

  constructor(maximumMapKeySpace: number) {
    this.maximumMapKeySpace = maximumMapKeySpace;
  }

  set(key: string, value: T): Map<string, T> {
    const map = this.maps[this.maps.length - 1];

    if (map.size === this.maximumMapKeySpace) {
      const newMap = new Map<string, T>();
      const result = newMap.set(key, value);
      this.maps.push(newMap);
      return result;
    } else {
      return map.set(key, value);
    }
  }

  has(key: string) {
    return mapForKey(this.maps, key) !== undefined;
  }

  get(key: string) {
    return valueForKey(this.maps, key);
  }

  getMapsLength() {
    return this.maps.length;
  }
}

function mapForKey<T>(
  maps: Map<string, T>[],
  key: string,
): Map<string, T> | undefined {
  for (let index = maps.length - 1; index >= 0; index--) {
    const map = maps[index];

    if (map.has(key)) {
      return map;
    }
  }
}

function valueForKey<T>(maps: Map<string, T>[], key: string): T | undefined {
  for (let index = maps.length - 1; index >= 0; index--) {
    const map = maps[index];
    const value = map.get(key);

    if (value !== undefined) {
      return value;
    }
  }
}
