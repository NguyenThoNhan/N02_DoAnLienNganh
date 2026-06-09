const ServiceModel = require('../models/service.model');
const R = require('../utils/response.utils');

const VALID_TYPES = ['doctor', 'request', 'pgs', 'ths_cki', 'ts_ckii', 'request_24_7'];

const getAll = async (req, res, next) => {
  try {
    const { status } = req.query;
    const services = await ServiceModel.findAll(status || null);
    return R.success(res, { services });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const service = await ServiceModel.findById(req.params.id);
    if (!service) return R.notFound(res, 'Không tìm thấy dịch vụ');
    return R.success(res, { service });
  } catch (err) { next(err); }
};

const getByType = async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type))
      return R.badRequest(res, 'Loại dịch vụ không hợp lệ');

    const service = await ServiceModel.getPriceByType(type);
    if (!service) return R.notFound(res, 'Dịch vụ này chưa được cấu hình giá');
    return R.success(res, { service });
  } catch (err) { next(err); }
};

const getPriceMap = async (req, res, next) => {
  try {
    const priceMap = await ServiceModel.getPriceMap();
    return R.success(res, { price_map: priceMap });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { service_type, name, description, price } = req.body;

    if (!service_type || !name || price === undefined)
      return R.badRequest(res, 'Thiếu thông tin bắt buộc: loại dịch vụ, tên, giá');

    if (!VALID_TYPES.includes(service_type))
      return R.badRequest(res, 'Loại dịch vụ không hợp lệ');

    if (Number(price) < 0)
      return R.badRequest(res, 'Giá dịch vụ không được âm');

    const service = await ServiceModel.create({ service_type, name, description, price: Number(price) });
    return R.created(res, { service }, 'Tạo dịch vụ thành công');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await ServiceModel.findById(id);
    if (!existing) return R.notFound(res, 'Không tìm thấy dịch vụ');

    const { service_type, name, description, price, status } = req.body;

    if (service_type && !VALID_TYPES.includes(service_type))
      return R.badRequest(res, 'Loại dịch vụ không hợp lệ');

    if (price !== undefined && Number(price) < 0)
      return R.badRequest(res, 'Giá dịch vụ không được âm');

    const updated = await ServiceModel.update(id, {
      service_type, name, description, status,
      ...(price !== undefined && { price: Number(price) })
    });
    return R.success(res, { service: updated }, 'Cập nhật dịch vụ thành công');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const existing = await ServiceModel.findById(req.params.id);
    if (!existing) return R.notFound(res, 'Không tìm thấy dịch vụ');

    await ServiceModel.remove(req.params.id);
    return R.success(res, null, 'Xóa dịch vụ thành công');
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, getByType, getPriceMap, create, update, remove };