const DrugModel = require('../models/drug.model');
const R = require('../utils/response.utils');

// ─── THUỐC ────────────────────────────────────────────────────────
const getAllDrugs = async (req, res, next) => {
  try {
    const { status, category, search, limit = 20, offset = 0 } = req.query;
    const result = await DrugModel.findAll({
      status, category, search, limit: Number(limit), offset: Number(offset)
    });
    return R.success(res, result);
  } catch (err) { next(err); }
};

const getDrugById = async (req, res, next) => {
  try {
    const drug = await DrugModel.findById(req.params.id);
    if (!drug) return R.notFound(res, 'Không tìm thấy thuốc');
    return R.success(res, { drug });
  } catch (err) { next(err); }
};

const createDrug = async (req, res, next) => {
  try {
    const { name, code, category, unit, unit_price, stock, description, manufacturer } = req.body;
    if (!name || !code || unit_price === undefined)
      return R.badRequest(res, 'Thiếu thông tin bắt buộc: tên thuốc, mã thuốc, đơn giá');

    if (Number(unit_price) < 0) return R.badRequest(res, 'Đơn giá không được âm');
    if (stock !== undefined && Number(stock) < 0) return R.badRequest(res, 'Tồn kho không được âm');

    if (await DrugModel.isCodeTaken(code))
      return R.conflict(res, 'Mã thuốc đã tồn tại');

    const drug = await DrugModel.create({
      name, code: code.toUpperCase(), category, unit,
      unit_price: Number(unit_price), stock: Number(stock) || 0,
      description, manufacturer
    });
    return R.created(res, { drug }, 'Thêm thuốc thành công');
  } catch (err) { next(err); }
};

const updateDrug = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await DrugModel.findById(id);
    if (!existing) return R.notFound(res, 'Không tìm thấy thuốc');

    const { name, code, category, unit, unit_price, stock, description, manufacturer, status } = req.body;

    if (code && await DrugModel.isCodeTaken(code, id))
      return R.conflict(res, 'Mã thuốc đã tồn tại');

    if (unit_price !== undefined && Number(unit_price) < 0) return R.badRequest(res, 'Đơn giá không được âm');
    if (stock      !== undefined && Number(stock)      < 0) return R.badRequest(res, 'Tồn kho không được âm');

    const updated = await DrugModel.update(id, {
      name, description, category, unit, manufacturer, status,
      ...(code       && { code: code.toUpperCase() }),
      ...(unit_price !== undefined && { unit_price: Number(unit_price) }),
      ...(stock      !== undefined && { stock:      Number(stock) })
    });
    return R.success(res, { drug: updated }, 'Cập nhật thuốc thành công');
  } catch (err) { next(err); }
};

const removeDrug = async (req, res, next) => {
  try {
    const existing = await DrugModel.findById(req.params.id);
    if (!existing) return R.notFound(res, 'Không tìm thấy thuốc');

    const result = await DrugModel.remove(req.params.id);
    const msg = result.deleted
      ? 'Xóa thuốc thành công'
      : 'Thuốc đang được sử dụng trong đơn, đã chuyển sang trạng thái ngừng kinh doanh';
    return R.success(res, result, msg);
  } catch (err) { next(err); }
};

const adjustStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity, note } = req.body;
    if (quantity === undefined || quantity === 0)
      return R.badRequest(res, 'Số lượng điều chỉnh không được để trống hoặc bằng 0');

    const existing = await DrugModel.findById(id);
    if (!existing) return R.notFound(res, 'Không tìm thấy thuốc');

    const newStock = existing.stock + Number(quantity);
    if (newStock < 0)
      return R.badRequest(res, `Không thể xuất kho, tồn kho hiện tại chỉ còn ${existing.stock}`);

    const updated = await DrugModel.adjustStock(id, Number(quantity));
    return R.success(res, { drug: updated, adjusted: Number(quantity), note }, 'Điều chỉnh tồn kho thành công');
  } catch (err) { next(err); }
};

// ─── GỢI Ý THUỐC ──────────────────────────────────────────────────
const getSuggestionsByDisease = async (req, res, next) => {
  try {
    const { disease_name } = req.query;
    if (!disease_name || disease_name.trim().length < 2)
      return R.badRequest(res, 'Vui lòng nhập tên bệnh (ít nhất 2 ký tự)');

    const drugs = await DrugModel.getSuggestedDrugs(disease_name.trim());
    return R.success(res, { drugs, keyword: disease_name.trim(), count: drugs.length });
  } catch (err) { next(err); }
};

// ─── DANH MỤC BỆNH ────────────────────────────────────────────────
const getAllDiseases = async (req, res, next) => {
  try {
    const diseases = await DrugModel.getAllDiseases();
    return R.success(res, { diseases });
  } catch (err) { next(err); }
};

const getDiseaseDetail = async (req, res, next) => {
  try {
    const disease = await DrugModel.getDiseaseById(req.params.id);
    if (!disease) return R.notFound(res, 'Không tìm thấy bệnh');
    const drugs = await DrugModel.getSuggestedByDiseaseId(disease.id);
    return R.success(res, { disease, drugs });
  } catch (err) { next(err); }
};

const createDisease = async (req, res, next) => {
  try {
    const { name, icd_code, description } = req.body;
    if (!name) return R.badRequest(res, 'Tên bệnh là bắt buộc');
    const disease = await DrugModel.createDisease({ name, icd_code, description });
    return R.created(res, { disease }, 'Thêm bệnh thành công');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return R.conflict(res, 'Tên bệnh đã tồn tại');
    next(err);
  }
};

// Gán/cập nhật danh sách thuốc gợi ý cho 1 bệnh
const linkDiseaseDrug = async (req, res, next) => {
  try {
    const { id: diseaseId } = req.params;
    const { mappings } = req.body;

    const disease = await DrugModel.getDiseaseById(diseaseId);
    if (!disease) return R.notFound(res, 'Không tìm thấy bệnh');

    if (!Array.isArray(mappings))
      return R.badRequest(res, 'mappings phải là mảng [{ drug_id, priority, note }]');

    for (const [i, m] of mappings.entries()) {
      if (!m.drug_id) return R.badRequest(res, `Phần tử thứ ${i + 1} thiếu drug_id`);
      const drug = await DrugModel.findById(m.drug_id);
      if (!drug) return R.badRequest(res, `Thuốc ID ${m.drug_id} không tồn tại`);
      if (m.priority && ![1, 2, 3].includes(Number(m.priority)))
        return R.badRequest(res, `Priority của thuốc ID ${m.drug_id} phải là 1, 2 hoặc 3`);
    }

    const drugs = await DrugModel.setDiseaseDrugMappings(diseaseId, mappings);
    return R.success(res, { disease, drugs }, 'Cập nhật liên kết bệnh - thuốc thành công');
  } catch (err) { next(err); }
};

module.exports = {
  getAllDrugs, getDrugById, createDrug, updateDrug, removeDrug, adjustStock,
  getSuggestionsByDisease,
  getAllDiseases, getDiseaseDetail, createDisease, linkDiseaseDrug
};