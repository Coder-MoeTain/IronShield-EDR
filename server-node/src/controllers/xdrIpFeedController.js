const XdrIpFeedService = require('../services/XdrIpFeedService');

async function listFeeds(req, res, next) {
  try {
    const rows = await XdrIpFeedService.listFeeds(req.tenantId ?? null);
    res.json(rows || []);
  } catch (e) {
    next(e);
  }
}

async function createFeed(req, res, next) {
  try {
    const row = await XdrIpFeedService.createFeed(req.body, req.tenantId ?? null);
    res.json(row);
  } catch (e) {
    next(e);
  }
}

async function updateFeed(req, res, next) {
  try {
    const row = await XdrIpFeedService.updateFeed(req.params.id, req.body, req.tenantId ?? null);
    res.json(row);
  } catch (e) {
    next(e);
  }
}

async function deleteFeed(req, res, next) {
  try {
    const ok = await XdrIpFeedService.deleteFeed(req.params.id, req.tenantId ?? null);
    res.json({ ok });
  } catch (e) {
    next(e);
  }
}

async function syncFeed(req, res, next) {
  try {
    const out = await XdrIpFeedService.syncFeedById(req.params.id, req.tenantId ?? null);
    res.json(out);
  } catch (e) {
    next(e);
  }
}

async function bootstrap(req, res, next) {
  try {
    const out = await XdrIpFeedService.bootstrapRecommendedFeeds(req.tenantId ?? null);
    res.json(out);
  } catch (e) {
    next(e);
  }
}

module.exports = { listFeeds, createFeed, updateFeed, deleteFeed, syncFeed, bootstrap };

