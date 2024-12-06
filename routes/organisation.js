
const express = require('express');
const router = express.Router();
const db = require('../db');
const moment = require('moment');
const multer = require('multer');
const bcrypt = require('bcrypt');

const session = require('express-session');
const path = require('path');
const mw = require('../middleware/middlewareFunctions');



router.get('/claim/:claim_id', mw.customerAuthentication, async(req, res) => {
    const claim_id = req.params.claim_id;
    let qtyEdit = true;
    try{
    let orderData, addressData;
    const orderQuery = `
     SELECT 
        fc.*,u.name as consumer,fi.name, fi.slug,fi.image ,fi.description, r.name as retailer
        FROM 
        food_claims fc  
        LEFT JOIN food_items fi ON fi.item_id = fc.item_id 
        LEFT JOIN users r ON r.user_id = fi.retailer_id  
        LEFT JOIN users u ON u.user_id = fc.charity_id    
      WHERE 
        fc.claim_id  = ?  
    `;
        const [claimObj] = await db.promise().query(orderQuery, [claim_id]);
        if (!claimObj || claimObj.length === 0) 
            res.status(500).send('No data found123');
        else{
            claimData = claimObj[0];
            const [addressObj] = await db.promise().query('SELECT * FROM user_address WHERE address_id = ?', [claimData.address_id]);
            addressData = addressObj[0];
            const data = { 
                title: 'Food Waste Reduction - Claim Info', 
                message: 'Welcome to the platform!', 
                user : req.session.user ? req.session.user: null,
                userCartCount : 0,
                addressData : addressData,
                claimData: claimData,
               
            };
             res.render('customer/single_claim', data);
        }
        
    }catch(error)
    {
        res.status(500).send('Error in fetching data' + error.message);
    }      
       
      

  });
    
router.get('/claims',mw.customerAuthentication,  async(req, res) => {
    let userCartCount,claimData;
    try{
         
        const cartQuery = `
      SELECT 
        fc.*,u.name as consumer,fi.name, fi.slug,fi.image 
        FROM 
        food_claims fc  
        LEFT JOIN food_items fi ON fi.item_id = fc.item_id 
        LEFT JOIN users u ON u.user_id = fc.charity_id    
      WHERE 
        fc.charity_id  = ? ORDER BY fc.claim_id   DESC 
    `;
      const userId = req.session.user.user_id;
      const [claims] = await db.promise().query(cartQuery, [userId]);

      if(claims.length>0)
      {
         claimData = claims.map(item => ({
            claim_id : item.claim_id,
            name : item.name,
            claim_date : moment(item.claim_date).format('YYYY-MM-DD'),
            status: item.status,
            quantity : item.quantity,
          }))
      }
        const data = { 
            title: 'Food Waste Reduction - Claims', 
            message: 'Welcome to the platform!', 
            user : req.session.user ? req.session.user: null,
            claims : claimData
         };
         console.log(req.cartData);
         res.render('customer/claims', data);

    
    }catch(error)
    {
        res.status(500).send('Error in fetching data'+ error.message);
    }
    
    
  });

  router.post('/addtoclaim',mw.customerAuthentication, async(req, res) => {
  
    const {
       item_id,
       quantity,
       action,
       claim_id
  } = req.body;
 
  const errors = [];
    console.log(req.body);
    let flag=true;
    let error = '';
  
  try{
        let postalcode = req.session.user.address.postalcode;
        const [itemData] = await db.promise().query('SELECT * FROM food_items WHERE item_id = ?', [item_id]);
        console.log(itemData[0].quantity,quantity);
        if(parseInt(itemData[0].quantity)>parseInt(quantity))
        {
            const [serviceble] = await db.promise().query('SELECT * FROM `servicable_pincode` WHERE retailer_id = ? AND postalcode= ?', [itemData[0].retailer_id,postalcode]);
            if(serviceble.length!==0)
            {
                flag = true;
            }
            else
            {
                flag = false;
                error = "Item is not serviceable at your location";
            }
        }
        else
        {
            flag = false;
            error = "Unable to claim much quantity";
        }
        if(flag)
        {
            let sql, values;
            if(action == 'add'){
             sql = `
                    INSERT INTO food_claims 
                    (item_id, retailer_id, quantity, charity_id, address_id, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                values = [item_id, itemData[0].retailer_id, quantity, req.session.user.user_id, req.session.user.address.id, 'pending'];
            }
            else{
                sql = `
                    UPDATE food_claims 
                    SET quantity=? WHERE claim_id= ?
                `;
                values = [quantity, claim_id];
            
            }
            db.query(sql, values, (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Something went wrong. Try again! ' + err.message });
                }
                const siteName = req.app.locals.siteName;
                return res.status(200).json({ message: 'success',url: `${siteName}/organisation/claims`});
                
            });
        }
        else res.status(500).json({ message: 'failed', error: error});

        
    }catch (error) {
        res.status(500).json({ message: 'failed', error: error.message });
    }
});
module.exports = router;