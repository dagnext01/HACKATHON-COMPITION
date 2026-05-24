const staffForm = document.getElementById("staff-form");
const staffInput = document.getElementById("staffStudentId");
const staffResult = document.getElementById("staff-result");

staffForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const studentId = staffInput.value.trim();
  if (!studentId) return;

  staffResult.textContent = "Checking clearance status...";

  try {
    const response = await fetch(`/api/student/${encodeURIComponent(studentId)}`);
    const student = await response.json();

    if (!response.ok) {
      throw new Error(student.message || "Student not found");
    }

    const cleared = student.paymentStatus === "Paid";
    const statusClass = cleared ? "cleared" : "pending";
    const balanceText = student.balance === 0 ? "" : new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "ETB",
      maximumFractionDigits: 0
    }).format(student.balance);

    staffResult.innerHTML = `
      <div class="clearance ${statusClass}">
        <div class="clearance-mark">${cleared ? "CLEARED" : "PENDING"}</div>
        <p><strong>${student.fullName}</strong></p>
        <p>${student.studentId} | ${student.department}</p>
        <p>Semester: ${student.semester}</p>
        <p>Status: <strong>${student.paymentStatus}</strong></p>
        
      </div>
    `;
  } catch (error) {
    staffResult.textContent = error.message;
  }
});
//<p>Balance: <strong>${balanceText}</strong></p>