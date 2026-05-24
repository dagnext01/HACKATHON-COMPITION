# UniPay Hackathon MVP

UniPay is a simple university payment clearance website built for a hackathon demo. It replaces paper bank slips with an online status check, simulated payment flow, and instant staff verification.

## Features

- Student portal to search by student ID
- View fee total, amount paid, and current balance
- Simulated payment button for fast demo flow
- Automatic payment status update to `Paid` or `Partial`
- Digital receipt token generated for each transaction
- Staff verification page for registrar and department
- Seeded demo student data included

## Project Files

- `server.js` - Node server and API routes
- `data.json` - demo database for students and transactions
- `public/index.html` - student portal
- `public/staff.html` - staff verification dashboard
- `public/styles.css` - shared styling
- `public/app.js` - student portal logic
- `public/staff.js` - staff dashboard logic

## Run

1. Open the project folder in terminal
2. Run:

```bash
npm start
```

3. Open:

```text
http://localhost:3000
```

4. Staff verification page:

```text
http://localhost:3000/staff.html
```

## Demo Student IDs

- `STU001` - Unpaid
- `STU002` - Paid
- `STU003` - Partial

## Demo Flow For Judges

1. Open the student portal
2. Enter `STU001`
3. Show that the student is `Unpaid`
4. Click `Pay Balance Now`
5. Show the payment success and receipt token
6. Open the staff page
7. Search `STU001`
8. Show the `CLEARED` result instantly

## API Routes

- `GET /api/student/:id` - fetch one student profile
- `GET /api/students` - fetch all students
- `POST /api/payment` - simulate a payment

## Notes

- This is a hackathon MVP, so payment is simulated instead of connected to a real bank or mobile money provider.
- Data is stored in `data.json` for speed and simplicity.
