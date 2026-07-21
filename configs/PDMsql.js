import sql from 'mssql';
import 'dotenv/config.js';

console.log('✅ 正在使用的 database config:', process.env.PDMSQL_DATABASE);

const pdmConfig = {
  user: process.env.PDMSQL_USER,
  password: process.env.PDMSQL_PASSWORD,
  server: process.env.PDMSQL_SERVER,
  database: process.env.PDMSQL_DATABASE,
  port: parseInt(process.env.PDMSQL_PORT, 10),
  options: {
    encrypt: process.env.PDMSQL_ENCRYPT === 'true', // 將字串轉換為布林值
    trustServerCertificate:
      process.env.PDMSQL_TRUST_SERVER_CERTIFICATE === 'true',
    tdsVersion: '7_1',
    debug: {
      packet: true,
      data: true,
      payload: true,
      token: true,
    },
  },
};

const isMock = process.env.USE_MOCK === 'true';

// 建立連線
const PDMsql = async () => {
  try {
    if (isMock) {
      console.log('✅ Using mock PDM SQL connection');
      return null;
    }

    const pool = await sql.connect(pdmConfig);
    console.log('Connected to SQL Server');
    return pool;
  } catch (err) {
    console.error('Database connection failed: ', err.message);
    throw new Error('Failed to connect to database');
  }
};

// 將連接方法導出，方便在其他檔案中使用
export default PDMsql;
