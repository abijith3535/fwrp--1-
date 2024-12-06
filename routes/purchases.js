
const express = require('express');
const router = express.Router();
const moment = require('moment');
const db = require('../db');
const mw = require('../middleware/middlewareFunctions');
// Route for getting all purchases
router.get('/', mw.retailerAuthentication,(req, res) => {
  const query = 'SELECT fd.*, u.name FROM `food_order` fd left join users u on u.user_id = fd.consumer_id   WHERE fd.retailer_id = ? order by fd.order_id desc';
  db.query(query,[req.session.user.user_id],(err, results)=>
  {
    if(err)
    {
      return res.status(500).send('Something went wrong!');
    }
    const purchases = results.map(order => ({
      id : order.order_id,
      order_unique : order.order_unique,
      name : order.name,
      date : moment(order.created_at).format('YYYY-MM-DD'),
      price: order.total_price,
      status: order.status,
      }))
    const data = { title: 'Food Waste Reduction - purchases' ,purchases : purchases};
    res.render('retailer/list_purchases', data);   
  });
  
});

router.get('/customers',mw.retailerAuthentication, async(req, res) => {
   
  try{
      const userid = req.session.user.user_id;
      const userQuery = `SELECT DISTINCT u.user_id, u.name, u.email
                          FROM users u
                          JOIN food_order o ON u.user_id = o.consumer_id WHERE o.retailer_id=?`;
      const [uObj] = await db.promise().query(userQuery, [userid]);
      
      const data = { 
          title: 'Food Waste Reduction - inventory', uData : uObj, pageTitle : 'Customers', smallTitle : 'Customers who regularly purchasig our products'
        };
       console.log(req.cartData);
       res.render('retailer/list_customers', data);

  
  }catch(error)
  {
      res.status(500).send('Error in fetching data'+ error.message);
  }
   
});





// Route for adding an item
router.get('/add', mw.retailerAuthentication,(req, res) => {
  const data = { title: 'Food Waste Reduction - Add food item' };
  res.render('retailer/add_item', data);  
});
// Route for getting a single item
router.get('/:id', mw.retailerAuthentication, async(req, res) => {
  
  try{
    let orderData, addressData, itemData;
    const orderKey = req.params.id;
    const orderQuery = `
      SELECT 
        fc.*,u.name as consumer
        FROM 
        food_order fc  
        LEFT JOIN users u ON u.user_id = fc.consumer_id   
      WHERE 
        fc.order_id = ?`;
        const [orderObj] = await db.promise().query(orderQuery, [orderKey]);
        console.log(orderObj[0]);
        if (!orderObj || orderObj.length === 0) 
            res.status(500).send('No data found123');
        else{
            orderData = orderObj[0];
            const itemQuery = `
            SELECT 
                fc.purchase_id, fc.item_id, fi.slug, fi.name, fi.image, fi.quantity AS stock,fi.retailer_id, DATEDIFF(expiration_date, NOW()) AS days_difference,
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
                userCartCount : 0,
                addressData : addressData,
                orderData: orderData,
                itemData:itemData,
                orderStatuses : ['created','processing','completed','cancelled']
                
            };
             res.render('retailer/view_purchases', data);
        }
        
    }catch(error)
    {
        res.status(500).send('Error in fetching data' + error.message);
    }   
 
});
router.post('/change_status', async(req, res) => {
  try{
    const {order_id, status } = req.body;
    const oQuery = `SELECT * FROM food_purchases WHERE order_id=?`;
      const [orderObj] = await db.promise().query(oQuery, [order_id]);
      let flag=true;
      
        console.log(order_id, status);
        const sql1 = `
            UPDATE food_order  SET status = ? WHERE order_id= ?
        `;
        const values1 = [status,order_id];
        db.query(sql1, values1, (err, result) => {
            if (err) {
                console.error('Error updating order:', err);
                return res.status(500).json({ error: 'Database error while updating order.' + err.message});
            }
            if(result)
            {
              if(status == "cancelled")
                {
                    let sql = `UPDATE food_items SET quantity = CASE `;
                    const ids = [];
                    let cartInfo  = req.cartData;
                    orderObj.forEach(oInfo => {
                      
                        sql += `WHEN item_id = ${oInfo.item_id} THEN quantity + ${oInfo.quantity} `;
                        ids.push(oInfo.item_id);
                      });
          
                    sql += `END WHERE item_id IN (?);`;
                    db.query(sql, [ids], (err, result) => {
                      if (err) {
                          console.log(err.message);
                          res.status(500).json({ error: 'Database error while update item quantity.' });
                      }
                      const siteName = req.app.locals.siteName;
                        res.status(201).json({
                            message:  'success'
                        });
                    });  
                }
                else
                {
                    const siteName = req.app.locals.siteName;
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

module.exports = router;