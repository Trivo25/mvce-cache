# Minimal ETH Processor Bug Showcase

This is a minimal version of the **ETH processor**, focused solely on verifying the **`ethVerifier`** circuit.

### Prerequisites

You need to have **Lightnet** running. Start it with one of the following commands:

```bash
zk lightnet start
```

or, preferably:

```bash
zk lightnet start -p full -t real -l Debug
```

### Steps to Reproduce

```bash
npm i
npm run do-bug
```

### What Happens

- The contract is configured to store its cache specifically in the `cache/` directory of this repo.
- The `do-bug` script runs the same code **twice**.

**First run:**

- Populates the cache from scratch.
- Works fine.

**Second run:**

- Fails during the second invocation of `main()`.

If you run it again (with the cache already present),
it fails **immediately** on the first invocation.

To reset and reproduce the issue again, simply delete the `cache/` folder:
