const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { connectDB, getDB } = require("./Db"); // Import kết nối MongoDB

const app = express();

// Tạo thư mục public/images nếu chưa tồn tại
const uploadDir = path.join(__dirname, "public/images");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("Đã tạo thư mục public/images");
}

// Cấu hình multer để lưu file vào thư mục public/images/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images/");
  },
  filename: (req, file, cb) => {
    const cleanFileName = file.originalname.replace(/\s+/g, "_");
    cb(null, Date.now() + "-" + cleanFileName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ được upload file hình ảnh!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Middleware
app.use(express.static(path.join(__dirname, "public/pages")));
app.use("/images", express.static(path.join(__dirname, "public/images")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Kết nối MongoDB
connectDB().then(() => {
  // Trang index
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/pages/index.html"));
  });

  // Trang thêm sản phẩm
  app.get("/add", (req, res) => {
    res.sendFile(path.join(__dirname, "public/pages/add.html"));
  });
  app.get("/delete", (req, res) => {
    res.sendFile(__dirname + "/public/pages/delete.html");
  });
  app.get("/update", (req, res) => {
    res.sendFile(__dirname + "/public/pages/update.html");
  });

  // API lấy danh sách sản phẩm
  app.get("/api/products", async (req, res) => {
    try {
      const db = getDB();
      const sortOrder = req.query.sortOrder;
      let sortOption = { id: 1 }; // Mặc định sắp xếp theo ID tăng dần

      if (sortOrder === "asc") {
        sortOption = { price: 1 }; // Giá tăng dần
      } else if (sortOrder === "desc") {
        sortOption = { price: -1 }; // Giá giảm dần
      }

      const products = await db
        .collection("DsGuiTars")
        .find({})
        .sort(sortOption)
        .toArray();

      res.json(products);
    } catch (err) {
      console.error("Error fetching products:", err);
      res.status(500).send("Lỗi khi lấy danh sách sản phẩm");
    }
  });

  // API tìm kiếm sản phẩm
  app.get("/api/products/search", async (req, res) => {
    const keyword = req.query.keyword
      ? req.query.keyword.toLowerCase().trim()
      : "";
    const sortOrder = req.query.sortOrder;
    try {
      const db = getDB();
      let query = {};
      if (keyword) {
        query = {
          $or: [
            { name: { $regex: keyword, $options: "i" } },
            { id: { $regex: keyword, $options: "i" } },
          ],
        };
      }

      let sortOption = { id: 1 }; // Mặc định sắp xếp theo ID tăng dần
      if (sortOrder === "asc") {
        sortOption = { price: 1 }; // Giá tăng dần
      } else if (sortOrder === "desc") {
        sortOption = { price: -1 }; // Giá giảm dần
      }

      const products = await db
        .collection("DsGuiTars")
        .find(query)
        .sort(sortOption)
        .toArray();
      res.json(products);
    } catch (err) {
      console.error("Error searching products:", err);
      res.status(500).send("Lỗi khi tìm kiếm sản phẩm");
    }
  });

  // API thêm sản phẩm mới
  app.post("/api/products", upload.single("image"), async (req, res) => {
    try {
      const { name, description, price, xuat_su } = req.body;
      const image = req.file ? req.file.filename : null;

      if (!name || !description || !price || !xuat_su || !image) {
        return res
          .status(400)
          .send("Vui lòng điền đầy đủ thông tin sản phẩm và chọn hình ảnh!");
      }

      const db = getDB();

      // Tạo ID tự động (GTRSxxx)
      const lastProduct = await db
        .collection("DsGuiTars")
        .find()
        .sort({ id: -1 })
        .limit(1)
        .toArray();

      let maxId = 0;
      if (lastProduct.length > 0) {
        const lastId = lastProduct[0].id;
        const lastNumber = parseInt(lastId.replace("GTRS", ""));
        maxId = lastNumber;
      }

      const newId = "GTRS" + (maxId + 1).toString().padStart(4, "0");

      const newProduct = {
        id: newId,
        name,
        description,
        price: parseFloat(price),
        xuat_su,
        image,
        rating: "Chưa đánh giá",
        comments: [],
      };

      await db.collection("DsGuiTars").insertOne(newProduct);

      res.json({
        message: "Sản phẩm đã được thêm thành công!",
        product: newProduct,
      });
    } catch (err) {
      console.error("Error adding product:", err);
      res.status(500).send("Lỗi khi thêm sản phẩm: " + err.message);
    }
  });

  // API lấy chi tiết sản phẩm
  app.get("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const db = getDB();
      const product = await db.collection("DsGuiTars").findOne({ id: id });

      if (!product) {
        return res.status(404).send("Sản phẩm không tìm thấy");
      }

      res.json(product);
    } catch (err) {
      console.error("Error fetching product details:", err);
      res.status(500).send("Lỗi khi lấy chi tiết sản phẩm");
    }
  });

  // API lấy bình luận sản phẩm
  app.get("/api/products/:id/comments", async (req, res) => {
    const { id } = req.params;
    try {
      const db = getDB();
      const product = await db.collection("DsGuiTars").findOne({ id: id });
      if (!product) {
        return res.status(404).send("Sản phẩm không tìm thấy");
      }

      res.json(product.comments || []);
    } catch (err) {
      console.error("Error fetching product comments:", err);
      res.status(500).send("Lỗi khi lấy bình luận sản phẩm");
    }
  });

  // API xóa sản phẩm
  app.delete("/api/products/delete", async (req, res) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send("Không có ID sản phẩm để xóa.");
    }

    try {
      const db = getDB();
      const result = await db
        .collection("DsGuiTars")
        .deleteMany({ id: { $in: ids } });

      if (result.deletedCount === 0) {
        return res.status(404).send("Không tìm thấy sản phẩm nào để xóa.");
      }

      res.json({
        success: true,
        message: `${result.deletedCount} sản phẩm đã được xóa.`,
      });
    } catch (err) {
      console.error("Error deleting products:", err);
      res.status(500).send("Lỗi khi xóa sản phẩm");
    }
  });

  // API cập nhật sản phẩm
  app.put("/api/products/:id", upload.single("image"), async (req, res) => {
    const { id } = req.params;
    const { name, description, price, xuat_su } = req.body;
    const image = req.file ? req.file.filename : null;

    try {
      const db = getDB();
      const updateFields = {
        name,
        description,
        price: parseFloat(price),
        xuat_su,
      };
      if (image) {
        updateFields.image = image;
      }

      const result = await db
        .collection("DsGuiTars")
        .updateOne({ id }, { $set: updateFields });

      if (result.modifiedCount === 0) {
        return res
          .status(404)
          .send("Sản phẩm không tìm thấy hoặc không có thay đổi.");
      }

      res.json({ message: "Sản phẩm đã được cập nhật thành công!" });
    } catch (err) {
      console.error("Error updating product:", err);
      res.status(500).send("Lỗi khi cập nhật sản phẩm");
    }
  });

  // Khởi động server
  app.listen(3000, () => {
    console.log("Server is running on port 3000");
  });
});
