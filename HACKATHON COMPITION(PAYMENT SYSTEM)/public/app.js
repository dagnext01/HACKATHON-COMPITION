const lookupForm = document.getElementById("lookup-form");
const studentIdInput = document.getElementById("studentId");
const passwordInput = document.getElementById("password");
const messageEl = document.getElementById("message");
const studentCardEl = document.getElementById("student-card");

resetDemoOnLoad();

async function resetDemoOnLoad() {
  try {
    await fetch("/api/reset", { method: "POST" });
  } catch (error) {
    console.error("Unable to reset demo state", error);
  }
}

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const studentId = studentIdInput.value.trim();
  const password = passwordInput.value.trim();
  if (!studentId || !password) return;

  messageEl.classList.remove("hidden");
  studentCardEl.classList.add("hidden");
  messageEl.textContent = "Loading student profile...";

  try {
    const response = await fetch("/api/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, password })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "Login failed");
    }

    renderStudent(payload);
  } catch (error) {
    studentCardEl.classList.add("hidden");
    messageEl.classList.remove("hidden");
    messageEl.textContent = error.message;
  }
});

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 0
  }).format(value);
}

function renderStudent(student) {
  const statusClass = student.paymentStatus.toLowerCase();
  const latestReceipt = student.transactions[0];
  const balanceText = student.balance === 0 ? "No balance due" : currency(student.balance);
  const bankOptions = student.allowedBanks
    .map((bank) => `<option value="${bank}">${bank}</option>`)
    .join("");
  const courseRows = student.courses
    .map(
      (course) => `
        <tr>
          <td>${course.courseCode}</td>
          <td>${course.courseTitle}</td>
          <td>${course.creditHours}</td>
          <td>${currency(student.costPerCredit)}</td>
          <td>${currency(course.creditHours * student.costPerCredit)}</td>
        </tr>
      `
    )
    .join("");

  studentCardEl.innerHTML = `
    <div class="student-details">
      <div>
        <h3>${student.fullName}</h3>
        <p class="meta">${student.studentId} | ${student.department} | ${student.semester}</p>
        <span class="status ${statusClass}">${student.paymentStatus}</span>
      </div>

      <div class="receipt slip-paper">
        <div class="slip-header">
          <div>
            <p class="slip-title">St. Mary's University</p>
            <p class="slip-subtitle">Student Semester Registration Slip</p>
          </div>
          <div class="slip-meta">
            <div><strong>Year:</strong> ${student.academicYear}</div>
            <div><strong>Semester:</strong> ${student.semester}</div>
          </div>
        </div>

        <div class="slip-student-meta">
          <div><strong>Name:</strong> ${student.fullName}</div>
          <div><strong>ID:</strong> ${student.studentId}</div>
          <div><strong>Department:</strong> ${student.department}</div>
          <div><strong>Program:</strong> ${student.programCode}</div>
        </div>

        <table class="slip-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Course Title</th>
              <th>Credit Hour</th>
              <th>Cost / Credit</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${courseRows}
            <tr class="slip-total-row">
              <td colspan="4">Semester Total</td>
              <td>${currency(student.totalFeeDue)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="small">Total Fee</span>
          <strong>${currency(student.totalFeeDue)}</strong>
        </div>
        <div class="stat">
          <span class="small">Amount Paid</span>
          <strong>${currency(student.amountPaid)}</strong>
        </div>
        <div class="stat">
          <span class="small">Balance</span>
          <strong>${balanceText}</strong>
        </div>
      </div>

      ${
        student.balance > 0
          ? `
        <div class="payment-box">
          <h3>Complete Payment</h3>
          <p class="meta">Approved banks for this university: Bank of Abyssinia, Zemen Bank, and Awash Bank.</p>
          <form id="payment-form" class="inline-form">
            <select id="bankName" required>
              ${bankOptions}
            </select>
            <input type="number" id="amount" min="1" max="${student.balance}" value="${student.balance}" required />
            <button type="submit">Pay Balance Now</button>
          </form>
        </div>
      `
          : `
        <div class="receipt">
          <h3>Digital Clearance Ready</h3>
          <p class="meta">This student has fully completed semester payment.</p>
        </div>
      `
      }

      ${
        latestReceipt
          ? `
        <div class="receipt">
          <h3>Latest Receipt</h3>
          <p><strong>Transaction:</strong> ${latestReceipt.transactionId}</p>
          <p><strong>Bank:</strong> ${latestReceipt.bankName || "University Gateway"}</p>
          <p><strong>Receipt Token:</strong> ${latestReceipt.receiptToken}</p>
          <p><strong>Paid:</strong> ${currency(latestReceipt.amountPaid)}</p>
          <p class="meta">${new Date(latestReceipt.timestamp).toLocaleString()}</p>
        </div>
      `
          : ""
      }

      <div>
        <h3>Transaction History</h3>
        <div class="transactions">
          ${
            student.transactions.length
              ? student.transactions
                  .map(
                    (txn) => `
              <div class="transaction-item">
                <strong>${txn.transactionId}</strong>
                <div>${currency(txn.amountPaid)} paid</div>
                <div class="small">${txn.bankName || "University Gateway"}</div>
                <div class="small">${txn.receiptToken}</div>
              </div>
            `
                  )
                  .join("")
              : `<div class="transaction-item">No payments recorded yet.</div>`
          }
        </div>
      </div>
    </div>
  `;

  messageEl.classList.add("hidden");
  studentCardEl.classList.remove("hidden");

  const paymentForm = document.getElementById("payment-form");
  if (paymentForm) {
    paymentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const amount = Number(document.getElementById("amount").value);
      const bankName = document.getElementById("bankName").value;

      const response = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.studentId,
          password: passwordInput.value.trim(),
          bankName,
          amount
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        alert(payload.message || "Payment failed");
        return;
      }

      renderStudent(payload.student);
      alert(`Payment successful through ${payload.transaction.bankName}. Receipt token: ${payload.transaction.receiptToken}`);
    });
  }
}
