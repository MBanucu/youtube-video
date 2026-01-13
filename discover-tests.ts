// discover-tests.ts
const glob = new Bun.Glob("src/**/*.test.ts");  // Adjust pattern as needed
const files = Array.from(glob.scanSync()).sort();
console.log(JSON.stringify({ "test-file": files }));