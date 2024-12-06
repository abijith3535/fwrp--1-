
const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const bcrypt = require('bcrypt');

const session = require('express-session');
const path = require('path');
const mw = require('../middleware/middlewareFunctions');



router.get('/order/:orderKey',mw.customerAuthentication, async(req, res) => {
    const orderKey = req.params.orderKey;
    try{
    let orderData, addressData, itemData;
    const orderQuery = `
      SELECT 
        fc.*,u.name as consumer
        FROM 
        food_order fc  
        LEFT JOIN users u ON u.user_id = fc.consumer_id   
      WHERE 
        fc.order_unique = ?`;
        const [orderObj] = await db.promise().query(orderQuery, [orderKey]);
        console.log(orderObj[0]);
        if (!orderObj || orderObj.length === 0) 
            res.status(500).send('No data found123');
        else{
            orderData = orderObj[0];
            const itemQuery = `
            SELECT 
                fc.purchase_id, fc.item_id, fi.slug, fi.name, fi.image, fi.quantity AS stock,fi.retailer_id, 
                fc.discount_price, fc.quantity, fc.total_price, u.name AS retailer
            FROM 
                food_purchases fc  
                LEFT JOIN food_items fi ON fi.item_id = fc.item_id  
                LEFT JOIN users u ON u.user_id = fi.retailer_id   
            WHERE 
                fc.order_id = ?;
            `;
            const [itemObj] = await db.promise().query(itemQuery, [orderData.order_id]);
            const [addressObj] = await db.promise().query('SELECT * FROM user_address WHERE address_id = ?', [orderData.address_id]);
            addressData = addressObj[0];
            itemData = itemObj;
            const data = { 
                title: 'Food Waste Reduction - order Info', 
                message: 'Welcome to the platform!', 
                user : req.session.user ? req.session.user: null,
                userCartCount : req.cartCount,
                addressData : addressData,
                orderData: orderData,
                itemData:itemData
                
            };
             res.render('customer/single_order', data);
        }
        
    }catch(error)
    {
        res.status(500).send('Error in fetching data' + error.message);
    }      
       
      

  });
    
router.get('/orders', mw.customerAuthentication,async(req, res) => {
    
    try{
         
        const cartQuery = `
      SELECT 
        fc.*,u.name as consumer
        FROM 
        food_order fc  
        LEFT JOIN users u ON u.user_id = fc.consumer_id   
      WHERE 
        fc.consumer_id = ? ORDER BY fc.order_id  DESC 
    `;
      const userId = req.session.user.user_id;
      const [orders] = await db.promise().query(cartQuery, [userId]);
        const data = { 
            title: 'Food Waste Reduction - Orders', 
            message: 'Welcome to the platform!', 
            user : req.session.user ? req.session.user: null,
            userCartCount : req.cartCount,
            cartData : req.cartData,
            orders : orders
         };
         console.log(req.cartData);
         res.render('customer/orders', data);

    
    }catch(error)
    {
        res.status(500).send('Error in fetching data');
    }
    
    
  });

router.get('/cart', mw.customerAuthentication,mw.checkCartItems,async(req, res) => {
    
    try{
         
        
        const data = { 
            title: 'Food Waste Reduction - Cart summary', 
            message: 'Welcome to the platform!', 
            user : req.session.user ? req.session.user: null,
            userCartCount : req.cartCount,
            cartData : req.cartData,
            checkoutFlag : req.checkoutFlag,
            orderCount : req.retailerIds ? req.retailerIds.length : 0
         };
         console.log(req.cartData);
         res.render('customer/cart', data);

    
    }catch(error)
    {
        res.status(500).send('Error in fetching data ' + error.message);
    }
    
    
  });
  router.get('/checkout', mw.customerAuthentication,mw.checkCartItems,async(req, res) => {
    let  userAddress;
    let sub_total = 0;
    let grand_total = 0;
    const delievryCharge = req.app.locals.delievryCharge * req.retailerIds.length;
    try{
        
        
        const [useradd] = await db.promise().query('SELECT * FROM user_address WHERE address_id = ?', [req.session.user.address.id]);
        userAddress =   useradd;  
        console.log("userAddress",req.session.user.address.id);
        let sql = `SELECT * FROM food_cart  WHERE consumer_id=?`;
            const values = [req.session.user.user_id];
            db.query(sql, values, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Something went wrong during cart fetch. Try again!' });
            }
            if(result.length>0)
            {
                
                for(let i=0;i< result.length ;i++)
                {
                    sub_total = parseFloat(result[i].total_price)  + parseFloat(sub_total);
                }
                grand_total = parseFloat(delievryCharge) + sub_total;
            }
            const data = { 
                title: 'Food Waste Reduction - Confirm order', 
                message: 'Welcome to the platform!', 
                user : req.session.user ? req.session.user: null,
                userCartCount : req.cartCount,
                userAddress : userAddress,
                subTotal : sub_total,
                delievryCharge : delievryCharge,
                grandTotal : grand_total
            };
             res.render('customer/checkout', data);
        });
 }catch(error)
{
    res.status(500).send('Error in fetching data');
}


});
router.post('/confirm_checkout',mw.customerAuthentication, mw.checkCartItems,mw.createOrder,mw.updateInventory,async(req, res) => {
    try{
        console.log('confirm chkout');
        const insertQuery = `DELETE FROM food_cart WHERE consumer_id =?`;
        db.query(insertQuery, [req.session.user.user_id], (err, result) => {
            if (err) {
                console.log(err.message);
                res.status(500).json({ error: 'Database error while inserting order.' });
            }
            if(result)
            {
                
                const siteName = req.app.locals.siteName;
                res.status(201).json({
                    message: 'success',
                    url : `${siteName}/consumer/orders`,
                });
            }
        }); 
    }catch(error)
    {
         res.status(500).json({ error: 'Database error while inserting order.' });
    }
    
    
  });
  router.post('/addtocart', mw.customerAuthentication, async(req, res) => {
  
    const {
       item_id,
       quantity,
       action
  } = req.body;
 
  const errors = [];
    console.log(req.body);
    let netQty, totalPrice, sql, values, cartId;
  
  try{
        const [cartItems] = await db.promise().query('SELECT * FROM food_cart WHERE consumer_id = ?', [req.session.user.user_id]);
        let flag=false;
        for (let i = 0; i < cartItems.length; i++) {
            if(cartItems[i].item_id == item_id)
            {
                cartId = cartItems[i].cart_id;
                if(action == 'add')
                {
                    netQty = parseInt(quantity) + parseInt(cartItems[i].quantity);
                    totalPrice = parseFloat(cartItems[i].discount_price) * netQty;
                    flag=true;
                }
                else
                {
                    if(parseInt(quantity)==0)
                    {
                        flag=false;
                    }
                    else
                    {
                        netQty = parseInt(quantity);
                        totalPrice = parseFloat(cartItems[i].discount_price) * netQty;
                        flag=true;
                    }
                }
                break;
            }
        }
        console.log('flag', flag);
        if(!flag)
        {
            if(action == 'add')
            {
                const [itemData] = await db.promise().query('SELECT * FROM food_items WHERE item_id = ?', [item_id]);
                netQty = parseInt(quantity) ;
                totalPrice = parseFloat(itemData[0].price) * netQty;
                sql = `
                    INSERT INTO food_cart 
                    (consumer_id, item_id, quantity, discount_price, total_price)
                    VALUES (?, ?, ?, ?, ?)
                `;
                values = [req.session.user.user_id, item_id,netQty,itemData[0].price,totalPrice];
                console.log(itemData);
                console.log(netQty,totalPrice);
            }
            else
            {
                sql = `
                    DELETE FROM food_cart WHERE cart_id =?
                `;
                values = [cartId];
            }
        }
        else
        {
            sql = `
                UPDATE food_cart 
                SET quantity = ?, total_price = ?
                WHERE cart_id = ? 
            `;
            values = [netQty,totalPrice,cartId];
        }

       // Execute the query
        db.query(sql, values, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Something went wrong. Try again! ' + err.message });
            }
            const sql1 = `SELECT * FROM  food_cart WHERE consumer_id = ?`;
            const values1 = [req.session.user.user_id];
            
            db.query(sql1, values1, (err, result1) => {
                if (err) {
                    return res.status(500).json({ error: 'Something went wrong during cart fetch. Try again!' });
                  }
                return res.status(200).json({ message: 'success' ,cartData : result1, action : action});
            });
        });
    }catch (error) {
        res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
});
router.post('/subscribe',  async(req, res) => {
    try{
      const {subscribe } = req.body;
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
                          res.status(201).json({
                              message:  'success'
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
module.exports = router;