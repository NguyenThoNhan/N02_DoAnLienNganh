const db               = require('../config/db');
const AppointmentModel = require('../models/appointment.model');
const UserModel        = require('../models/user.model');
const { sqlLimitOffset } = require('../utils/pagination.utils');
const R = require('../utils/response.utils');

const getDashboardStats = async (req, res, next) => {
  try {
    const [[counts]] = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM users    WHERE role = 'patient' AND status = 'active') AS total_patients,
        (SELECT COUNT(*) FROM users    WHERE role = 'doctor'  AND status = 'active') AS total_doctors,
        (SELECT COUNT(*) FROM doctors  WHERE status = 'active')                      AS total_doctor_profiles,
        (SELECT COUNT(*) FROM departments WHERE status = 'active')                   AS total_departments,
        (SELECT COUNT(*) FROM appointments)                                          AS total_appointments,
        (SELECT COUNT(*) FROM appointments WHERE status = 'completed')               AS completed_appointments,
        (SELECT COUNT(*) FROM appointments WHERE status = 'pending')                 AS pending_appointments,
        (SELECT COUNT(*) FROM appointments WHERE status = 'in_progress')             AS inprogress_appointments,
        (SELECT COUNT(*) FROM appointments WHERE appointment_date = CURDATE()
          AND status NOT IN ('cancelled'))                                            AS today_appointments,
        (SELECT COALESCE(SUM(total_amount), 0) FROM health_records
          WHERE payment_status = 'paid')                                             AS total_revenue,
        (SELECT COALESCE(SUM(total_amount), 0) FROM health_records
          WHERE payment_status = 'paid'
          AND MONTH(paid_at) = MONTH(CURDATE())
          AND YEAR(paid_at)  = YEAR(CURDATE()))                                      AS monthly_revenue,
        (SELECT COALESCE(SUM(total_amount), 0) FROM health_records
          WHERE payment_status = 'paid'
          AND DATE(paid_at) = CURDATE())                                             AS today_revenue
    `);

    const [[newPatients]] = await db.execute(`
      SELECT COUNT(*) AS count FROM users
      WHERE role = 'patient'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    return R.success(res, {
      stats: {
        ...counts,
        new_patients_30days: newPatients.count
      }
    });
  } catch (err) { next(err); }
};

const getRevenueChart = async (req, res, next) => {
  try {
    const { group_by = 'month', date_from, date_to } = req.query;
    const validGroups = ['day', 'month', 'year'];
    if (!validGroups.includes(group_by))
      return R.badRequest(res, 'group_by phải là day, month hoặc year');

    const data = await AppointmentModel.getRevenueStats({ group_by, date_from, date_to });
    return R.success(res, { chart: data, group_by });
  } catch (err) { next(err); }
};

const getTopDoctors = async (req, res, next) => {
  try {
    const { limit = 5, date_from, date_to } = req.query;
    const conditions = ["a.status = 'completed'"];
    const values = [];
    if (date_from) { conditions.push('a.appointment_date >= ?'); values.push(date_from); }
    if (date_to)   { conditions.push('a.appointment_date <= ?'); values.push(date_to); }

    const { clause } = sqlLimitOffset(limit, 5, { max: 50, def: 5 });
    const [rows] = await db.execute(
      `SELECT
         doc.id                AS doctor_id,
         u.full_name           AS doctor_name,
         doc.title,
         dep.name              AS department_name,
         COUNT(a.id)           AS total_appointments,
         COALESCE(SUM(hr.total_amount), 0) AS total_revenue
       FROM appointments a
       INNER JOIN doctors doc     ON doc.id = a.doctor_id
       INNER JOIN users u         ON u.id   = doc.user_id
       INNER JOIN departments dep ON dep.id = doc.department_id
       LEFT  JOIN health_records hr ON hr.appointment_id = a.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY doc.id, u.full_name, doc.title, dep.name
       ORDER BY total_appointments DESC
       ${clause}`,
      values
    );
    return R.success(res, { top_doctors: rows });
  } catch (err) { next(err); }
};

const getDepartmentStats = async (req, res, next) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        dep.id,
        dep.name,
        dep.code,
        COUNT(DISTINCT doc.id)   AS total_doctors,
        COUNT(DISTINCT a.id)     AS total_appointments,
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) AS completed_appointments,
        COALESCE(SUM(CASE WHEN a.status = 'completed' THEN hr.total_amount ELSE 0 END), 0) AS revenue
      FROM departments dep
      LEFT JOIN doctors doc      ON doc.department_id = dep.id  AND doc.status = 'active'
      LEFT JOIN appointments a   ON a.doctor_id = doc.id
      LEFT JOIN health_records hr ON hr.appointment_id = a.id
      WHERE dep.status = 'active'
      GROUP BY dep.id, dep.name, dep.code
      ORDER BY revenue DESC
    `);
    return R.success(res, { departments: rows });
  } catch (err) { next(err); }
};

const getUserStats = async (req, res, next) => {
  try {
    const { role, status, search, limit = 20, offset = 0 } = req.query;
    const result = await UserModel.getAll({ role, status, search, limit: Number(limit), offset: Number(offset) });
    return R.success(res, result);
  } catch (err) { next(err); }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'inactive', 'banned'].includes(status))
      return R.badRequest(res, 'Trạng thái không hợp lệ');

    const user = await UserModel.findById(id);
    if (!user) return R.notFound(res, 'Không tìm thấy người dùng');
    if (user.role === 'admin') return R.forbidden(res, 'Không thể thay đổi trạng thái tài khoản admin');

    await UserModel.updateStatus(id, status);
    return R.success(res, null, 'Cập nhật trạng thái tài khoản thành công');
  } catch (err) { next(err); }
};

module.exports = {
  getDashboardStats, getRevenueChart,
  getTopDoctors, getDepartmentStats,
  getUserStats, updateUserStatus
};
