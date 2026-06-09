const labAi = require('../ai/labAi');
const R = require('../utils/response.utils');

const getStatus = async (req, res, next) => {
  try {
    const meta = labAi.readMeta();
    return R.success(res, {
      ready: labAi.isModelReady(),
      meta
    });
  } catch (err) { next(err); }
};

const train = async (req, res, next) => {
  try {
    const result = labAi.trainModel();
    if (!result.ok) return R.badRequest(res, result.error || 'Huấn luyện thất bại');
    return R.success(res, result, 'Huấn luyện mô hình AI thành công');
  } catch (err) { next(err); }
};

module.exports = { getStatus, train };
