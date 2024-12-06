
const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const bcrypt = require('bcrypt');

const session = require('express-session');
const path = require('path');
const mw = require('../middleware/middlewareFunctions');

router.post('/edit_profile',mw.customerAuthentication, async (req, res) => {
    console.log(req.file);
    const {
     name,
    email,
     password,
      confirm_password,
      is_subscribed
  } = req.body;
  let isSubscribed = Array.isArray(is_subscribed) 
  ? is_subscribed.includes('true') || is_subscribed.includes('on') 
  : is_subscribed === 'true' || is_subscribed === 'on';
  const errors = [];
  const userid = req.session.user.user_id;
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
else{
    const userQuery = `SELECT * from users WHERE user_id != ? AND email like ?`;
    const [userObj] = await db.promise().query(userQuery, [userid, email]);
    console.log("userObj",userObj);
    if (userObj.length !== 0) 
    {
        errors.push(
            'Email already exists.'
        );
    }
    
}

  if (password != ''){
    if(typeof password !== 'string' ||
    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password)
) {
    errors.push(
        'Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.'
    );
}}

if (password != '' && !confirm_password) {
  errors.push('Confirm password missing.');
}
else if (password != '' && password !== confirm_password) {
    errors.push('Confirm password must match the password.');
}


  console.log(errors);
  // If there are errors, return them in the response
  if (errors.length > 0) {
      return res.status(400).json({ errors });
  }
  try{
    const hashedPassword = await bcrypt.hash(password, 10);
    let  sql, values;
    if (password != '')
    {
        sql = `UPDATE  users set name=? , email=? , password=?, is_subscribed = ? WHERE  user_id=?`;
        values = [name, email, hashedPassword,isSubscribed, userid];
    }
    else
    {
        sql = `UPDATE  users set name=? , email=?, is_subscribed=?  WHERE  user_id=?`;
        values = [name, email,isSubscribed, userid];
    }
   
  
  console.log(values);
  // Execute the query
  db.query(sql, values, (err, result) => {
      if (err) {
          console.error('Error inserting food item:', err);
          return res.status(500).json({ error: 'Edit profile failed. Try again!' });
      }
      res.status(201).json({
          message: 'success',
       });
  });
}catch (error) {
  res.status(500).json({ error: 'Server error.'+ error.message });
}
  });
router.get('/profile', mw.customerAuthentication,async(req, res) => {
    
    try{
    let orderData, addressData, itemData;
    const userid = req.session.user.user_id;
      const userQuery = `SELECT * from users WHERE user_id = ?`;
        const [userObj] = await db.promise().query(userQuery, [userid]);
       
        if (!userObj || userObj.length === 0) 
            res.status(500).send('No data found123');
        else{
            userData = userObj[0];
            
            const data = { 
                title: 'Food Waste Reduction - order Info', 
                message: 'Welcome to the platform!', 
                user : req.session.user ? req.session.user: null,
                userCartCount : req.cartCount,
                userData : userData,
                
                
                
            };
             res.render('customer/profile', data);
        }
        
    }catch(error)
    {
        res.status(500).send('Error in fetching data' + error.message);
    }      
       
      

  });
module.exports = router;