import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { unlink, writeFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);
function fixMulterFilename(name) {
  // 常見：multer/busboy 以 latin1 解，實際是 utf8 bytes
  return Buffer.from(name, 'latin1').toString('utf8');
}
export async function insertCalibrationFile(file) {
  const folderPath = path.join(
    process.cwd(),
    process.env.FILE_UPLOAD_PATH || 'data/uploads',
    'calibration'
  );
  console.log(folderPath);
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }
  const fixedName = fixMulterFilename(file.originalname);

  const parsed = path.parse(fixedName);
  const baseName = parsed.name;
  const extension = parsed.ext;

  let fileName = `${baseName}${extension}`;
  let filePath = path.join(folderPath, fileName);
  let counter = 1;

  while (existsSync(filePath)) {
    fileName = `${baseName}(${counter})${extension}`;
    filePath = path.join(folderPath, fileName);
    counter++;
  }

  try {
    // 儲存檔案
    await writeFile(filePath, file.buffer);
    console.log(`✅ 檔案已成功儲存`);
    return { file_name: baseName, file_type: extension, file_url: fileName };
  } catch (err) {
    console.error('❌ 檔案儲存失敗:', err);
    throw err;
  }
}

export async function deleteCalibrationFile(fileUrl) {
  const folderPath = path.join(
    process.cwd(),
    process.env.FILE_UPLOAD_PATH || 'data/uploads',
    'calibration'
  );
  const filePath = path.join(folderPath, fileUrl);

  if (!existsSync(filePath)) {
    return { success: true, message: 'File does not exist.' };
  }

  try {
    await unlink(filePath);
    return { success: true, file_url: fileUrl };
  } catch (err) {
    console.error('Failed to delete calibration file:', err);
    throw err;
  }
}
