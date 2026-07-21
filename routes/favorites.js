import express from 'express';
import multer from 'multer';
import 'dotenv/config.js';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
} from '../services/favoriteService.js';
import { logAction } from '../utils/useLogger.js';

const router = express.Router();
const upload = multer();
const isMock = process.env.USE_MOCK === 'true';

const DEFAULT_MOCK_USERNAME = 'mock-user';
const defaultMockFavoriteKeys = [
  'ic_instrument_repair_application',
  'ic_maintain_instrument_information',
  'ic_report',
];
const mockFavoriteStore = new Map();

const normalizeUsername = (username) => username || DEFAULT_MOCK_USERNAME;

const getRequestUsername = (req) =>
  normalizeUsername(
    req.user?.username || req.query?.username || req.body?.username
  );

const seedMockFavorites = (username) => {
  const normalizedUsername = normalizeUsername(username);

  if (!mockFavoriteStore.has(normalizedUsername)) {
    mockFavoriteStore.set(normalizedUsername, [...defaultMockFavoriteKeys]);
  }

  return mockFavoriteStore.get(normalizedUsername);
};

const formatMockFavorites = (favoriteKeys) =>
  favoriteKeys.map((function_key, index) => ({
    function_key,
    display_order: index + 1,
  }));

const getMockFavorites = (username) =>
  formatMockFavorites(seedMockFavorites(username));

const addMockFavorite = (username, functionKey) => {
  if (!functionKey) {
    return { status: 'error', message: 'function_key is required' };
  }

  const favoriteKeys = seedMockFavorites(username);
  const alreadyExists = favoriteKeys.includes(functionKey);

  if (!alreadyExists) {
    favoriteKeys.push(functionKey);
  }

  return {
    status: 'success',
    message: alreadyExists
      ? 'Already exists (mock)'
      : 'Favorite added successfully (mock)',
    data: formatMockFavorites(favoriteKeys),
  };
};

const removeMockFavorite = (username, functionKey) => {
  if (!functionKey) {
    return { status: 'error', message: 'function_key is required' };
  }

  const favoriteKeys = seedMockFavorites(username);
  const nextFavoriteKeys = favoriteKeys.filter((key) => key !== functionKey);
  mockFavoriteStore.set(normalizeUsername(username), nextFavoriteKeys);

  return {
    status: 'success',
    message: 'Favorite removed successfully (mock)',
    data: formatMockFavorites(nextFavoriteKeys),
  };
};

router.get('/', async (req, res) => {
  await logAction('GET /favorites', 'info', req);

  try {
    const username = getRequestUsername(req);

    if (isMock) {
      const data = getMockFavorites(username);
      await logAction(`Mock found ${data.length} favorite`, 'info', req);

      return res.status(200).json({
        status: 'success',
        message: 'Favorites retrieved successfully (mock)',
        data,
      });
    }

    const data = await getFavorites(username);

    if (!data) {
      await logAction('No favorite found', 'warn', req);

      return res.status(404).json({
        status: 'error',
        message: 'No favorite found',
        data: [],
      });
    }

    await logAction(`Found ${data.length} favorite`, 'info', req);

    return res.status(200).json({
      status: 'success',
      message: 'Favorites retrieved successfully',
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /favorites: ${error.message}`,
      'error',
      req
    );

    return res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

router.post('/', upload.none(), async (req, res) => {
  await logAction('POST /favorites', 'info', req);

  try {
    const { function_key } = req.body;
    const username = getRequestUsername(req);

    if (isMock) {
      const result = addMockFavorite(username, function_key);

      if (result.status === 'error') {
        await logAction(
          `Error adding mock favorite: ${result.message}`,
          'error',
          req
        );
        return res.status(400).json(result);
      }

      await logAction('Mock favorite added successfully', 'info', req);
      return res.status(200).json(result);
    }

    const result = await addFavorite(username, function_key);

    if (result.status === 'error') {
      await logAction(`Error adding favorite: ${result.message}`, 'error', req);

      return res.status(500).json({
        status: 'error',
        message: result.message,
      });
    }

    await logAction('Favorite added successfully', 'info', req);

    return res.status(200).json({
      status: 'success',
      message: result.message,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in POST /favorites: ${error.message}`,
      'error',
      req
    );

    return res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

router.delete('/:function_key', upload.none(), async (req, res) => {
  await logAction('DELETE /favorites', 'info', req);

  try {
    const { function_key } = req.params;
    const username = getRequestUsername(req);

    if (isMock) {
      const result = removeMockFavorite(username, function_key);

      if (result.status === 'error') {
        await logAction(
          `Error removing mock favorite: ${result.message}`,
          'error',
          req
        );

        return res.status(400).json(result);
      }

      await logAction('Mock favorite removed successfully', 'info', req);
      return res.status(200).json(result);
    }

    const result = await removeFavorite(username, function_key);

    if (result.status === 'error') {
      await logAction(
        `Error removing favorite: ${result.message}`,
        'error',
        req
      );

      return res.status(500).json({
        status: 'error',
        message: result.message,
      });
    }

    await logAction('Favorite removed successfully', 'info', req);

    return res.status(200).json({
      status: 'success',
      message: result.message,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in DELETE /favorites: ${error.message}`,
      'error',
      req
    );

    return res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;
