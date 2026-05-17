// Jest stub for *.csv Metro asset imports.
// Metro resolves require('*.csv') to a numeric asset module ID at runtime.
// In Jest, CSV files are not parseable JS — return 0 as a placeholder.
module.exports = 0;
