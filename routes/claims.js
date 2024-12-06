
const express = require('express');
const router = express.Router();
const moment = require('moment');
const db = require('../db');
const mw = require('../middleware/middlewareFunctions');
// Route for getting all purchases
router.get('/', mw.retailerAuthentication,async(req, res) => {
   
    try{
        let userCartCount,claimData;
        const cartQuery = `
      SELECT 
        fc.*,u.name as organisation,fi.name, fi.slug,fi.image 
        FROM 
        food_claims fc  
        LEFT JOIN food_items fi ON fi.item_id = fc.item_id 
        LEFT JOIN users u ON u.user_id = fc.charity_id 
        WHERE fc.retailer_id = ?   
       ORDER BY fc.claim_id   DESC 
    `;
    
      const [claims] = await db.promise().query(cartQuery,[req.session.user.user_id]);

      if(claims.length>0)
      {
         claimData = claims.map(item => ({
            claim_id : item.claim_id,
            name : item.name,
            organisation : item.organisation,
            claim_date : moment(item.claim_date).format('YYYY-MM-DD'),
            status: item.status,
            quantity : item.quantity,
          }))
      }
        const data = { 
            title: 'Food Waste Reduction - claims' ,
            claims : claimData
         };
         console.log(req.cartData);
         res.render('retailer/list_claims', data);

    
    }catch(error)
    {
        res.status(500).send('Error in fetching data'+ error.message);
    }
     
});

router.get('/:claim_id', mw.retailerAuthentication,async(req, res) => {
   
    try{
        const claim_id = req.params.claim_id;
        let qtyEdit = true;
    let orderData, addressData;
    const orderQuery = `
     SELECT 
        fc.*,u.name as consumer,fi.name, fi.slug,fi.quantity as stock,fi.image ,fi.description, u.name as organisation, DATEDIFF(expiration_date, NOW()) AS days_difference
        FROM 
        food_claims fc  
        LEFT JOIN food_items fi ON fi.item_id = fc.item_id 
        LEFT JOIN users u ON u.user_id = fc.charity_id    
      WHERE 
        fc.claim_id  = ?  
    `;
        const [claimObj] = await db.promise().query(orderQuery, [claim_id]);
        if (!claimObj || claimObj.length === 0) 
            res.status(500).send('No data found');
        else{
            claimData = claimObj[0];
            const [addressObj] = await db.promise().query('SELECT * FROM user_address WHERE address_id = ?', [claimData.address_id]);
            addressData = addressObj[0];
            const data = { 
                title: 'Food Waste Reduction - Claim Info', 
               
                addressData : addressData,
                claimData: claimData,
                claimStatuses : ['pending','approved','claimed','cancelled']
               
            };
             res.render('retailer/view_claim', data);
        }
        
    }catch(error)
    {
        res.status(500).send('Error in fetching data' + error.message);
    }      
       
      

  });

router.post('/change_status',  async(req, res) => {
  try{
    const {claim_id, status } = req.body;
    console.log(claim_id, status);
    const [claimData] = await db.promise().query('SELECT * FROM food_claims WHERE claim_id = ?', [claim_id]);
    console.log(claimData);     
    const sql1 = `
        UPDATE food_claims  SET status = ? WHERE claim_id= ?
    `;
    const values1 = [status,claim_id];
    db.query(sql1, values1, (err, result) => {
        if (err) {
            console.error('Error updating claim:', err);
            return res.status(500).json({ error: 'Database error while updating claim.' + err.message});
        }
        if(result)
        {
            if(status == 'claimed')
            {
                const sql1 = `
                INSERT INTO inventory_updates 
                (item_id , change_quantity, update_type,updated_by_user_id)
                VALUES (?, ?, ?, ?)
                `;
                const values1 = [claimData[0].item_id,parseInt(claimData[0].quantity),'claim', claimData[0].charity_id];
                db.query(sql1, values1, (err, result) => {
                    if (err) {
                        console.error('Error inserting inventory item:', err);
                        return res.status(500).json({ error: 'Database error while inserting inventory item.' + err.message});
                    }
                    if(result)
                    {
                      let sql2 = `UPDATE food_items
                          SET quantity = quantity - ?
                          WHERE item_id = ?  AND quantity >= ?`;
                      db.query(sql2, [parseInt(claimData[0].quantity),claimData[0].item_id,parseInt(claimData[0].quantity)], (err, result) => {
                        if (err) {
                            return res.status(500).json({ error: 'Something went wrong. Try again! ' + err.message });
                        }
                        res.status(201).json({
                            message:  'success'
                        });
                        
                     });
                        
                    }
                });
            }
            else {
                res.status(201).json({
                    message:  'success'
                });
            }
        }
    });

  }catch (error) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});
// Route for creating a new user
router.post('/', (req, res) => {
  const newUser = req.body; // Assuming you're sending JSON data
  res.send('User created');
});
router.get('/report', mw.retailerAuthentication,(req, res) => {
    const data = { title: 'Food Waste Reduction - claim' };
    res.render('retailer/report_claim', data); 
    
});
router.post('/generate-report', (req, res) => {
    try {
      const { from, to } = req.body;
      const errors = [];
  
      let sql = '';
      let values = [];
      const retailerId = req.session.user.user_id;
  
      // Validate Dates
      if (from && to && to < from) {
        errors.push('From date should not exceed To date.');
      }
  
      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }
  
      // Build SQL Query
      if (!from && to) {
        // Only `to` date provided
        sql = `
          SELECT fd.*, u.name 
          FROM food_order fd 
          LEFT JOIN users u ON u.user_id = fd.consumer_id 
          WHERE fd.retailer_id = ? 
            AND DATE(fd.purchase_date) <= ?
          ORDER BY fd.order_id DESC
        `;
        values = [retailerId, to];
      } else if (from && !to) {
        // Only `from` date provided
        sql = `
          SELECT fd.*, u.name 
          FROM food_order fd 
          LEFT JOIN users u ON u.user_id = fd.consumer_id 
          WHERE fd.retailer_id = ? 
            AND DATE(fd.purchase_date) >= ?
          ORDER BY fd.order_id DESC
        `;
        values = [retailerId, from];
      } else {
        // Both `from` and `to` dates provided
        sql = `
          SELECT fd.*, u.name 
          FROM food_order fd 
          LEFT JOIN users u ON u.user_id = fd.consumer_id 
          WHERE fd.retailer_id = ? 
            AND DATE(fd.purchase_date) BETWEEN ? AND ?
          ORDER BY fd.order_id DESC
        `;
        values = [retailerId, from, to];
      }
  
      // Execute Query
      db.query(sql, values, (err, results) => {
        if (err) {
          console.error('Error fetching report:', err.message);
          return res.status(500).json({ message: 'Database error.', error: err.message });
        }
  
        if (results.length === 0) {
          return res.status(404).json({ message: 'No records found for the given criteria.' });
        }
  
        // Format and Send Response
        const report = results.map((item) => ({
          order_id: item.order_id,
          order_unique: item.order_unique,
          consumer_id: item.consumer_id,
          address_id: item.address_id,
          total_price: item.total_price,
          delivery_charge: item.delivery_charge,
          grand_total: item.grand_total,
          status: item.status,
          purchase_date: moment(item.purchase_date).format('YYYY-MM-DD'),
        }));
  
        res.status(200).json({
          message: 'success',
          report,
        });
      });
    } catch (error) {
      console.error('Server error:', error.message);
      res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
  });
module.exports = router;