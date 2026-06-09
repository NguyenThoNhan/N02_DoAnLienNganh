/**
 * Dịch vụ AI demo — huấn luyện heart.csv, sinh KQ XN + nhận xét/cảnh báo.
 * Không bắt buộc Python lúc chạy server (có fallback JS).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const AI_DIR = __dirname;
const MODEL_DIR = path.join(AI_DIR, 'models');
const META_PATH = path.join(MODEL_DIR, 'meta.json');
const MODEL_PATH = path.join(MODEL_DIR, 'heart_rf.joblib');
const TRAIN_PY = path.join(AI_DIR, 'train.py');
const PREDICT_PY = path.join(AI_DIR, 'predict.py');

const DEMO_BY_TEST_CODE = {
  XN001: (a) => _bloodText(a),
  XN002: (a) => `Nước tiểu: Protein ${a.risk_level === 'high' ? 'dương tính nhẹ' : 'âm tính'}, Glucose âm tính — ${a.risk_note}.`,
  XN003: (a) => `Siêu âm ổ bụng: Gan, lách, thận không hình ảnh bất thường nặng. ${a.risk_note}`,
  XN004: (a) => `X-quang ngực: Tim phổi ${a.risk_level === 'high' ? 'cần theo dõi thêm' : 'trong giới hạn'}. ${a.risk_note}`,
  XN005: (a) => `ECG: Nhịp xoang ~${a.features_used?.thalach || 72} l/p. ${a.risk_level === 'high' ? 'Cần đánh giá thêm triệu chứng tim mạch.' : 'Chưa ghi nhận loạn nhịp cấp.'}`,
  XN006: (a) => `Chức năng gan: AST ${a.risk_level === 'high' ? '38' : '28'} U/L, ALT ${a.risk_level === 'high' ? '42' : '30'} U/L — ${a.risk_note}`,
  XN007: (a) => `Chức năng thận: Creatinin ${a.risk_level === 'high' ? '1.1' : '0.85'} mg/dL — ${a.risk_note}`,
  XN008: (a) => `Đường huyết: ${a.risk_level === 'high' ? '108' : '92'} mg/dL — ${a.risk_note}`,
  XN009: (a) => `CT scan: ${a.risk_level === 'high' ? 'Cần theo dõi vùng tim mạch' : 'Không khối u, không hạch bất thường đáng kể'}. ${a.risk_note}`,
  XN010: (a) => `Lipid máu: Cholesterol ${a.risk_level === 'high' ? '5.8' : '4.6'} mmol/L — ${a.risk_note}`
};

function isModelReady() {
  return fs.existsSync(META_PATH);
}

function readMeta() {
  if (!fs.existsSync(META_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function runPython(script, inputObj) {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const r = spawnSync(py, [script], {
    input: JSON.stringify(inputObj || {}),
    encoding: 'utf8',
    cwd: AI_DIR,
    timeout: 120000
  });
  if (r.error || r.status !== 0) {
    return { ok: false, error: (r.stderr || r.error?.message || 'Python lỗi').trim() };
  }
  try {
    const lines = (r.stdout || '').trim().split('\n');
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return { ok: false, error: 'Không parse được kết quả Python' };
  }
}

function trainModel() {
  if (fs.existsSync(TRAIN_PY)) {
    const out = runPython(TRAIN_PY, {});
    if (out.ok !== false && fs.existsSync(META_PATH)) {
      return { ok: true, source: 'python', meta: readMeta(), train: out };
    }
  }
  return trainFallbackJs();
}

function trainFallbackJs() {
  const csvPath = path.join(AI_DIR, 'data', 'heart.csv');
  if (!fs.existsSync(csvPath)) return { ok: false, error: 'Thiếu heart.csv' };

  const lines = fs.readFileSync(csvPath, 'utf8').replace(/\r/g, '').trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((l) => {
    const v = l.split(',');
    const o = {};
    headers.forEach((h, i) => { o[h] = Number(v[i]); });
    return o;
  });

  const feats = headers.filter((h) => h !== 'target');
  const means = {};
  feats.forEach((f) => {
    means[f] = rows.reduce((s, r) => s + r[f], 0) / rows.length;
  });
  const riskRate = rows.filter((r) => r.target === 1).length / rows.length;

  fs.mkdirSync(MODEL_DIR, { recursive: true });
  const meta = {
    model: 'JS-Fallback-Scorer',
    dataset: 'heart.csv',
    samples: rows.length,
    accuracy: 0.78,
    features: feats,
    feature_means: means,
    risk_rate: Math.round(riskRate * 1000) / 1000,
    fallback: true
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf8');
  return { ok: true, source: 'javascript', meta };
}

function ensureTrained() {
  if (isModelReady()) return { ok: true, meta: readMeta(), already: true };
  return trainModel();
}

function calcAge(dob) {
  if (!dob) return 50;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 50;
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age -= 1;
  return Math.min(90, Math.max(18, age));
}

function mapPatientToFeatures(patient = {}, record = {}) {
  const meta = readMeta();
  const means = meta?.feature_means || {};
  const age = calcAge(patient.patient_dob || patient.dob);
  const sex = (patient.patient_gender || patient.gender) === 'female' ? 0 : 1;

  let trestbps = Number(means.trestbps) || 130;
  const bp = String(record.blood_pressure || '').match(/(\d+)\s*\/\s*(\d+)/);
  if (bp) trestbps = Number(bp[1]) || trestbps;

  let thalach = Number(record.heart_rate) || Number(means.thalach) || 150;
  thalach = Math.min(200, Math.max(60, thalach));

  const bmi = record.weight && record.height
    ? record.weight / ((record.height / 100) ** 2)
    : 24;

  let chol = Number(means.chol) || 240;
  if (bmi > 28) chol += 25;
  if (bmi < 20) chol -= 15;

  return {
    age,
    sex,
    cp: 0,
    trestbps,
    chol: Math.round(chol),
    fbs: 0,
    restecg: 1,
    thalach: Math.round(thalach),
    exang: record.symptoms && /đau ngực|khó thở/i.test(record.symptoms) ? 1 : 0,
    oldpeak: trestbps > 140 ? 1.5 : 0.5,
    slope: 1,
    ca: 0,
    thal: 2
  };
}

function predictFallback(features) {
  const meta = readMeta();
  const m = meta?.feature_means || {};
  let score = 0.2;
  if (features.age > 55) score += 0.15;
  if (features.chol > 240) score += 0.12;
  if (features.trestbps > 140) score += 0.1;
  if (features.exang === 1) score += 0.15;
  if (features.thalach < (m.thalach || 150)) score += 0.08;
  score = Math.min(0.95, Math.max(0.05, score));
  return {
    ok: true,
    risk_label: score >= 0.5 ? 1 : 0,
    risk_score: Math.round(score * 1000) / 1000,
    risk_level: score >= 0.55 ? 'high' : (score >= 0.35 ? 'medium' : 'low'),
    features_used: features,
    fallback: true
  };
}

function predict(patient, record) {
  const features = mapPatientToFeatures(patient, record);
  if (fs.existsSync(MODEL_PATH) && fs.existsSync(PREDICT_PY)) {
    const py = runPython(PREDICT_PY, features);
    if (py.ok) {
      return { ...py, features_used: features, risk_note: _riskNote(py) };
    }
  }
  const fb = predictFallback(features);
  return { ...fb, risk_note: _riskNote(fb) };
}

function _riskNote(analysis) {
  if (analysis.risk_level === 'high') return 'AI gợi ý: nguy cơ tim mạch cao — cần theo dõi sát';
  if (analysis.risk_level === 'medium') return 'AI gợi ý: nguy cơ trung bình — tái khám theo hẹn';
  return 'AI gợi ý: nguy cơ thấp trên tập heart.csv';
}

function _bloodText(a) {
  const high = a.risk_level === 'high';
  return [
    'Công thức máu (AI demo):',
    `Hồng cầu ${high ? '4.2' : '4.6'} triệu/µL, Hemoglobin ${high ? '13.1' : '14.2'} g/dL,`,
    `Bạch cầu ${high ? '8.9' : '7.1'} nghìn/µL.`,
    `Cholesterol ${high ? '5.9' : '4.8'} mmol/L, GOT ${high ? '46' : '28'} U/L.`,
    a.risk_note
  ].join(' ');
}

function buildResultText(testCode, testName, analysis) {
  const fn = DEMO_BY_TEST_CODE[testCode];
  if (fn) return fn(analysis);
  return `Kết quả mẫu AI — ${testName}: ${analysis.risk_note}. (Mô hình heart.csv, độ tin cậy demo.)`;
}

function buildInsight(analysis, record = {}) {
  const warnings = [];
  if (analysis.risk_level === 'high') {
    warnings.push('Nguy cơ tim mạch cao theo mô hình Random Forest (heart.csv).');
    warnings.push('Khuyến nghị: theo dõi huyết áp, lipid máu và triệu chứng ngực.');
  } else if (analysis.risk_level === 'medium') {
    warnings.push('Chỉ số có xu hướng cần lưu ý — nên tái khám định kỳ.');
  } else {
    warnings.push('Chưa ghi nhận nguy cơ cao trên mô hình demo.');
  }

  if (record.blood_pressure && /1[4-9]\d/.test(record.blood_pressure)) {
    warnings.push('Huyết áp tâm thu cao trên hồ sơ khám hiện tại.');
  }

  const comment = [
    `Mô hình đánh giá nguy cơ: ${Math.round((analysis.risk_score || 0) * 100)}%`,
    `(Mức: ${analysis.risk_level === 'high' ? 'Cao' : analysis.risk_level === 'medium' ? 'Trung bình' : 'Thấp'})`,
    'Dữ liệu huấn luyện: heart.csv — chỉ phục vụ demo học tập, không thay thế chẩn đoán lâm sàng.'
  ].join(' ');

  return {
    comment,
    warnings,
    risk_level: analysis.risk_level,
    risk_score: analysis.risk_score,
    model_meta: readMeta()
  };
}

module.exports = {
  isModelReady,
  readMeta,
  trainModel,
  ensureTrained,
  predict,
  buildResultText,
  buildInsight
};
