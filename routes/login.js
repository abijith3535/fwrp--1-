
const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

router.get('/', (req, res) => {
    if(req.session.user )
    { 
        if(req.session.user.usertype=='retailer')
        {
            return res.redirect('/retailer/dashboard');
        }
        else{
            return res.redirect('/home');
        }
    }
    else{
        const data = { title: 'Food Waste Reduction - Login', message: 'Welcome to the platform!' };
        res.render('login', data); 
    } 
  });



  router.post('/submit', async(req, res) => {
  
    const {
        email,
      password,
  } = req.body;
 
  const errors = [];
    console.log(req.body);
 
  if (!password) {
    errors.push('Password is required.');
  }
 if (
    !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zAZ]{2,6}$/.test(email)
) {
    errors.push(
        'Email is required'
    );
}

  console.log(errors);
  // If there are errors, return them in the response
  if (errors.length > 0) {
      return res.status(400).json({ errors });
  }
  try{
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('bcrypt',await bcrypt.hash('Pass@123', 10));
        const sql = `SELECT * FROM  users WHERE email = ?`;
        const values = [email];
        // Execute the query
        db.query(sql, values, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Something went wrong. Try again!' });
            }
            if(result.length === 0)
            {
                return res.status(400).json({ error: 'Invalid email' });
            }
            const user = result[0];
            
            bcrypt.compare(password, user.password, (err, isMatch) => {
               
                if (err) {
                    return res.status(500).json({ error: 'Error while comparing passwords' });
                }
                if (isMatch) {
                   
                   req.session.user = {
                        user_id: user.user_id,
                        name: user.name,
                        email: user.email,
                        logo : user.logo,
                        usertype: user.usertype
                    };
                    const siteName = req.app.locals.siteName;
                    console.log(user);
                    if (user.usertype === 'retailer') {
                        var redirectPath = `${siteName}/retailer/dashboard`;
                    } else {
                        var redirectPath = `${siteName}`;
                    }
                    return res.status(200).json({ message: 'Login successful' ,redirectPath : redirectPath});
                } else {
                    return res.status(400).json({ error: 'Invalid email or password' });
                }
            });
        });
    }catch (error) {
        res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
});
module.exports = router;