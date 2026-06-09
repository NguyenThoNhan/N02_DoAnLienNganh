const DepartmentModel = require('../models/department.model');
const DoctorModel     = require('../models/doctor.model');
const R = require('../utils/response.utils');

const getAll = async (req, res, next) => {
  try {
    const { status, with_stats } = req.query;

    if (with_stats === 'true') {
      const stats = await DepartmentModel.getDepartmentStats();
      return R.success(res, { departments: stats });
    }

    const departments = await DepartmentModel.findAll(status || null);
    return R.success(res, { departments });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const dept = await DepartmentModel.findById(req.params.id);
    if (!dept) return R.notFound(res, 'Không tìm thấy khoa');

    const doctors = await DoctorModel.findByDepartment(dept.id, 'active');
    return R.success(res, { department: dept, doctors });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code)
      return R.badRequest(res, 'Tên khoa và mã khoa là bắt buộc');

    if (await DepartmentModel.isNameTaken(name))
      return R.conflict(res, 'Tên khoa đã tồn tại');
    if (await DepartmentModel.isCodeTaken(code))
      return R.conflict(res, 'Mã khoa đã tồn tại');

    const dept = await DepartmentModel.create({ name, code: code.toUpperCase(), description });
    return R.created(res, { department: dept }, 'Tạo khoa thành công');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description, status } = req.body;

    const existing = await DepartmentModel.findById(id);
    if (!existing) return R.notFound(res, 'Không tìm thấy khoa');

    if (name && await DepartmentModel.isNameTaken(name, id))
      return R.conflict(res, 'Tên khoa đã tồn tại');
    if (code && await DepartmentModel.isCodeTaken(code, id))
      return R.conflict(res, 'Mã khoa đã tồn tại');

    const updated = await DepartmentModel.update(id, {
      name, description, status,
      ...(code && { code: code.toUpperCase() })
    });
    return R.success(res, { department: updated }, 'Cập nhật khoa thành công');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const existing = await DepartmentModel.findById(req.params.id);
    if (!existing) return R.notFound(res, 'Không tìm thấy khoa');

    const { data: doctors } = await DoctorModel.findAll({
      department_id: Number(req.params.id),
      limit: 1
    });
    if (doctors.length > 0)
      return R.badRequest(res, 'Không thể xóa khoa đang có bác sĩ. Hãy chuyển bác sĩ trước');

    await DepartmentModel.remove(req.params.id);
    return R.success(res, null, 'Xóa khoa thành công');
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, remove };