import multer from "multer";

const storage = multer.memoryStorage();

// 5MB sınırı kalsın; sadece toplam dosya adedini artırıyoruz.
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 50 }, // <<< 10 -> 50
});

const HERO_MAX_MB = Number(process.env.HERO_MAX_FILE_MB || 80);
export const uploadHeroMedia = multer({
  storage,
  limits: {
    fileSize: HERO_MAX_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype?.startsWith("image/") ||
      file.mimetype?.startsWith("video/");
    if (!ok) return cb(new Error("Only image/* or video/* allowed"));
    cb(null, true);
  },
});

export default upload;
