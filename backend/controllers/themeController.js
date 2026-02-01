import ThemeConfig from "../models/ThemeConfig.js";

/** helper: Map<k,v> to array & back */
function mapToArray(obj = {}) {
  return Object.entries(obj).map(([key, value]) => ({ key, value }));
}
function arrayToObject(arr = []) {
  const out = {};
  for (const it of arr) out[it.key] = it.value;
  return out;
}

/** Public GET — Aktif temayı döner */
export async function getPublicTheme(req, res) {
  try {
    const doc =
      (await ThemeConfig.findOne({ singleton: "theme_config" }).lean()) || null;

    if (!doc) {
      return res.json({
        theme: {
          activeKey: "rosewood",
          store: {},
          admin: {},
        },
      });
    }

    return res.json({
      theme: {
        activeKey: doc.activeKey || "custom",
        store: arrayToObject(doc.storeVars || []),
        admin: arrayToObject(doc.adminVars || []),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/** Admin GET — Yönetim için ayrıntılı getir */
export async function getManageTheme(req, res) {
  try {
    const doc =
      (await ThemeConfig.findOne({ singleton: "theme_config" }).lean()) || null;

    if (!doc) {
      return res.json({
        theme: {
          activeKey: "rosewood",
          store: {},
          admin: {},
          presets: [],
        },
      });
    }

    res.json({
      theme: {
        activeKey: doc.activeKey || "custom",
        store: arrayToObject(doc.storeVars || []),
        admin: arrayToObject(doc.adminVars || []),
        presets: doc.presets || [],
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/** Admin PUT — Aktif temayı kaydet (store/admin değişkenleriyle) */
export async function upsertTheme(req, res) {
  try {
    const body = req.body || {};
    const activeKey = String(body.activeKey || "custom");
    const store = body.store || {};
    const admin = body.admin || {};
    const presets = Array.isArray(body.presets) ? body.presets : undefined;

    const update = {
      singleton: "theme_config",
      activeKey,
      storeVars: mapToArray(store),
      adminVars: mapToArray(admin),
    };
    if (presets) update.presets = presets;

    const doc = await ThemeConfig.findOneAndUpdate(
      { singleton: "theme_config" },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      theme: {
        activeKey: doc.activeKey || "custom",
        store: arrayToObject(doc.storeVars || []),
        admin: arrayToObject(doc.adminVars || []),
        presets: doc.presets || [],
      },
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}
