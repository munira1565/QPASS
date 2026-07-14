# QPASS – Smart Bus Pass Management System 🚌

QPASS is a web-based Smart Bus Pass Management System designed to simplify the process of applying, verifying, approving, and managing student bus passes digitally. The system eliminates paperwork by providing online pass applications, document verification, QR-based pass validation, and an administrative dashboard for efficient management.

##  Features

### Users Features

* User Registration & Login
* Secure Authentication
* Online Bus Pass Application
* Document Upload for Verification
* Online Payment 
* Application Status Tracking
* Digital Bus Pass Generation
* QR Code-Based Pass Verification
* Notification Updates

### Admin Features

* Admin Login Dashboard
* View All Applications
* Approve/Reject Applications
* Document Verification using OCR
* Manage Registered Users
* Track Pass Status
* Monitor Application History
* Generate Reports

## 🛠️ Tech Stack

### Frontend

* HTML
* CSS
* Bootstrap
* JavaScript
* EJS

### Backend

* Node.js
* Express.js

### Database

* MongoDB

### Other Technologies

* QR Code Generator
* Tesseract OCR
* Express Session
* Multer (File Upload)
* Mongoose

## 📂 Project Structure

```bash
QPASS/
│
├── models/
│   ├── User.js
│   ├── AppliedUser.js
│   ├── Payment.js
│   └── Notification.js
│
├── routes/
├── controllers/
├── middleware/
├── views/
├── public/
├── uploads/
├── config/
│
├── app.js
├── package.json
└── README.md
```

## ⚙️ Installation

### Clone the Repository

```bash
git clone https://github.com/your-username/QPASS.git
cd QPASS
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=your_secret_key
```

### Run the Application

```bash
npm start
```

For Development:

```bash
npm run dev
```

## 📖 How It Works

1. Student registers and logs into the platform.
2. Student submits a bus pass application.
3. Required documents are uploaded for verification.
4. OCR technology extracts and validates document information.
5. Admin reviews the application.
6. Application is approved or rejected.
7. Approved users receive a digital bus pass with a unique QR code.
8. QR code can be scanned for quick verification.

## 🔒 Security Features

* Password Authentication
* Session Management
* Protected Routes
* Role-Based Access Control
* Secure File Upload Handling

## 🎯 Future Enhancements

* Mobile Application Support
* Email Notifications
* SMS Alerts
* AI-Based Document Validation
* Real-Time Bus Tracking

## 👨‍💻 Author

**Munira Lambuwale**

B.E. Computer Engineering Student
AIKTC, University of Mumbai

### Connect With Me

* GitHub: https://github.com/munira1565
* LinkedIn: linkedin.com/in/munira-lambuwale-014851291

