const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const multer = require('multer');
const QRCode = require('qrcode');
const path = require('path');
const Razorpay = require('razorpay');
const cron = require('node-cron');
require('dotenv').config();
const fs = require('fs');
const Tesseract = require('tesseract.js');

const Payment = require('./models/payment');
const User = require('./models/user');
const AppliedUser = require('./models/applied-users');
const Notification = require('./models/notification');

const app = express();
const PORT = process.env.PORT;


app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
const MongoStore = require('connect-mongo');

app.set('trust proxy', 1); // <- important for secure cookies behind Render's proxy

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 14 * 24 * 60 * 60, // 14 days
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production', // true only in production
      httpOnly: true,
      sameSite: 'none', // allow cross-site cookies
      maxAge: 14 * 24 * 60 * 60 * 1000
    }

  })
);


// MongoDB connection
const uri = process.env.MONGODB_URI;
mongoose.connect(uri)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `idproof-${Date.now()}${ext}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => res.redirect('/index'));
app.get('/index', (req, res) => res.render('index', { errorMessage: null }));
app.get('/signup', (req, res) => res.render('signup', { errorMessage: null }));
app.get('/login', (req, res) => res.render('login', { errorMessage: null }));
app.get('/admin', (req, res) => res.render('admin', { errorMessage: null }));
app.get('/payment', (req, res) => res.render('payment', { errorMessage: null }));

// Razorpay setup
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.post('/create-order', async (req, res) => {
  try {
    const amount = req.body.amount || 10000;
    console.log("Creating order with amount:", amount);

    const order = await razorpay.orders.create({
      amount: amount,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    });

    res.json(order);
  } catch (err) {
    console.error("Order Creation Error:", err);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
});

// Dashboard
app.get('/dashboard', async (req, res) => {
  

  if (!req.session.userId) return res.redirect('/login');
  const user = await User.findById(req.session.userId).lean();
  const latestApplication = await AppliedUser.findOne({ userId: user._id }).sort({ appliedAt: -1 }).lean();
  res.render('dashboard', {
    user: {
      ...user,
      passStatus: latestApplication?.passStatus || 'not_applied',
      qrData: latestApplication?.qrData || null,
      idProofPath: latestApplication?.idProofPath || null,
      passDetails: latestApplication?.passDetails || null,
    },
  });
});

app.get('/apply-pass', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const user = await User.findById(req.session.userId).lean();
  res.render('apply-pass', { user });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});


// Payment success
app.post('/payment-success', async (req, res) => {
  try {
    const { order_id, payment_id, amount, currency, fullName, from, to, duration, qrData } = req.body;

    const payment = await Payment.findOneAndUpdate(
      { orderId: order_id },
      {
        orderId: order_id,
        userId: req.session.userId || null,
        paymentId: payment_id,
        amount,
        currency,
        status: "paid",
        fullName,
        from,
        to,
        duration,
        qrData,
        createdAt: new Date()
      },
      { new: true, upsert: true } // <-- IMPORTANT: Create if not found
    );

    res.json({ success: true, receiptUrl: `/receipt/${payment.paymentId}` });
  } catch (error) {
    console.error("Payment success error:", error);
    res.json({ success: false, message: 'Error generating receipt' });
  }
});


// Receipt
app.get('/receipt/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findOne({ paymentId }).lean();
    if (!payment) return res.status(404).send("Receipt not found.");

    const receiptData = {
      date: payment.createdAt ? payment.createdAt.toLocaleString() : 'N/A',
      fullName: payment.fullName,
      from: payment.from,
      to: payment.to,
      duration: payment.duration,
      payment_id: payment.paymentId,
      order_id: payment.orderId || 'N/A',
      amount: payment.amount / 100,   // <-- FIXED (₹)
      currency: payment.currency,
      qrData: payment.qrData || null
    };

    res.render('receipt', { receipt: receiptData });
  } catch (error) {
    console.error("Error fetching receipt:", error);
    res.status(500).send('Error loading receipt');
  }
});

// Signup
app.post('/signup', async (req, res) => {
  const { username, email, phone, password } = req.body;
  try {
    if (await User.findOne({ username })) return res.render('signup', { errorMessage: 'Username already exists!' });
    if (await User.findOne({ email })) return res.render('signup', { errorMessage: 'Email already exists!' });
    if (await User.findOne({ phone })) return res.render('signup', { errorMessage: 'Phone number already registered!' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, phone, password: hashedPassword });
    await newUser.save();

    res.redirect('/login');
  } catch (err) {
    console.error('Signup error:', err);
    res.render('signup', { errorMessage: 'An error occurred during signup.' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && (await bcrypt.compare(password, user.password))) {

      
      req.session.userId = user._id;
      

      res.redirect('/dashboard');
    } else {
      res.render('login', { errorMessage: 'Invalid credentials. Please try again.' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { errorMessage: 'An error occurred during login.' });
  }
});

// Admin login
app.get('/adminlogin', (req, res) => res.render('adminlogin', { errorMessage: null }));
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  const admin = await User.findOne({ email, role: 'admin' });
  if (admin && await bcrypt.compare(password, admin.password)) {
    req.session.adminId = admin._id;
    return res.redirect('/admindashboard');
  } else res.send('Invalid admin credentials');
});

// Admin dashboard
app.get('/admindashboard', async (req, res) => {
  try {
    const totalApplications = await AppliedUser.countDocuments();
    const pendingApplications = await AppliedUser.countDocuments({ passStatus: 'manual_review' });
    const approvedApplications = await AppliedUser.countDocuments({ passStatus: 'approved' });

    res.render('admindashboard', { totalApplications, pendingApplications, approvedApplications });
  } catch (err) {
    console.error('Error loading admin dashboard:', err);
    res.status(500).send('Internal Server Error');
  }
});
app.get('/pending', async (req, res) => {
  try {
    const pendingApps = await AppliedUser.find({ passStatus: 'manual_review' })
      .populate('userId', 'username email')
      .lean();

    res.render('pending', { pendingApps });
  } catch (err) {
    console.error('Error loading pending applications:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/approve/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const application = await AppliedUser.findById(applicationId)
      .populate('userId', 'username email')
      .lean();

    if (!application) return res.status(404).send('Application not found.');

    res.render('approve', { application });
  } catch (err) {
    console.error('Error loading application for approval:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/admin/approve/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const application = await AppliedUser.findById(applicationId).populate('userId').lean();
    if (!application) return res.status(404).send('Application not found.');

    let qrImage = application.qrData;
    if (!qrImage) {
      const qrText = `From: ${application.passDetails.from}, To: ${application.passDetails.to}, Duration: ${application.passDetails.duration}, Valid Till: ${application.passDetails.validTill}`;
      qrImage = await QRCode.toDataURL(qrText);
    }

    await AppliedUser.findByIdAndUpdate(applicationId, {
      passStatus: 'approved',
      qrData: qrImage
    });

    // Notify user about approval
    await Notification.create({
      userId: application.userId._id,
      message: 'Your bus pass has been approved!'
    });

    res.redirect('/pending');
  } catch (err) {
    console.error('Error approving application:', err);
    res.status(500).send('Error approving application');
  }
});

app.post('/admin/reject/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { reason } = req.body;

    const application = await AppliedUser.findById(applicationId).populate('userId').lean();
    if (!application) return res.status(404).send('Application not found.');

    await AppliedUser.findByIdAndUpdate(applicationId, {
      passStatus: 'rejected',
      rejectionReason: reason || 'No reason provided'
    });







    // Notify user about rejection
    await Notification.create({
      userId: application.userId._id,
      message: `Your bus pass has been rejected. Reason: ${reason || 'No reason provided'}.`
    });

    res.redirect('/pending');
  } catch (err) {
    console.error('Error rejecting application:', err);
    res.status(500).send('Error rejecting application');
  }
});

// Approved + Rejected applications page
app.get('/approved', async (req, res) => {
  try {
    // Fetch approved and rejected applications
    const approvedApps = await AppliedUser.find({ passStatus: { $in: ['approved', 'rejected'] } })
      .populate('userId', 'username email')
      .lean();

    res.render('approved', { approvedApps });
  } catch (err) {
    console.error('Error loading approved/rejected passes:', err);
    res.status(500).send('Internal Server Error');
  }
});


// Search Users with latest pass info
app.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    let users;

    if (query) {
      // Search by username or email
      users = await User.find({
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      }).lean();
    } else {
      // Fetch all users if no query
      users = await User.find().lean();
    }

    // Attach each user's latest application
    const usersWithApps = await Promise.all(users.map(async (user) => {
      const latestApp = await AppliedUser.findOne({ userId: user._id })
        .sort({ appliedAt: -1 })
        .lean();
      return { user, latestApp };
    }));

    res.render('search', { usersWithApps, query });
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).send('Internal Server Error');
  }
});


// Apply-pass with OCR + QR
app.post('/apply-pass', upload.single('idProof'), async (req, res) => {
  const { from, to, duration, fullName, docNumber } = req.body;
  const userId = req.session.userId;
  if (!userId || !req.file) return res.status(400).send('Invalid request.');

  const idProofPath = req.file.filename;
  const imagePath = path.join(__dirname, 'uploads', idProofPath);
  let extractedText = '';

  try {
    const result = await Tesseract.recognize(imagePath, 'eng');
    extractedText = result.data.text.toLowerCase();
  } catch (err) {
    console.error("OCR Failed:", err);
  }

  const nameMatch = extractedText.includes(fullName.split(" ")[0].toLowerCase());
  const numberMatch = extractedText.replace(/\s/g, '').includes(docNumber.replace(/\s/g, ''));
  const isVerified = nameMatch && numberMatch;

  const validTill = new Date();
  if (duration === '7 Days') validTill.setDate(validTill.getDate() + 7);
  else if (duration === '15 Days') validTill.setDate(validTill.getDate() + 15);
  else validTill.setDate(validTill.getDate() + 30);

  const qrData = `From: ${from}, To: ${to}, Duration: ${duration}, Valid Till: ${validTill.toDateString()}`;
  const qrImage = await QRCode.toDataURL(qrData);

  const application = new AppliedUser({
    userId,
    idProofPath,
    passStatus: isVerified ? 'approved' : 'manual_review',
    qrData: isVerified ? qrImage : null,
    passDetails: { from, to, duration, validTill: validTill.toDateString() },
  });

  await application.save();

  if (!isVerified) {
    const existingNotification = await Notification.findOne({
      userId: null,
      message: { $regex: fullName, $options: 'i' },
      read: false
    });

    if (!existingNotification) {
      await Notification.create({
        message: `New bus pass application pending review from ${fullName}`,
        userId: null
      });
    }
  }

  await User.findByIdAndUpdate(userId, { passStatus: isVerified ? 'approved' : 'manual_review' });
  res.redirect('/dashboard');
});

// Notifications for expiring passes
cron.schedule('0 0 * * *', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const expiringPasses = await AppliedUser.find({
    "passDetails.validTill": tomorrow.toDateString(),
    passStatus: 'approved'
  }).populate('userId');

  for (let pass of expiringPasses) {
    await Notification.create({
      userId: pass.userId._id,
      message: `Your bus pass will expire on ${pass.passDetails.validTill}. Please renew.`
    });
  }
});

// User notifications
app.get('/user/notifications', async (req, res) => {
  if (!req.session.userId) return res.json([]);
  const notifications = await Notification.find({ userId: req.session.userId, read: false }).sort({ createdAt: -1 }).lean();
  await Notification.updateMany({ userId: req.session.userId, read: false }, { read: true });
  res.json(notifications);
});

// Admin notifications
app.get('/admin/notifications', async (req, res) => {
  const notifications = await Notification.find({ userId: null, read: false }).sort({ createdAt: -1 }).lean();
  res.json(notifications);
});

app.post('/notifications/read', async (req, res) => {
  if (!req.session.userId) return res.json({ success: false });
  await Notification.updateMany({ userId: req.session.userId, read: false }, { read: true });
  res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
