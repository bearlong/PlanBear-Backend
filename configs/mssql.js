import sql from 'mssql';
import 'dotenv/config.js';

const mssqlConfig = {
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  server: process.env.MSSQL_SERVER,
  database: process.env.MSSQL_DATABASE,
  port: parseInt(process.env.MSSQL_PORT, 10),
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === 'true', // 將字串轉換為布林值
    trustServerCertificate:
      process.env.MSSQL_TRUST_SERVER_CERTIFICATE === 'true',
  },
};
const isMock = process.env.USE_MOCK === 'true';

let mssqlPool = null;
// 建立連線
const mssql = async () => {
  if (isMock) {
    console.log('✅ Using mock MSSQL connection');
    return null;
  }

  if (!mssqlPool) {
    mssqlPool = new sql.ConnectionPool(mssqlConfig);
    mssqlPool = await mssqlPool.connect();
    console.log('✅ Connected to MSSQL Server');
  }
  return mssqlPool;
};

// 將連接方法導出，方便在其他檔案中使用
export default mssql;
