
const express = require('express');
const router = express.Router();
const db = require('../db');
const moment = require('moment');
const mw = require('../middleware/middlewareFunctions');
router.get('/', mw.customerAuthentication, async(req, res) => {
    
        let retailerQry = `SELECT 
                          u.*, 
                          CASE 
                              WHEN EXISTS (
                                  SELECT 1 
                                  FROM servicable_pincode sp 
                                  WHERE sp.retailer_id = u.user_id 
                                    AND sp.postalcode = ?
                              ) THEN 1
                              ELSE 0
                          END AS isServiceable
                      FROM 
                          users u
                      WHERE 
                          u.usertype = ? 
                          AND u.status = ?
                      LIMIT 4;`;
        const [retailersData] = await db.promise().query(retailerQry, [req.session.user.address.postalcode,'retailer','active']);
        const data = { 
          title: 'Food Waste Reduction - Retailers', 
          user : req.session.user ? req.session.user: null,
          userCartCount:req.cartCount,
          retailersData : retailersData
  
    };
    console.log(data);
    res.render('customer/retailers', data);  
      
      
  });
  router.get('/fooditems/:retailer_id', mw.customerAuthentication,async(req, res) => {
    try{
            const retailer_id = req.params.retailer_id;
            let retailerQry = `SELECT u.*
                                FROM users u
                                WHERE u.user_id= ? AND u.usertype = 'retailer' AND u.status = 'active'`;
            const [retailersData] = await db.promise().query(retailerQry, [retailer_id,'retailer','active']);
            let sql;
            if(retailersData)
            {
              if(req.session.user.usertype=='consumer')
              {
                sql = 'SELECT fi.item_id,fi.slug, fi.name, fi.image, fi.price, fi.actual_price , FLOOR(((fi.actual_price - fi.price) / fi.actual_price) * 100) AS discount_percentage, u.name as retailer FROM food_items fi left join users u on u.user_id = fi.retailer_id  WHERE fi.is_available_for_sale = ? AND fi.expiration_date >= NOW() AND fi.retailer_id = ? ORDER BY fi.item_id DESC';
              }
              else
              {
                sql = 'SELECT fi.item_id,fi.slug, fi.name, fi.image, DATEDIFF(fi.expiration_date, NOW()) AS days_difference,  u.name as retailer FROM food_items fi left join users u on u.user_id = fi.retailer_id  WHERE fi.is_donated = ? AND fi.expiration_date >= NOW() AND fi.retailer_id = ? ORDER BY fi.item_id DESC';
              } 
                const [food_items] = await db.promise().query(sql, [true, retailersData[0].user_id]);
                const data = { 
                    title: 'Food Waste Reduction - food items' ,
                    food_items : food_items,
                    user : req.session.user ? req.session.user: null,
                    userCartCount : req.cartCount
                };
                res.render('customer/food_items', data);  
            

             }
        }catch(error)
        {
            res.status(500).send('Error in fetching data' + error.message);
        }   

  
});


module.exports = router;