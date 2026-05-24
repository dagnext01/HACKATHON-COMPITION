const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_FILE = path.join(__dirname, "data.json");
const INITIAL_DATA = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
let demoData = JSON.parse(JSON.stringify(INITIAL_DATA));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function readData() {
  return demoData;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("File not found");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function getStudentRecord(studentId) {
  const data = readData();
  const student = data.students.find(
    (item) => item.studentId.toLowerCase() === studentId.toLowerCase()
  );
  return { data, student };
}

function buildStudentResponse(student, transactions, banks) {
  const balance = Math.max(student.totalFeeDue - student.amountPaid, 0);
  return {
    studentId: student.studentId,
    fullName: student.fullName,
    department: student.department,
    programCode: student.programCode,
    semester: student.semester,
    academicYear: student.academicYear,
    costPerCredit: student.costPerCredit,
    courses: student.courses || [],
    totalFeeDue: student.totalFeeDue,
    amountPaid: student.amountPaid,
    balance,
    paymentStatus: student.paymentStatus,
    allowedBanks: banks || [],
    transactions
  };
}

function resetDemoData() {
  demoData = JSON.parse(JSON.stringify(INITIAL_DATA));
  return demoData;
}

function generateReceiptToken(studentId, amount, timestamp) {
  return crypto
    .createHash("sha256")
    .update(`${studentId}:${amount}:${timestamp}`)
    .digest("hex")
    .slice(0, 24);
}

function getStudentTransactions(data, studentId) {
  return data.transactions
    .filter((item) => item.studentId === studentId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function handleStudentLookup(res, studentId) {
  const { data, student } = getStudentRecord(studentId);
  if (!student) {
    sendJson(res, 404, { message: "Student not found" });
    return;
  }

  sendJson(
    res,
    200,
    buildStudentResponse(student, getStudentTransactions(data, student.studentId), data.banks)
  );
}

async function handleStudentLogin(req, res) {
  try {
    const body = await collectRequestBody(req);
    const studentId = String(body.studentId || "").trim();
    const password = String(body.password || "").trim();

    if (!studentId || !password) {
      sendJson(res, 400, { message: "Student ID and password are required" });
      return;
    }

    const { data, student } = getStudentRecord(studentId);
    if (!student || student.password !== password) {
      sendJson(res, 401, { message: "Invalid student ID or password" });
      return;
    }

    sendJson(
      res,
      200,
      buildStudentResponse(student, getStudentTransactions(data, student.studentId), data.banks)
    );
  } catch (error) {
    sendJson(res, 400, { message: error.message || "Unable to login" });
  }
}

async function handlePayment(req, res) {
  try {
    const body = await collectRequestBody(req);
    const studentId = String(body.studentId || "").trim();
    const password = String(body.password || "").trim();
    const bankName = String(body.bankName || "").trim();
    const amount = Number(body.amount);

    if (!studentId || !password || !bankName || !Number.isFinite(amount) || amount <= 0) {
      sendJson(res, 400, {
        message: "Valid studentId, password, bankName, and amount are required"
      });
      return;
    }

    const data = readData();
    const student = data.students.find(
      (item) => item.studentId.toLowerCase() === studentId.toLowerCase()
    );

    if (!student) {
      sendJson(res, 404, { message: "Student not found" });
      return;
    }

    if (student.password !== password) {
      sendJson(res, 401, { message: "Invalid password" });
      return;
    }

    if (!data.banks.includes(bankName)) {
      sendJson(res, 400, { message: "Selected bank is not supported" });
      return;
    }

    const currentBalance = Math.max(student.totalFeeDue - student.amountPaid, 0);
    if (currentBalance <= 0) {
      sendJson(res, 400, { message: "Student is already fully paid" });
      return;
    }

    const amountToApply = Math.min(amount, currentBalance);
    student.amountPaid += amountToApply;
    const newBalance = Math.max(student.totalFeeDue - student.amountPaid, 0);
    student.paymentStatus = newBalance === 0 ? "Paid" : "Partial";

    const timestamp = new Date().toISOString();
    const transaction = {
      transactionId: `TXN-${Date.now()}`,
      studentId: student.studentId,
      amountPaid: amountToApply,
      bankName,
      timestamp,
      receiptToken: generateReceiptToken(student.studentId, amountToApply, timestamp)
    };

    data.transactions.unshift(transaction);

    sendJson(res, 200, {
      message: "Payment successful",
      transaction,
      student: buildStudentResponse(
        student,
        getStudentTransactions(data, student.studentId),
        data.banks
      )
    });
  } catch (error) {
    sendJson(res, 400, { message: error.message || "Unable to process payment" });
  }
}

function handleReset(res) {
  const data = resetDemoData();
  sendJson(res, 200, { message: "Demo reset", students: data.students.length });
}

function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const normalized = path.normalize(safePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    sendFile(res, filePath);
  });
}

const server = http.createServer((req, res) => {
  const currentUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = currentUrl.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (req.method === "POST" && pathname === "/api/student/login") {
    handleStudentLogin(req, res);
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/api/student/")) {
    const studentId = decodeURIComponent(pathname.split("/").pop() || "");
    handleStudentLookup(res, studentId);
    return;
  }

  if (req.method === "POST" && pathname === "/api/payment") {
    handlePayment(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/reset") {
    handleReset(res);
    return;
  }

  if (req.method === "GET" && pathname === "/api/students") {
    const data = readData();
    const students = data.students.map((student) =>
      buildStudentResponse(
        student,
        getStudentTransactions(data, student.studentId),
        data.banks
      )
    );
    sendJson(res, 200, students);
    return;
  }

  serveStatic(res, pathname);
});

server.listen(PORT, () => {
  console.log(`UniPay MVP running at http://localhost:${PORT}`);
});
