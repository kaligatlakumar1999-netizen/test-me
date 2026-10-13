const path = require('node:path');
const { createApp } = require('./app');

const dbFile = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'fitdirect.db');
const port = Number(process.env.PORT) || 3000;

createApp({ dbFile }).listen(port, () => {
  console.log(`FitDirect running at http://localhost:${port}`);
});
