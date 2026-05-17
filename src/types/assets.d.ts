// Module declarations for bundled static assets.
// Metro resolves require('*.csv') to a numeric asset module ID at runtime.

declare module '*.csv' {
  const value: number;
  export default value;
}
