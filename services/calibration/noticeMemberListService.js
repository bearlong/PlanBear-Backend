import {
  listNoticeMembers,
  findNoticeMember,
  insertNoticeMember,
  updateNoticeMember,
  deleteNoticeMember,
  batchDeleteNoticeMember,
} from '../../repositories/calibration/noticeMemberList.repo.js';
import { resolveFactoryContextOnLogin } from '../userFactoryService.js';

export async function getNoticeMemberList() {
  return await listNoticeMembers();
}

export async function addNoticeMember(item) {
  const exists = await findNoticeMember({
    username: item?.username,
    factory: item?.factory,
    dept: item?.dept,
    use_level: item?.use_level,
  });
  if (exists) {
    return {
      status: 'error',
      code: 'DUPLICATE',
      message: 'Notice member already exists',
    };
  }
  const factoryContext = await resolveFactoryContextOnLogin(item.username);

  if (!factoryContext.ok) {
    return {
      status: 'error',
      code: 'NO_FACTORY_CONTEXT',
      message: 'Cannot resolve factory context for the user',
    };
  }

  const newItem = { ...item };

  newItem.factory = factoryContext.factory;

  const data = await insertNoticeMember(newItem);
  return {
    status: 'success',
    message: 'Notice member added successfully',
    data,
  };
}

export async function editNoticeMember(id, item) {
  const data = await updateNoticeMember(id, item);
  return {
    status: 'success',
    message: 'Notice member updated successfully',
    data,
  };
}

export async function batchEditNoticeMember(items) {
  const results = [];
  for (const item of items) {
    const { id, ...rest } = item;
    const data = await updateNoticeMember(id, rest);

    results.push(data);
  }
  return results;
}

export async function removeNoticeMember(id) {
  await deleteNoticeMember(id);
  return {
    status: 'success',
    message: 'Notice member deleted successfully',
  };
}

export async function batchRemoveNoticeMember(items) {
  console.log(items);
  await batchDeleteNoticeMember(items);
  return {
    status: 'success',
    message: 'Notice members deleted successfully',
  };
}
