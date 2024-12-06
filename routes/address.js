
const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const authentication = require('../middleware/middlewareFunctions');


router.post('/submit_newaddress', async(req, res) => {
  
    const { name, address1, address2, city, state, country, postalcode } = req.body;
    const errors = [];
    if (!name) {
       errors.push('Name is required.');
    } 
    if (!address1) {
        errors.push('Address1 is required.');
    } 
    
    if (!state) {
        errors.push('Province is required.');
    }
    if (!city) {
        errors.push('City is required.');
    }
    if (!postalcode) {
    errors.push('City is required.');
    }
    else if (
        !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(postalcode)
    )
    {
        errors.push('Postal is not valid');
    }
   console.log(errors);
  // If there are errors, return them in the response
  if (errors.length > 0) {
      return res.status(400).json({ errors });
  }
  try{
        const sql = `
        INSERT INTO user_address 
        (user_id , name, address1, address2, city, state, country, postalcode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const values = [req.session.user.user_id, name, address1, address2, city, state, country, postalcode];
        // Execute the query
        db.query(sql, values, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Something went wrong. Try again! ' + err.message});
            }
            return res.status(200).json({ message: 'success'});
        });
    }catch (error) {
        res.status(500).json({ message: "failed", error: error.message });
    }
});

  router.post('/getaddresses', async(req, res) => {
  
    const {
        user_id,
  } = req.body;
 console.log("user_id",user_id);
  try{
       
        const sql = `SELECT * FROM  user_address  WHERE user_id = ?`;
        const values = [user_id];
        // Execute the query
        db.query(sql, values, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Something went wrong. Try again!' });
            }
            if(result.length === 0)
            {
                return res.status(200).json({ addresses : null});
            }
            const addresses = result.map(item => ({
                id : item.address_id,
                name : item.name,
                address1 : item.address1,
                address2 : item.address2,
                city : item.city,
                state: item.state,
                country : item.country,
                postalcode : item.postalcode,
              }));
              return res.status(200).json({ addresses : addresses});
            
        });
    }catch (error) {
        res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
});
router.post('/setaddresses', async(req, res) => {
  
    const {
        address_id,
  } = req.body;

  try{
       
        const sql = `SELECT * FROM  user_address  WHERE address_id = ?`;
        const values = [address_id];
        // Execute the query
        db.query(sql, values, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Something went wrong. Try again!' });
            }
            if(result.length === 0)
            {
                return res.status(400).json({ addresses : null, error: 'Unable to choose address!'});
            }
            const address = result[0];
            
            const add = {
                id : address.address_id,
                name : address.name,
                address1 : address.address1,
                address2 : address.address2,
                city : address.city,
                state: address.state,
                country : address.country,
                postalcode : address.postalcode,
              }
              req.session.user.address = add;
              console.log("address_id", add);
              return res.status(200).json({ success : true, address : add});
            
        });
    }catch (error) {
        res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
});
module.exports = router;