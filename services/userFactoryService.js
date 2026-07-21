import {
  getFactoryLists,
  findUserFactoryByUsername,
  insertUserFactoryMapping,
  getUserFactoryMappingByUsername,
  getFactoryByUsernameFromView,
} from '../repositories/userFactory.repo.js';

export async function listFactories() {
  return await getFactoryLists();
}

export async function addUserFactory(item) {
  const exists = await findUserFactoryByUsername(item.username);
  if (exists) {
    return {
      status: 'error',
      code: 'DUPLICATE',
      message: 'Org already exists',
    };
  }
  const data = await insertUserFactoryMapping(item);

  return {
    status: 'success',
    message: 'User factory mapping added successfully',
    data: data,
  };
}

export async function resolveFactoryContextOnLogin(username) {
  // 如果 view 沒有，則從 mapping table 取得 factory code
  const mapping = await getUserFactoryMappingByUsername(username);
  if (mapping) {
    return { ok: true, factory: mapping.factory };
  }
  // 嘗試從 view 取得完整的 factory 資訊
  const factoryFromView = await getFactoryByUsernameFromView(username);
  if (factoryFromView) {
    return { ok: true, factory: factoryFromView.factory };
  }
  return { ok: false, factory: null };
}
