const { MongoClient } = require("mongodb");

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);
const dbName = "DsGuitar"; // Tên database
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db(dbName);
    console.log("✅ Đã kết nối MongoDB");
  } catch (err) {
    console.error("❌ Lỗi kết nối MongoDB:", err);
    throw err; // Ném lỗi để xử lý ở nơi gọi hàm
  }
}

function getDB() {
  if (!db) {
    throw new Error(
      "❌ Chưa kết nối tới cơ sở dữ liệu. Hãy gọi connectDB trước."
    );
  }
  return db;
}

module.exports = { connectDB, getDB };
