
const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const bcrypt = require('bcrypt');
const path = require('path');
// Route for getting all items
router.get('/', (req, res) => {
    const data = { title: 'Food Waste Reduction - Registration' };
    res.render('register', data);  
  });
  // Set up storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, 'public/uploads/'); // Directory to store files
  },
  filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + file.originalname;
      cb(null, uniqueName);
  }
});

// File filter for image validation
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|webp/;
  const mimeType = allowedFileTypes.test(file.mimetype);
  const extName = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());

  if (mimeType && extName) {
      cb(null, true);
  } else {
      cb(new Error('Only JPEG and PNG files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit: 5MB
});
router.post('/submit',upload.single('logo'), async (req, res) => {
    console.log(req.file);
    const {
      usertype,
      name,
      email,
      logo,
      password,
      confirm_password,
      cond,
      is_subscribed
  } = req.body;
  const logoPath = req.file ? req.file.filename : null;
  const errors = [];
  let isSubscribed = Array.isArray(is_subscribed) 
  ? is_subscribed.includes('true') || is_subscribed.includes('on') 
  : is_subscribed === 'true' || is_subscribed === 'on';
  // Validate input
  if (!usertype || !['retailer', 'consumer', 'charity'].includes(usertype)) {
    errors.push('User type is invalid.');
}
  if (!name || typeof name !== 'string' || name.trim() === '') {
      errors.push('Name is required and must be a string.');
  }
  const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (
    !emailPattern.test(email)
) {
    errors.push(
        'Valid email required.'
    );
}
  if (!password) {
    errors.push('Password missing.');
  }
  else if (
    typeof password !== 'string' ||
    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password)
) {
    errors.push(
        'Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.'
    );
}

if (!confirm_password) {
  errors.push('Confirm password missing.');
}
else if (password !== confirm_password) {
    errors.push('Confirm password must match the password.');
}

  if (!cond) {
      errors.push('Must accept the terms and condition.');
  }
  if (usertype === 'retailer' && !req.file) {
    errors.push('Logo is required for retailers.');
}
  console.log(errors);
  // If there are errors, return them in the response
  if (errors.length > 0) {
      return res.status(400).json({ errors });
  }
  try{
    const hashedPassword = await bcrypt.hash(password, 10);
  const sql = `
      INSERT INTO users 
      (name, email, password, usertype, status, logo, is_subscribed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    name, email, hashedPassword, usertype, 'active', logoPath, isSubscribed ];
  
  console.log(values);
 

  db.query(sql, values, (err, result) => {
      if (err) {
          console.error('Error inserting food item:', err);
          return res.status(500).json({ error: 'Registration failed. Try again!' });
      }
      res.status(201).json({
          message: 'Registration completed successfully.',
          item_id: result.insertId,
      });
  });
}catch (error) {
  res.status(500).json({ success: false, message: 'Server error.', error: error.message });
}
  });
module.exports = router;