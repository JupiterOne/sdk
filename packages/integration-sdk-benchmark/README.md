# SDK Benchmarks

Benchmarks for the SDK! When making performance changes to the SDK, developers
should be conscious of existing benchmarks and the impact that their changes may
have.

## Usage

```
yarn benchmark
```

## Results

The benchmark was run using the following specs:

- Node.js v14.18.2
- OS: Ubuntu 20.04.3 LTS 64-bit
- Processor: Intel Core i7-9700K CPU @ 3.60GHz × 8
- Memory: 32 GB 2133 MT/s DDR4

### `FileSystemGraphObjectStore`

```
FileSystemGraphObjectStore#addEntity 100_000 Entities x 11.80 ops/sec ±3.66% (30 runs sampled)
```
